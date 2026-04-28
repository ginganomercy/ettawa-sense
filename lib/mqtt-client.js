/**
 * @file lib/mqtt-client.js
 * @brief MQTT subscriber untuk monolith + temperature watchdog.
 *
 * Tambahan dari versi awal:
 *   - Watchdog timer: jika tidak ada telemetri selama TEMP_MOCK_TIMEOUT_MS,
 *     otomatis jalankan mock suhu via temp-mock.js.
 *   - Mock berhenti otomatis saat data real dari ESP32 masuk kembali.
 */

import mqtt from 'mqtt';
import { writeTelemetry, writeAlert } from './data-store.js';
import { processSCGSamples } from './bpm-processor.js';
import { setMqttConnected } from './socket-server.js';
import { startTempMock, stopTempMock, isTempMockRunning } from './temp-mock.js';

const PORT = process.env.PORT || '3000';
// Monolith mengkonsumsi mqtt sendiri secara internal dari Aedes (WebSocket)
const BROKER_URL = process.env.MQTT_BROKER_URL || `ws://127.0.0.1:${PORT}/mqtt`;
const MQTT_USER  = process.env.MQTT_USERNAME || '';
const MQTT_PASS  = process.env.MQTT_PASSWORD || '';

// Setelah N ms tidak ada telemetri dari ESP32 → otomatis jalankan mock suhu.
// Default 15 detik — cukup untuk melewati 2-3 sampling cycle (heartbeat 30s).
// Override via TEMP_MOCK_TIMEOUT_MS di .env jika diperlukan.
const TEMP_MOCK_TIMEOUT_MS = parseInt(process.env.TEMP_MOCK_TIMEOUT_MS || '15000', 10);

// State tracking untuk watchdog
let lastTelemetryTs = 0;   // Timestamp telemetri terakhir diterima
let lastDeviceId    = 'ES-001'; // Device ID terakhir — dipakai saat mock dijalankan

const TOPICS = [
  'ettawa/collar/+/telemetry',
  'ettawa/collar/+/alert',
  'ettawa/collar/+/status',
  'ettawa/collar/+/scg_stream',  // Diproses lokal oleh bpm-processor.js
];

function extractDeviceId(topic) {
  const segments = topic.split('/');
  return segments.length >= 3 ? segments[2] : 'unknown';
}

export function startMqttClient(io) {
  const client = mqtt.connect(BROKER_URL, {
    clientId: `ettawa-monolith-${Date.now()}`,
    reconnectPeriod: 5_000,
    keepalive: 60,
    connectTimeout: 15_000,
    ...(MQTT_USER && { username: MQTT_USER }),
    ...(MQTT_PASS && { password: MQTT_PASS }),
  });

  client.on('connect', () => {
    console.log(`[MQTT] ✅ Connected to ${BROKER_URL}`);
    TOPICS.forEach((topic) => {
      client.subscribe(topic, (err) => {
        if (err) console.error(`[MQTT] Gagal subscribe ${topic}:`, err.message);
        else console.log(`[MQTT] Subscribed: ${topic}`);
      });
    });
    setMqttConnected(true);

    // ── Watchdog: cek setiap 5 detik apakah telemetri masih masuk ──
    // Dibuat di sini agar hanya berjalan setelah broker connect.
    setInterval(() => {
      const silentMs = Date.now() - lastTelemetryTs;
      const isFirstRun = lastTelemetryTs === 0;

      if (!isFirstRun && silentMs > TEMP_MOCK_TIMEOUT_MS && !isTempMockRunning()) {
        // ESP32 tidak mengirim data lebih dari threshold → nyalakan mock suhu
        console.warn(`[TempMock] Tidak ada telemetri selama ${Math.round(silentMs / 1000)}s → start mock suhu...`);
        startTempMock(io, lastDeviceId);
      }
    }, 5_000);
  });

  client.on('message', (topic, payloadBuf) => {
    const raw = payloadBuf.toString();
    const deviceId = extractDeviceId(topic);
    let data;
    try { data = JSON.parse(raw); } catch { data = raw; }

    if (topic.endsWith('telemetry') && typeof data === 'object') {
      const resolvedId = deviceId !== 'unknown' ? deviceId : (data.device_id ?? 'unknown');
      const telemetryPayload = { ...data, device_id: resolvedId };
      console.log(`[MQTT] ← [${resolvedId}] telemetry | temp:${data.temp_c}°C score:${data.stress_score}`);

      // ── Watchdog: data real masuk → hentikan mock suhu jika sedang jalan ──
      lastTelemetryTs = Date.now();
      lastDeviceId    = resolvedId;
      if (isTempMockRunning()) stopTempMock();

      io.emit('telemetry', telemetryPayload);
      io.emit('device_status', { online: true, device_id: resolvedId, ts: Date.now() });
      writeTelemetry(telemetryPayload).catch((err) =>
        console.warn(`[DataStore] Write error [${resolvedId}]:`, err.message)
      );

    } else if (topic.endsWith('alert') && typeof data === 'object') {
      const resolvedId = deviceId !== 'unknown' ? deviceId : (data.device_id ?? 'unknown');
      const alertPayload = { ...data, device_id: resolvedId, ts: Date.now() };
      io.emit('alert', alertPayload);
      writeAlert(alertPayload).catch((err) =>
        console.warn(`[DataStore] Alert error [${resolvedId}]:`, err.message)
      );

    } else if (topic.endsWith('status')) {
      const isOnline = raw === 'ONLINE' || data === 'ONLINE';
      io.emit('device_status', { online: isOnline, device_id: deviceId, ts: Date.now() });
      if (!isOnline) io.emit('device_status', { online: false, ts: Date.now() });

    } else if (topic.endsWith('scg_stream') && typeof data === 'object') {
      // Proses BPM secara lokal — tidak butuh Python service terpisah
      const resolvedId = data.d || deviceId;
      const newSamples = data.s || [];

      if (newSamples.length > 0) {
        const bpm = processSCGSamples(resolvedId, newSamples);
        if (bpm !== null) {
          console.log(`[BPM] [${resolvedId}] Heart Rate: ${bpm} BPM`);
          io.emit('bpm_update', { device_id: resolvedId, bpm, ts: Date.now() });
        }
      }
    }
  });

  client.on('error',    (err) => console.error('[MQTT] Error:', err.message));
  client.on('reconnect',()    => console.log('[MQTT] 🔄 Reconnecting...'));
  client.on('offline', () => {
    console.warn('[MQTT] ⚠️  Offline');
    setMqttConnected(false);
    io.emit('device_status', { online: false, ts: Date.now() });
    // MQTT broker offline → langsung nyalakan mock suhu tanpa tunggu watchdog timeout
    if (!isTempMockRunning()) startTempMock(io, lastDeviceId);
  });

  return client;
}
