/**
 * @file server.js
 * @brief Entry point monolith Ettawa-Sense.
 *
 * Urutan inisialisasi:
 *  1. Next.js app.prepare()
 *  2. Express app + CORS + API key guard + API routes
 *  3. Socket.io server (attach ke HTTP server yang sama)
 *  4. MQTT client (subscribe ke HiveMQ Cloud)
 *  5. HTTP listen
 *
 * Mengapa custom server, bukan Next.js default?
 *   Socket.io butuh akses ke Node.js http.Server yang sama.
 *   Next.js tidak expose http.Server secara default — custom server adalah
 *   satu-satunya cara yang didukung officially untuk integrasi ini.
 *
 * Trade-off:
 *   ❌ Vercel deployment tidak bisa (tidak masalah — kita pakai cPanel)
 *   ❌ Beberapa Next.js optimisasi (Automatic Static Optimization) tidak aktif
 *   ✅ Single port, single process, zero cross-service latency
 *   ✅ Tidak perlu CORS untuk komunikasi internal
 */

import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import next from 'next';
import cors from 'cors';
import { initSocketServer } from './lib/socket-server.js';
import { startMqttClient } from './lib/mqtt-client.js';
import { initAedesBroker } from './lib/aedes-broker.js';
import { queryHistory, getRecentAlerts, storageMode } from './lib/data-store.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const IS_DEV = process.env.NODE_ENV !== 'production';
const API_KEY = process.env.API_KEY || process.env.NEXT_PUBLIC_API_KEY || '';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim());

// ── 1. Next.js App ──────────────────────────────────────────
const nextApp = next({ dev: IS_DEV });
const handle = nextApp.getRequestHandler();

await nextApp.prepare();

// ── 2. Express ──────────────────────────────────────────────
const app = express();

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) cb(null, true);
    else cb(new Error(`CORS: Origin ${origin} tidak diizinkan`));
  },
  credentials: false,
}));
app.use(express.json());

// API Key guard middleware
function apiKeyGuard(req, res, next) {
  if (!API_KEY) return next(); // Dev: skip jika tidak dikonfigurasi
  const key = req.headers['x-api-key'];
  if (!key || key !== API_KEY) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'API key tidak valid' }
    });
  }
  next();
}

// ── API Routes (menggantikan ettawa-web/backend/src/routes/) ─
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'ettawa-sense-monolith',
    storage_mode: storageMode,
    uptime_s: Math.floor(process.uptime()),
    ts: new Date().toISOString(),
  });
});

app.get('/api/history', apiKeyGuard, async (req, res) => {
  try {
    const hours = Math.min(parseInt(req.query.hours) || 24, 168);
    const data = await queryHistory(hours);
    res.json({ ok: true, count: data.length, hours, data });
  } catch (err) {
    console.error('[History] Query error:', err.message);
    res.status(500).json({ ok: false, error: 'Gagal query riwayat' });
  }
});

app.get('/api/alerts', apiKeyGuard, (_req, res) => {
  try {
    const alerts = getRecentAlerts();
    res.json({ ok: true, count: alerts.length, data: alerts });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Semua request lain → Next.js ───────────────────────────
app.all('*', (req, res) => handle(req, res));

// ── 3. HTTP + Socket.io + Aedes MQTT Server ─────────────────
const httpServer = createServer(app);
const io = initSocketServer(httpServer, ALLOWED_ORIGINS, API_KEY);
// await diperlukan karena Aedes.createBroker() adalah async di aedes@1.x
const aedes = await initAedesBroker(httpServer);

// ── 4. Start Listening ──────────────────────────────────────
// PENTING: startMqttClient() dipanggil di DALAM callback listen!
// Reason: MQTT client internal konek ke ws://127.0.0.1:PORT/mqtt (Aedes).
// Jika dipanggil sebelum listen(), server belum ready → ECONNREFUSED
// → loop reconnect tanpa henti → browser selalu offline/reconnecting.
httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[Server] ❌ Port ${PORT} sudah dipakai.`);
  } else {
    console.error('[Server] Fatal:', err.message);
  }
  process.exit(1);
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   Ettawa-Sense Monolith v2.0              ║');
  console.log(`║   http://localhost:${PORT}                 ║`);
  console.log(`║   Mode: ${IS_DEV ? 'Development' : 'Production         '}           ║`);
  console.log(`║   Storage: ${storageMode.padEnd(30)}║`);
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  // ── 5. Node.js Internal MQTT Client ──────────────────────
  // Dipanggil di sini agar server sudah listen sebelum MQTT client connect.
  startMqttClient(io);
});
