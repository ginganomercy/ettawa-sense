/**
 * @file lib/mock-generator.js
 * @brief Generator mock data untuk testing tampilan / dashboard.
 *
 * Dijalankan server-side saat USE_MOCK_DATA=true atau NODE_ENV=development.
 * Mensimulasikan data ESP32 lengkap termasuk flag is_mock_temp=true yang
 * dikonsumsi oleh TempGauge untuk menampilkan badge MOCK pada suhu.
 */

import { writeTelemetry } from './data-store.js';

let mockInterval = null;

export function startMockGenerator(io) {
  if (mockInterval) return; // Prevent multiple runs

  console.log('[Mock] 🚀 Starting mock data generator...');

  mockInterval = setInterval(() => {
    const deviceId = 'Kambing-01';

    // Parameter kambing normal: suhu 38.0–39.5°C, BPM 70–90
    const tempC       = +(38.0 + (Math.random() * 1.5 - 0.5)).toFixed(2);
    const stressScore = Math.floor(20 + Math.random() * 40);
    const bpm         = Math.floor(75 + Math.random() * 20);

    // Simulasi accelerometer saat diam — gravitasi ≈ 9.81 pada sumbu Y
    // dengan noise kecil untuk simulasi nafas/denyut jantung
    const accelX         = +(Math.random() * 0.1  - 0.05).toFixed(4);
    const accelY         = +(9.81 + Math.random() * 0.1 - 0.05).toFixed(4);
    const accelZ         = +(Math.random() * 0.1  - 0.05).toFixed(4);
    const accelMagnitude = +Math.sqrt(accelX ** 2 + accelY ** 2 + accelZ ** 2).toFixed(4);

    const telemetryPayload = {
      device_id:       deviceId,
      temp_c:          tempC,
      stress_score:    stressScore,
      stress_level:    stressScore >= 70 ? 'STRESS' : stressScore >= 30 ? 'WARNING' : 'NORMAL',
      reason:          'MOCK',
      accel:           { x: accelX, y: accelY, z: accelZ },
      accel_magnitude: accelMagnitude,
      // Flag eksplisit: sensor DS18B20 tidak terpasang, suhu ini adalah simulasi.
      // Di-consume oleh SocketContext.js → TempGauge.jsx untuk menampilkan badge MOCK.
      is_mock_temp:    true,
      ts:              Date.now(),
    };

    // 1. Emit status online
    io.emit('device_status', { online: true, device_id: deviceId, ts: Date.now() });

    // 2. Emit telemetry real-time ke semua browser yang connect
    io.emit('telemetry', telemetryPayload);

    // 3. Emit simulasi Heart Rate (BPM)
    io.emit('bpm_update', { device_id: deviceId, bpm, ts: Date.now() });

    // 4. Simpan ke history (in-memory ring buffer atau InfluxDB)
    writeTelemetry(telemetryPayload).catch(() => {});

  }, 2000); // Emit tiap 2 detik — cukup untuk demo UI, tidak flood broker
}
