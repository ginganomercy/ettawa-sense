/**
 * @file lib/temp-mock.js
 * @brief Temperature-only mock emitter untuk production watchdog.
 *
 * Diaktifkan OTOMATIS oleh mqtt-client.js saat tidak ada telemetri
 * dari ESP32 selama TEMP_MOCK_TIMEOUT_MS milidetik.
 *
 * Berbeda dari mock-generator.js (yang generate semua sensor untuk dev):
 *   - Hanya emit field suhu (temp_c) + is_mock_temp: true
 *   - Tidak emit accel/BPM palsu — sensor lain dibiarkan kosong
 *   - Berhenti otomatis saat ESP32 kembali mengirim data real
 *
 * Formula suhu simulasi:
 *   - Base 38.5°C (suhu normal kambing)
 *   - Osilasi ±0.3°C dengan periode ~30 detik (simulasi fluktuasi natural)
 *   - Tidak ada tren naik/turun — suhu stabil untuk menghindari false alert
 */

let _tempMockInterval = null;
let _startTime        = 0;

const TEMP_MOCK_INTERVAL_MS = 3000; // Kirim setiap 3 detik

/**
 * @brief Mulai emit mock suhu ke semua browser yang connect.
 * Aman dipanggil berulang — tidak membuat interval ganda.
 *
 * @param {import('socket.io').Server} io
 * @param {string} deviceId — device_id yang disimulasikan (default: device terakhir yang terlihat)
 */
export function startTempMock(io, deviceId = 'MOCK-DEVICE') {
  if (_tempMockInterval) return; // Sudah berjalan

  _startTime = Date.now();
  console.log(`[TempMock] ⚠️  ESP32 offline — mulai mock suhu untuk "${deviceId}"...`);

  _tempMockInterval = setInterval(() => {
    const seconds = (Date.now() - _startTime) / 1000;

    // Suhu normal kambing 38.5°C ± 0.3°C, osilasi lambat ≈30 detik
    const tempC = +(38.5 + Math.sin(seconds * (2 * Math.PI / 30)) * 0.3).toFixed(2);

    io.emit('telemetry', {
      device_id:    deviceId,
      temp_c:       tempC,
      // Tidak isi stress_score, accel, bpm — biarkan dashboard tampil apa adanya
      // is_mock_temp WAJIB true agar TempGauge tampilkan badge MOCK
      is_mock_temp: true,
      ts:           Date.now(),
    });
  }, TEMP_MOCK_INTERVAL_MS);
}

/**
 * @brief Hentikan mock suhu — dipanggil saat ESP32 kembali online.
 * Aman dipanggil saat interval tidak berjalan.
 */
export function stopTempMock() {
  if (!_tempMockInterval) return;

  clearInterval(_tempMockInterval);
  _tempMockInterval = null;
  console.log('[TempMock] ✅ ESP32 kembali online — mock suhu dihentikan.');
}

/** @returns {boolean} true jika mock sedang berjalan */
export function isTempMockRunning() {
  return _tempMockInterval !== null;
}
