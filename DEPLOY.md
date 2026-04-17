# Ettawa-Sense — Panduan Deploy ke cPanel

## Prasyarat

| Kebutuhan | Versi |
|-----------|-------|
| Node.js di cPanel | **20.x** (via Node.js Selector) |
| npm | 10.x (bundled dengan Node 20) |
| Domain / Subdomain | Sudah dibuat di cPanel (contoh: `ettawa.yourdomain.com`) |
| SSL / HTTPS | Aktifkan via cPanel → Let's Encrypt |

---

## Langkah 1 — Build Lokal

```bash
cd ettawa-web/frontend
npm install
npm run build
```

Pastikan build **tidak error**. Folder `.next/` akan terbuat.

---

## Langkah 2 — Siapkan File untuk Upload

File yang **WAJIB diupload** ke cPanel:

```
ettawa-web/frontend/
├── .env                ← BUAT MANUAL di server (lihat Langkah 4)
├── .htaccess
├── .nvmrc
├── .next/              ← hasil build
├── app/
├── components/
├── context/
├── lib/
├── public/
├── next.config.mjs
├── package.json
├── package-lock.json
├── postcss.config.mjs
└── server.js
```

File yang **JANGAN diupload**:
- `node_modules/` (akan di-install ulang di server)
- `.env` (isi credentials — buat manual di server)
- `.git/`

> **Cara upload:** Gunakan FTP (FileZilla) atau Git deployment via cPanel.

---

## Langkah 3 — Setup Node.js App di cPanel

1. Login cPanel → cari **"Node.js"** atau **"Setup Node.js App"**
2. Klik **"Create Application"**
3. Isi form:

   | Field | Nilai |
   |-------|-------|
   | Node.js version | **20.x** |
   | Application mode | **Production** |
   | Application root | `/home/USERNAME/ettawa-web` (sesuai lokasi upload) |
   | Application URL | `ettawa.yourdomain.com` |
   | Application startup file | `server.js` |

4. Klik **"Create"** → cPanel otomatis setup Passenger + proxy

---

## Langkah 4 — Buat File `.env` di Server

Buka **cPanel → Terminal** (atau SSH):

```bash
cd ~/ettawa-web
nano .env
```

Isi dengan nilai production:

```env
NODE_ENV=production
PORT=3000

# URL publik domain production
NEXT_PUBLIC_BACKEND_URL=https://ettawa.yourdomain.com

# API Key — generate dulu dengan perintah di bawah
API_KEY=GANTI_DENGAN_RANDOM_KEY
NEXT_PUBLIC_API_KEY=GANTI_DENGAN_RANDOM_KEY

# MQTT Credentials — HARUS SAMA dengan config.h ESP32
MQTT_USERNAME=ettawa-device
MQTT_PASSWORD=secretpassword123

# Internal broker URL (loopback, tidak perlu ganti)
MQTT_BROKER_URL=ws://127.0.0.1:3000/mqtt

# CORS — domain production
ALLOWED_ORIGINS=https://ettawa.yourdomain.com
```

Generate API Key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Isi nilai yang sama untuk `API_KEY` dan `NEXT_PUBLIC_API_KEY`.

---

## Langkah 5 — Install Dependencies & Start

Di **cPanel Terminal** (atau SSH):

```bash
cd ~/ettawa-web

# Install semua dependencies (termasuk devDependencies untuk build)
npm install

# Build Next.js (jika belum build lokal dan upload .next/)
npm run build

# Start production server
npm start
```

Atau klik tombol **"Run NPM Install"** + **"Start App"** di UI cPanel Node.js Selector.

---

## Langkah 6 — Update Firmware ESP32 (WAJIB)

Edit `ettawa-iot/include/config.h`:

```cpp
// ── DEPLOYMENT TARGET — pilih salah satu ──

// [DEVELOPMENT] — comment baris ini saat production
// constexpr char MQTT_BROKER_URI[] = "ws://10.74.26.176:3000/mqtt";

// [PRODUCTION] — uncomment baris ini untuk cPanel deployment
constexpr char MQTT_BROKER_URI[] = "wss://ettawa.yourdomain.com/mqtt";
//                                  ^^^ ganti dengan domain aktual
```

Lalu flash ulang firmware ke ESP32:
```bash
cd ettawa-iot
pio run --target upload
```

---

## Langkah 7 — Verifikasi

### Cek server berjalan:
```bash
curl https://ettawa.yourdomain.com/api/health
# Expected: {"ok":true,"service":"ettawa-sense-monolith",...}
```

### Cek WebSocket (wss://) dari Serial Monitor ESP32:
```
[INFO ] WiFi OK. IP: ...
[INFO ] [MQTT-IDF] Event: CONNECTED ke WebSocket Broker!
```

### Cek Dashboard:
Buka `https://ettawa.yourdomain.com?device=ES-001`
- **WS** dot = ✅ hijau
- **MQTT** dot = ✅ hijau
- **Collar** dot = ✅ hijau (saat ESP32 connect)

---

## Troubleshooting WebSocket di cPanel

Jika ESP32 tidak bisa connect via `wss://`:

**Kemungkinan 1 — mod_proxy_wstunnel belum aktif**
Hubungi hosting provider untuk aktifkan `mod_proxy_wstunnel` di Apache.

**Kemungkinan 2 — Passenger belum support WebSocket**
Cek versi Passenger di cPanel Terminal:
```bash
passenger --version
# Harus >= 5.0 untuk WebSocket support
```

**Kemungkinan 3 — SSL belum aktif**
ESP32 menggunakan `wss://` (TLS) — domain **wajib** punya sertifikat SSL.
Aktifkan via cPanel → SSL/TLS → Let's Encrypt.

**Kemungkinan 4 — Port 3000 terblokir**
cPanel shared hosting biasanya tidak expose port arbitrary.
App harus berjalan di belakang Apache (port 443) via Passenger.
Pastikan `PORT` di `.env` sesuai dengan yang diberikan Passenger.

---

## Catatan Penting

| Item | Lokal (dev) | cPanel (prod) |
|------|-------------|---------------|
| URI ESP32 | `ws://10.74.26.176:3000/mqtt` | `wss://ettawa.yourdomain.com/mqtt` |
| Dashboard URL | `http://localhost:3000` | `https://ettawa.yourdomain.com` |
| Server start | `npm run dev` | `npm start` (via Passenger) |
| Auto-restart | Manual | Passenger otomatis |
| SSL | Tidak perlu | **WAJIB** untuk wss:// |
