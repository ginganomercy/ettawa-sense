"""
@file main.py
@brief Ettawa-Sense AI / DSP Backend — SCG Heart Rate Analyzer.

Menghitung BPM dari sinyal Seismocardiography (SCG) yang dikirim ESP32
via MQTT topic ettawa/collar/+/scg_stream.

Pipeline:
  1. Terima 100 samples z-axis @ 50 Hz (tiap 2 detik) dari ESP32
  2. Akumulasi rolling buffer 8 detik (400 samples) per device
  3. DSP: Detrend → Butterworth Bandpass (0.8–2.5 Hz) → Peak Detection
  4. Hitung BPM via median interval antar peak
  5. Publish hasil ke ettawa/collar/{device_id}/bpm

Broker: HiveMQ Cloud (TLS port 8883) — dikonfigurasi via env variable.
"""

import json
import os
import time
from collections import defaultdict

import numpy as np
from scipy import signal
import paho.mqtt.client as mqtt

# ── Config dari environment variable ──────────────────────────
# Sinkron dengan backend mqtt-client.js dan ESP32 config.h
MQTT_HOST = os.getenv("MQTT_HOST", "broker.hivemq.com")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_USERNAME = os.getenv("MQTT_USERNAME", "")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "")
# TLS: true untuk HiveMQ Cloud (port 8883), false untuk broker publik lokal
USE_TLS = os.getenv("MQTT_USE_TLS", "false").lower() == "true"

TOPIC_SUBSCRIBE = "ettawa/collar/+/scg_stream"

# ── SCG Hyperparameter ─────────────────────────────────────────
SAMPLE_RATE = (
    50.0  # Hz — harus sinkron dengan SCG_SAMPLE_INTERVAL_MS di config.h (20ms)
)
BUFFER_SECONDS = 8.0  # Simpan 8 detik agar mendapat beberapa puncak detak jantung
MAX_SAMPLES = int(SAMPLE_RATE * BUFFER_SECONDS)  # 400 samples

# State per device (mendukung banyak kalung simultan)
device_buffers: dict = defaultdict(lambda: np.array([]))


def calculate_bpm(y_data: np.ndarray) -> int | None:
    """
    Pipeline DSP untuk menghitung BPM dari sinyal SCG z-axis.

    Args:
        y_data: Array float numpy, sinyal z-axis MPU6050 @ 50 Hz

    Returns:
        BPM (int) dalam range 50-180, atau None jika sinyal tidak valid

    Steps:
        1. Detrend: hilangkan offset DC / gravitasi
        2. Butterworth Bandpass Filter (0.8–2.5 Hz = 48–150 BPM)
        3. Peak Detection dengan minimum distance 20 samples (150 BPM max)
        4. Median interval → BPM (lebih robust dari mean terhadap outlier)
    """
    if len(y_data) < MAX_SAMPLES:
        return None  # Buffer belum penuh

    # 1. Hilangkan komponen DC dan trend linear
    detrended = signal.detrend(y_data)

    # 2. Butterworth Bandpass Filter 3rd order
    nyq = 0.5 * SAMPLE_RATE
    low = 0.8 / nyq  # 0.8 Hz ~ 48 BPM
    high = 2.5 / nyq  # 2.5 Hz ~ 150 BPM
    b, a = signal.butter(3, [low, high], btype="band")
    filtered = signal.filtfilt(b, a, detrended)

    # 3. Deteksi puncak — min distance 20 samples (0.4s ~ 150 BPM max)
    peaks, _ = signal.find_peaks(filtered, distance=20)

    if len(peaks) < 3:
        return None  # Terlalu sedikit detak terdeteksi

    # 4. Interval antar puncak → BPM via median
    intervals = np.diff(peaks) / SAMPLE_RATE  # satuan detik
    median_interval = float(np.median(intervals))

    if median_interval == 0:
        return None

    bpm = 60.0 / median_interval

    # Validasi range fisiologis kambing (50–180 BPM)
    return int(bpm) if 50 <= bpm <= 180 else None


def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"[AI Service] ✅ Connected to {MQTT_HOST}:{MQTT_PORT}")
        client.subscribe(TOPIC_SUBSCRIBE)
        print(f"[AI Service] Subscribed: {TOPIC_SUBSCRIBE}")
    else:
        print(f"[AI Service] ❌ Connect failed (rc={rc})")


def on_disconnect(client, userdata, rc):
    """Dipanggil saat koneksi terputus. loop_forever() akan auto-reconnect."""
    if rc != 0:
        print(f"[AI Service] ⚠️  Disconnect tidak terduga (rc={rc}). Reconnecting...")


def on_message(client, userdata, msg):
    try:
        # Format payload ESP32: {"d": "ES-001", "s": [9.8, 9.85, ...]}
        payload = json.loads(msg.payload.decode("utf-8"))
        device_id = payload.get("d")
        samples = payload.get("s", [])

        if not device_id or not samples:
            return

        # Append ke rolling buffer per device
        buffer = device_buffers[device_id]
        buffer = np.concatenate((buffer, samples))

        # Pertahankan panjang maksimal (rolling window)
        if len(buffer) > MAX_SAMPLES:
            buffer = buffer[-MAX_SAMPLES:]

        device_buffers[device_id] = buffer

        # Hitung BPM hanya saat buffer penuh
        if len(buffer) == MAX_SAMPLES:
            bpm = calculate_bpm(buffer)
            if bpm is not None:
                print(f"[AI Service] [{device_id}] Heart Rate: {bpm} BPM")

                # Publish hasil ke backend
                topic_pub = f"ettawa/collar/{device_id}/bpm"
                out_payload = json.dumps(
                    {
                        "device_id": device_id,
                        "bpm": bpm,
                        "timestamp": int(time.time()),
                    }
                )
                client.publish(topic_pub, out_payload)

    except Exception as e:
        print(f"[AI Service] ❌ Error processing message: {e}")


if __name__ == "__main__":
    print("╔══════════════════════════════════╗")
    print("║  Ettawa-Sense AI / DSP Backend   ║")
    print("║  SCG Heart Rate Analyzer v1.1    ║")
    print("╚══════════════════════════════════╝")
    print(f"  Broker: {'mqtts' if USE_TLS else 'mqtt'}://{MQTT_HOST}:{MQTT_PORT}")
    print(f"  Auth:   {'enabled' if MQTT_USERNAME else 'disabled'}")
    print()

    # Inisialisasi client dengan paho-mqtt v2 API (menghindari deprecation warning)
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1)
    client.on_connect = on_connect
    client.on_message = on_message
    client.on_disconnect = on_disconnect

    # Konfigurasi auth
    if MQTT_USERNAME:
        client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

    # Konfigurasi TLS (untuk HiveMQ Cloud)
    if USE_TLS:
        # Gunakan CA root dari sistem — valid untuk HiveMQ Cloud (Let's Encrypt)
        client.tls_set()

    # Exponential backoff reconnect: mulai 5 detik, maks 60 detik
    client.reconnect_delay_set(min_delay=5, max_delay=60)

    # Koneksi pertama
    print(f"[AI Service] Menghubungkan ke {MQTT_HOST}:{MQTT_PORT} ...")
    try:
        client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
    except Exception as e:
        print(f"[AI Service] ❌ Koneksi awal gagal: {e}")
        print("[AI Service] Pastikan broker dapat dijangkau dan credentials benar.")
        exit(1)

    try:
        # loop_forever() menangani reconnect otomatis saat koneksi putus
        client.loop_forever()
    except KeyboardInterrupt:
        pass
    finally:
        print("\n[AI Service] Shutting down...")
        client.disconnect()
