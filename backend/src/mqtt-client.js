/**
 * @file mqtt-client.js
 * @brief MQTT subscriber — jembatan antara ESP32 dan Socket.io + data store.
 *
 * Subscribe menggunakan MQTT Wildcard (+) agar satu backend dapat menangani
 * N unit kalung tanpa restart. Device ID diekstrak dari segmen topik ke-3.
 *
 * Struktur topik: ettawa/collar/{DEVICE_ID}/{event}
 *   Contoh: ettawa/collar/ES-001/telemetry
 *
 * Wildcard:
 *   ettawa/collar/+/telemetry  — subscribe telemetry semua kalung
 *   ettawa/collar/+/alert      — subscribe alert semua kalung
 *   ettawa/collar/+/status     — subscribe status semua kalung
 *
 * Reconnect otomatis setiap 5 detik jika koneksi broker putus.
 */

import mqtt from 'mqtt';
import { writeTelemetry, writeAlert } from './data-store.js';

// Broker URL dari env — mendukung mqtt:// (plaintext) dan mqtts:// (TLS).
// Production: gunakan mqtts://YOUR_CLUSTER.s1.eu.hivemq.cloud:8883
// Sinkron dengan ESP32 config.h dan Python AI main.py.
const BROKER_URL = process.env.MQTT_BROKER_URL  || 'mqtt://broker.hivemq.com:1883';
const MQTT_USER  = process.env.MQTT_USERNAME     || '';
const MQTT_PASS  = process.env.MQTT_PASSWORD     || '';

/**
 * Wildcard topic subscriptions.
 * '+' cocok dengan tepat satu segmen topik — hanya menangkap DEVICE_ID.
 * '#' tidak digunakan di sini untuk menghindari subscribe topik lain yang
 * tidak relevan pada broker publik.
 */
const TOPICS = [
  'ettawa/collar/+/telemetry',
  'ettawa/collar/+/alert',
  'ettawa/collar/+/status',
  'ettawa/collar/+/bpm',  // Topic dari Python AI Service
];

/**
 * Ekstrak DEVICE_ID dari string topik MQTT.
 * Topik: "ettawa/collar/{DEVICE_ID}/event"
 * Contoh: "ettawa/collar/ES-001/telemetry" → "ES-001"
 *
 * @param {string} topic - String topik MQTT yang diterima
 * @returns {string} DEVICE_ID atau 'unknown' jika format tidak cocok
 */
function extractDeviceId(topic) {
  const segments = topic.split('/');
  // segments: ["ettawa", "collar", "{DEVICE_ID}", "event"]
  return segments.length >= 3 ? segments[2] : 'unknown';
}

export let isMqttConnected = false;

/**
 * @brief Mulai MQTT client dan hubungkan ke Socket.io server.
 * @param {import('socket.io').Server} io — Socket.io server instance
 * @returns {import('mqtt').MqttClient} Instance MQTT client yang aktif
 */
