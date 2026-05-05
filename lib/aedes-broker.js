import { Aedes } from 'aedes';
import { WebSocketServer, createWebSocketStream } from 'ws';

/**
 * @file aedes-broker.js
 * @brief Embedded MQTT broker menggunakan Aedes v1.x + ws.WebSocketServer.
 *
 * BREAKING CHANGE aedes@1.0.x:
 *   - `new Aedes()` → DIHAPUS
 *   - API baru: `const broker = await Aedes.createBroker()` (async)
 *   - Sehingga initAedesBroker() harus async dan di-await dari server.js
 *
 * Strategi mount WebSocket (noServer pattern):
 *  1. ws.WebSocketServer({ noServer: true }) — tidak buat port sendiri
 *  2. Intercept HTTP 'upgrade' event: jika path === '/mqtt' → handleUpgrade()
 *  3. 'connection' event → createWebSocketStream() → aedesInstance.handle()
 *  4. Path lain (/socket.io/) dibiarkan untuk Socket.io handler
 */

/**
 * @brief Inisialisasi Aedes broker dan attach ke HTTP server existing.
 *
 * async karena Aedes.createBroker() adalah async (aedes@1.x).
 *
 * @param {import('http').Server} httpServer
 * @returns {Promise<Aedes>} instance Aedes yang sudah siap
 */
export async function initAedesBroker(httpServer) {
  // Baca credentials dari .env
  const MQTT_USERNAME = process.env.MQTT_USERNAME || '';
  const MQTT_PASSWORD = process.env.MQTT_PASSWORD || '';

  // ── Buat Aedes broker (API baru — async) ───────────────────
  const aedesInstance = await Aedes.createBroker();

  // ── Hook Autentikasi ────────────────────────────────────────
  // Jika MQTT_USERNAME kosong → dev mode (accept semua client).
  aedesInstance.authenticate = (client, username, password, callback) => {
    if (!MQTT_USERNAME) {
      return callback(null, true);
    }
    const passString = password ? password.toString() : '';
    if (username === MQTT_USERNAME && passString === MQTT_PASSWORD) {
      callback(null, true);
    } else {
      console.warn(`[Aedes] ⚠️  Auth gagal: client="${client.id}" user="${username}"`);
      const error = new Error('Bad username or password');
      error.returnCode = 4;
      callback(error, null);
    }
  };

  // ── Event Logging ───────────────────────────────────────────
  aedesInstance.on('client', (client) => {
    console.log(`[Aedes] ✅ Client terhubung: ${client.id}`);
  });

  aedesInstance.on('clientDisconnect', (client) => {
    console.log(`[Aedes] 🔌 Client terputus: ${client.id}`);
  });

  aedesInstance.on('clientError', (client, err) => {
    console.error(`[Aedes] ❌ Error (${client?.id ?? 'unknown'}):`, err.message);
  });

  aedesInstance.on('publish', (packet, client) => {
    if (client) {
      console.log(`[Aedes] ← [${client.id}] → ${packet.topic} (${packet.payload?.length ?? 0}B)`);
    }
  });

  // ── Mount WebSocket di path /mqtt (noServer pattern) ───────
  // ws.WebSocketServer tanpa port sendiri — share httpServer dengan Next.js + Socket.io
  const wsServer = new WebSocketServer({ noServer: true });

  wsServer.on('connection', (socket) => {
    // Ubah WebSocket menjadi Node.js Duplex stream lalu pipe ke Aedes
    const stream = createWebSocketStream(socket);
    aedesInstance.handle(stream);
  });

  // Intercept HTTP upgrade request — routing berdasarkan path
  httpServer.on('upgrade', (request, socket, head) => {
    let pathname = '/';
    try {
      pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
    } catch {
      pathname = request.url;
    }

    if (pathname === '/mqtt') {
      // Serahkan ke Aedes WebSocket server
      wsServer.handleUpgrade(request, socket, head, (ws) => {
        wsServer.emit('connection', ws, request);
      });
    }
    // Upgrade path lain (/socket.io/) → Socket.io tangani sendiri via httpServer listener-nya
  });

  console.log('[Aedes] MQTT WebSocket broker terpasang di path /mqtt');
  return aedesInstance;
}
