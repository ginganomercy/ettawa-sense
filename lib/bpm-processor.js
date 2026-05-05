/**
 * @file lib/bpm-processor.js
 * @brief Port dari Python AI Service — Butterworth DSP untuk SCG Heart Rate.
 *
 * Pipeline identik dengan Python:
 *   1. Detrend (hilangkan baseline gravitasi)
 *   2. Butterworth Bandpass Filter (0.8–2.5 Hz = 48–150 BPM range mamalia)
 *   3. Peak Detection (cari puncak sinyal jantung)
 *   4. Hitung BPM via median interval antar peak
 *
 * Library: fili (npm) — implementasi IIR filter yang sama dengan scipy.signal.butter
 *
 * Trade-off vs Python:
 *   + Tidak butuh proses Python terpisah (monolith)
 *   + Zero inter-process communication overhead
 *   - Sedikit lebih verbose dibanding scipy one-liners
 *   - Performance sama (kedua CPU-bound, bukan GPU-bound)
 */

import pkg from 'fili';
const { CalcCascades, IirFilter } = pkg;

const SAMPLE_RATE    = 50.0;    // Hz — harus sinkron dengan SCG_SAMPLE_INTERVAL_MS di config.h
const BUFFER_SECONDS = 8.0;     // Butuh 8 detik data untuk estimasi BPM yang stabil
const MAX_SAMPLES    = Math.floor(SAMPLE_RATE * BUFFER_SECONDS); // 400 samples

// State per device — Rolling buffer
const deviceBuffers = new Map();

/**
 * Hilangkan komponen DC (baseline gravitasi) dari sinyal.
 * Setara dengan: scipy.signal.detrend(y)
 * @param {number[]} data
 * @returns {number[]}
 */
function detrend(data) {
  const mean = data.reduce((s, v) => s + v, 0) / data.length;
  return data.map(v => v - mean);
}

/**
 * Cari indeks peak dalam sinyal dengan jarak minimal antar peak.
 * Setara dengan: scipy.signal.find_peaks(filtered, distance=20)
 * @param {number[]} data
 * @param {number} minDistance - Jarak minimal antar peak (dalam samples)
 * @returns {number[]} Array indeks peak
 */
function findPeaks(data, minDistance = 20) {
  const peaks = [];
  for (let i = 1; i < data.length - 1; i++) {
    if (data[i] > data[i - 1] && data[i] > data[i + 1]) {
      // Pastikan tidak terlalu dekat dengan peak sebelumnya
      if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minDistance) {
        peaks.push(i);
      }
    }
  }
  return peaks;
}

/**
 * Hitung BPM dari buffer sinyal SCG z-axis.
 * @param {number[]} buffer - Array float z-axis accelerometer (50 Hz)
 * @returns {number|null} BPM atau null jika data tidak cukup/tidak valid
 */
function calculateBpm(buffer) {
  if (buffer.length < MAX_SAMPLES) return null;

  // 1. Detrend
  const detrended = detrend(buffer);

  // 2. Butterworth Bandpass Filter (0.8 Hz – 2.5 Hz)
  //    Setara: scipy.signal.butter(3, [0.8/nyq, 2.5/nyq], btype='band')
  const calc   = new CalcCascades();
  const coeffs = calc.bandpass({
    order:       3,
    characteristic: 'butterworth',
    Fs:          SAMPLE_RATE,
    Fc:          (0.8 + 2.5) / 2,  // Center frequency
    BW:          2.5 - 0.8,        // Bandwidth
    gain:        0,
    preGain:     false,
  });
  const filter   = new IirFilter(coeffs);
  const filtered = detrended.map(v => filter.singleStep(v));

  // 3. Peak Detection (min distance = 20 samples = ~0.4s = 150 BPM max)
  const peaks = findPeaks(filtered, 20);
  if (peaks.length < 3) return null;

  // 4. Hitung interval antar peak → BPM via median
  const intervals = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push((peaks[i] - peaks[i - 1]) / SAMPLE_RATE); // detik
  }
  // Sort untuk ambil median
  intervals.sort((a, b) => a - b);
  const medianInterval = intervals[Math.floor(intervals.length / 2)];

  if (medianInterval === 0) return null;

  const bpm = Math.round(60.0 / medianInterval);

  // Validasi range fisiologis kambing (50–180 BPM)
  return (bpm >= 50 && bpm <= 180) ? bpm : null;
}

/**
 * @brief Proses batch SCG samples baru dari satu device.
 * Dipanggil setiap kali backend menerima pesan MQTT scg_stream.
 *
 * @param {string} deviceId - ID kalung
 * @param {number[]} newSamples - Array float dari z-axis MPU6050
 * @returns {number|null} BPM terbaru atau null jika belum siap
 */
export function processSCGSamples(deviceId, newSamples) {
  if (!deviceBuffers.has(deviceId)) {
    deviceBuffers.set(deviceId, []);
  }

  let buffer = deviceBuffers.get(deviceId);
  buffer = [...buffer, ...newSamples];

  // Rolling window: jaga panjang maksimal
  if (buffer.length > MAX_SAMPLES) {
    buffer = buffer.slice(-MAX_SAMPLES);
  }

  deviceBuffers.set(deviceId, buffer);

  // Hitung BPM hanya saat buffer penuh
  if (buffer.length === MAX_SAMPLES) {
    return calculateBpm(buffer);
  }

  return null;
}