export function startMqttClient(io) {
  const client = mqtt.connect(BROKER_URL, {
    clientId:        `ettawa-backend-${Date.now()}`,
    reconnectPeriod: 5_000,   // Retry setiap 5 detik jika koneksi putus
    keepalive:       60,       // MQTT keep-alive 60 detik
    connectTimeout:  15_000,  // Timeout connect awal (TLS butuh lebih lama)
    // Sertakan credentials hanya jika dikonfigurasi — hindari string kosong
    ...(MQTT_USER && { username: MQTT_USER }),
    ...(MQTT_PASS && { password: MQTT_PASS }),
    // TLS otomatis aktif saat menggunakan mqtts:// di BROKER_URL.
    // HiveMQ Cloud menggunakan Let's Encrypt CA yang valid — tidak perlu override.
  });

  client.on('connect', () => {
    isMqttConnected = true;
    console.log(`[MQTT] ✅ Connected to ${BROKER_URL}`);
    // Subscribe ke semua wildcard topics setelah koneksi berhasil
    TOPICS.forEach((topic) => {
      client.subscribe(topic, (err) => {
        if (err) console.error(`[MQTT] Gagal subscribe ${topic}:`, err.message);
        else     console.log(`[MQTT] Subscribed: ${topic}`);
      });
    });
    io.emit('mqtt_status', { connected: true });
  });

  client.on('message', (topic, payloadBuf) => {
    const raw = payloadBuf.toString();

    // Ekstrak DEVICE_ID dari topik — kunci untuk filtering di frontend
    const deviceId = extractDeviceId(topic);

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      // Status topic mengirim plain string (e.g. "ONLINE")
      data = raw;
    }

    if (topic.endsWith('telemetry') && typeof data === 'object') {
      // Pastikan device_id di payload konsisten dengan topik MQTT.
      // Jika firmware mengirim DEVICE_ID yang berbeda dari topik (edge case),
      // kita gunakan nilai dari topik sebagai sumber kebenaran tunggal.
      const resolvedId = deviceId !== 'unknown' ? deviceId : (data.device_id ?? 'unknown');

      const telemetryPayload = { ...data, device_id: resolvedId };

      console.log(`[MQTT] ← [${resolvedId}] telemetry | temp:${data.temp_c}°C score:${data.stress_score} level:${data.stress_level}`);

      // Broadcast telemetri ke semua client frontend yang terhubung.
      // Frontend bertanggung jawab mem-filter berdasarkan device_id.
      io.emit('telemetry', telemetryPayload);

      // Infer device ONLINE dari telemetri yang masuk.
      // (ESP32 hanya publish "ONLINE" saat boot — jika backend startup
      //  setelah ESP32 sudah boot, status event sudah terlewat.)
      io.emit('device_status', {
        online:    true,
        device_id: resolvedId,
        ts:        Date.now(),
      });

      writeTelemetry(telemetryPayload).catch((err) =>
        console.warn(`[DataStore] Telemetry write error [${resolvedId}]:`, err.message)
      );

    } else if (topic.endsWith('alert') && typeof data === 'object') {
      const resolvedId = deviceId !== 'unknown' ? deviceId : (data.device_id ?? 'unknown');
      const alertPayload = { ...data, device_id: resolvedId, ts: Date.now() };

      console.log(`[MQTT] ← [${resolvedId}] alert | score:${data.stress_score} reason:${data.reason}`);

      io.emit('alert', alertPayload);
      writeAlert(alertPayload).catch((err) =>
        console.warn(`[DataStore] Alert write error [${resolvedId}]:`, err.message)
      );

    } else if (topic.endsWith('status')) {
      const isOnline = raw === 'ONLINE' || data === 'ONLINE';
      console.log(`[MQTT] ← [${deviceId}] status | ${raw}`);
      io.emit('device_status', {
        online:    isOnline,
        device_id: deviceId,
        ts:        Date.now(),
      });
      
    } else if (topic.endsWith('bpm') && typeof data === 'object') {
      const resolvedId = deviceId !== 'unknown' ? deviceId : (data.device_id ?? 'unknown');
      const bpmPayload = { ...data, device_id: resolvedId, ts: Date.now() };

      console.log(`[MQTT] ← [${resolvedId}] bpm | ${data.bpm} BPM`);
      io.emit('bpm_update', bpmPayload);
    }
  });

  client.on('error',      (err) => console.error('[MQTT] Error:', err.message));
  client.on('reconnect',  ()    => console.log('[MQTT] 🔄 Reconnecting...'));
  client.on('offline',    ()    => {
    isMqttConnected = false;
    console.warn('[MQTT] ⚠️  Offline — broker tidak terjangkau');
    io.emit('mqtt_status', { connected: false });
    io.emit('device_status', { online: false, ts: Date.now() });
  });
  client.on('close',      ()    => console.log('[MQTT] Connection closed'));

  return client;
}
