/**
 * @file index.js
 * @brief Entry point backend Ettawa-Sense.
 *
 * Inisialisasi urutan:
 *  1. Express + CORS (restricted) + API key guard + routes
 *  2. Socket.io server dengan API key auth middleware
 *  3. MQTT client (subscribe ettawa/collar/+/*)
 *  4. HTTP listen
 */

import 'dotenv/config';
import express          from 'express';
import { createServer } from 'http';
import { Server }       from 'socket.io';
import cors             from 'cors';
import { startMqttClient, isMqttConnected } from './mqtt-client.js';
import historyRouter        from './routes/history.js';
import { storageMode }      from './data-store.js';

const PORT    = parseInt(process.env.PORT) || 3001;
const API_KEY = process.env.API_KEY        || '';

// Parse daftar origin yang diizinkan dari env (pisahkan dengan koma)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim());

// ── Express App ───────────────────────────────────────────────
const app = express();

// CORS: hanya izinkan origin yang terdaftar di env
// Trade-off: mobile di LAN harus satu-origin atau ditambahkan ke ALLOWED_ORIGINS
app.use(cors({
  origin: (origin, callback) => {
    // Izinkan request tanpa origin (curl, health checks) dan origin terdaftar
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origin ${origin} tidak diizinkan`));
    }
  },
  credentials: false,
}));
app.use(express.json());

/**
 * Middleware validasi API key untuk endpoint REST.
 * Jika API_KEY tidak dikonfigurasi di env → skip (dev mode tanpa auth).
 * Membaca dari header 'x-api-key'.
 */
function apiKeyGuard(req, res, next) {
  if (!API_KEY) return next(); // Dev: tidak ada key dikonfigurasi = lewat
  const incomingKey = req.headers['x-api-key'];
  if (!incomingKey || incomingKey !== API_KEY) {
    return res.status(401).json({
      error: {
        code:    'UNAUTHORIZED',
        message: 'API key tidak valid atau tidak disertakan',
        details: { header: 'x-api-key' },
      }
    });
  }
  next();
}

// Terapkan API key guard ke semua endpoint /api/*
app.use('/api', apiKeyGuard);
app.use('/api', historyRouter);

// Root health check — tidak perlu auth (untuk monitoring uptime)
app.get('/', (_req, res) =>
  res.json({ service: 'ettawa-backend', status: 'running', mode: storageMode })
);

// ── HTTP + Socket.io Server ───────────────────────────────────
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin:  ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
  },
  pingTimeout:  20_000,
  pingInterval: 10_000,
});

// Socket.io: validasi API key saat handshake
io.use((socket, next) => {
  if (!API_KEY) return next(); // Dev mode: skip
  const clientKey = socket.handshake.auth?.apiKey
    || socket.handshake.headers?.['x-api-key'];
  if (clientKey !== API_KEY) {
    return next(new Error('AUTH_FAILED: API key tidak valid'));
  }
  next();
});

io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected:    ${socket.id}`);
  socket.emit('server_hello', {
    message:      'Terhubung ke Ettawa-Sense backend',
    storage_mode: storageMode,
    ts:           Date.now(),
  });
  
  // Sinkronisasi status MQTT awal ke client yang baru join
  socket.emit('mqtt_status', { connected: isMqttConnected });

  socket.on('disconnect', (reason) => {
    console.log(`[Socket.io] Client disconnected: ${socket.id} (${reason})`);
  });
});

// ── MQTT Client ───────────────────────────────────────────────
startMqttClient(io);

// ── Start Listening ───────────────────────────────────────────
httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[Server] ❌ Port ${PORT} sudah dipakai proses lain.`);
    console.error(`[Server]    Hentikan proses lama: taskkill /IM node.exe /F`);
    console.error(`[Server]    Lalu jalankan ulang: npm run dev`);
  } else {
    console.error('[Server] Fatal error:', err.message);
  }
  process.exit(1);
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║   Ettawa-Sense Backend  v1.1          ║');
  console.log(`║   http://localhost:${PORT}              ║`);
  console.log(`║   Storage: ${storageMode.padEnd(26)}║`);
  console.log(`║   Auth: ${API_KEY ? 'API key aktif     ' : 'Dev mode (no auth)'}     ║`);
  console.log('╚══════════════════════════════════════╝');
  console.log('');
});

