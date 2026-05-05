import { Server } from 'socket.io';

let _io = null;

// ── Server-side State Cache ───────────────────────────────────
// Menyimpan status terkini agar bisa di-emit ke browser baru yang connect.
// Trade-off: state di-memory, reset saat server restart (acceptable).
let _mqttConnected = false;
let _deviceOnline = false;

/**
 * @brief Update status MQTT dan broadcast ke semua socket yang terhubung.
 * Dipanggil dari mqtt-client.js saat connect/disconnect.
 */
export function setMqttConnected(connected) {
  _mqttConnected = connected;
  if (_io) _io.emit('mqtt_status', { connected });
}

/**
 * @brief Update status device dan broadcast ke semua socket yang terhubung.
 * Dipanggil dari mqtt-client.js saat menerima publish dari ESP32.
 */
export function setDeviceOnline(online, deviceId = null) {
  _deviceOnline = online;
  if (_io) _io.emit('device_status', { online, device_id: deviceId, ts: Date.now() });
}

export function initSocketServer(httpServer, allowedOrigins, apiKey) {
  if (_io) return _io;

  _io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 20_000,
    pingInterval: 10_000,
  });

  // Middleware autentikasi API key
  if (apiKey) {
    _io.use((socket, next) => {
      const clientKey = socket.handshake.auth?.apiKey
        || socket.handshake.headers?.['x-api-key'];
      if (clientKey !== apiKey) {
        return next(new Error('AUTH_FAILED'));
      }
      next();
    });
  }

  _io.on('connection', (socket) => {
    console.log(`[Socket.io] Client connected:    ${socket.id}`);

    // Kirim state terkini ke browser baru — mencegah tampilan "Putus"
    // meskipun MQTT sudah connected sebelum browser join.
    socket.emit('server_hello', { message: 'Terhubung ke Ettawa-Sense', ts: Date.now() });
    socket.emit('mqtt_status', { connected: _mqttConnected });
    if (_deviceOnline) {
      socket.emit('device_status', { online: _deviceOnline, ts: Date.now() });
    }

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.io] Client disconnected: ${socket.id} (${reason})`);
    });
  });

  return _io;
}

export function getIO() {
  return _io;
}

