/**
 * @file data-store.js
 * @brief Abstraksi penyimpanan data dengan InfluxDB + graceful in-memory fallback.
 *
 * Strategi:
 *  - Jika INFLUX_TOKEN tersedia → gunakan InfluxDB (persistent)
 *  - Jika tidak → gunakan ring buffer in-memory (500 data point)
 *
 * Trade-off in-memory:
 *  + Zero setup, langsung jalan
 *  - Data hilang saat server restart
 *
 * Migrasi ke InfluxDB di bare metal:
 *  1. Install influxdb2 dan jalankan
 *  2. Isi INFLUX_TOKEN di .env
 *  3. Restart server — otomatis pakai InfluxDB tanpa ubah kode lain
 */

import { InfluxDB, Point } from '@influxdata/influxdb-client';

const {
  INFLUX_URL    = 'http://localhost:8086',
  INFLUX_TOKEN  = '',
  INFLUX_ORG    = 'capratech',
  INFLUX_BUCKET = 'ettawa',
} = process.env;

const USE_INFLUX = INFLUX_TOKEN.length > 0;

// ── InfluxDB Client (lazy-init) ───────────────────────────────
let _influxClient = null;
let _writeApi     = null;
let _queryApi     = null;

function getInflux() {
  if (!_influxClient) {
    _influxClient = new InfluxDB({ url: INFLUX_URL, token: INFLUX_TOKEN });
    _writeApi     = _influxClient.getWriteApi(INFLUX_ORG, INFLUX_BUCKET, 'ms');
    _queryApi     = _influxClient.getQueryApi(INFLUX_ORG);
  }
  return { writeApi: _writeApi, queryApi: _queryApi };
}

// ── In-Memory Ring Buffer ─────────────────────────────────────
const MAX_POINTS = 500;
const memTelemetry = []; // ring buffer telemetry
const memAlerts    = []; // last 100 alerts

function memWrite(data) {
  memTelemetry.push({
    ts:              Date.now(),
    temp_c:          parseFloat(data.temp_c),
    accel_magnitude: parseFloat(data.accel_magnitude),
    stress_score:    data.stress_score,
    stress_level:    data.stress_level,
  });
  if (memTelemetry.length > MAX_POINTS) memTelemetry.shift();
}

function memWriteAlert(data) {
  memAlerts.unshift({ ...data, ts: Date.now() });
  if (memAlerts.length > 100) memAlerts.pop();
}

function memQuery(hours) {
  const cutoff = Date.now() - hours * 3_600_000;
  return memTelemetry.filter((p) => p.ts >= cutoff);
}

// ── Public API ────────────────────────────────────────────────

/**
 * @brief Simpan satu titik data telemetri.
 * @param {object} data — Payload dari MQTT topic telemetry
 */
export async function writeTelemetry(data) {
  if (USE_INFLUX) {
    const { writeApi } = getInflux();
    const point = new Point('collar_telemetry')
      .tag('device_id', data.device_id || 'capra-collar-01')
      .floatField('temp_c',          parseFloat(data.temp_c))
      .floatField('accel_x',         parseFloat(data.accel?.x  || 0))
      .floatField('accel_y',         parseFloat(data.accel?.y  || 0))
      .floatField('accel_z',         parseFloat(data.accel?.z  || 0))
      .floatField('accel_magnitude', parseFloat(data.accel_magnitude))
      .intField('stress_score',      data.stress_score)
      .stringField('stress_level',   data.stress_level)
      .stringField('reason',         data.reason);
    writeApi.writePoint(point);
    await writeApi.flush();
  } else {
    memWrite(data);
  }
}

/**
 * @brief Simpan satu event alert stres.
 * @param {object} data — Payload dari MQTT topic alert
 */
export async function writeAlert(data) {
  if (USE_INFLUX) {
    const { writeApi } = getInflux();
    const point = new Point('collar_alert')
      .tag('device_id', data.device_id || 'capra-collar-01')
      .intField('stress_score',      data.stress_score)
      .stringField('stress_level',   data.stress_level)
      .stringField('reason',         data.reason)
      .floatField('temp_c',          parseFloat(data.temp_c))
      .floatField('accel_magnitude', parseFloat(data.accel_magnitude));
    writeApi.writePoint(point);
    await writeApi.flush();
  } else {
    memWriteAlert(data);
  }
}

/**
 * @brief Query riwayat data telemetri N jam terakhir.
 * @param {number} hours — Jumlah jam ke belakang (default 24)
 * @returns {Promise<Array>} Array of { time, temp_c, stress_score, accel_magnitude }
 */
export async function queryHistory(hours = 24) {
  if (USE_INFLUX) {
    const { queryApi } = getInflux();
    const fluxQuery = `
      from(bucket: "${INFLUX_BUCKET}")
        |> range(start: -${hours}h)
        |> filter(fn: (r) => r._measurement == "collar_telemetry")
        |> filter(fn: (r) =>
            r._field == "temp_c" or
            r._field == "stress_score" or
            r._field == "accel_magnitude")
        |> aggregateWindow(every: 1m, fn: mean, createEmpty: false)
        |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
        |> sort(columns: ["_time"])
    `;
    const rows = [];
    await new Promise((resolve, reject) => {
      queryApi.queryRows(fluxQuery, {
        next:     (row, meta) => rows.push(meta.toObject(row)),
        error:    reject,
        complete: resolve,
      });
    });
    return rows.map((r) => ({
      time:            r._time,
      temp_c:          r.temp_c,
      stress_score:    r.stress_score,
      accel_magnitude: r.accel_magnitude,
    }));
  } else {
    return memQuery(hours);
  }
}

/**
 * @brief Ambil riwayat alert (hanya tersedia di mode in-memory).
 * @returns {Array} Array alert terbaru
 */
export function getRecentAlerts() {
  return memAlerts.slice(0, 20);
}

export const storageMode = USE_INFLUX ? 'influxdb' : 'memory';
