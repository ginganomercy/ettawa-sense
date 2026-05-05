# Ettawa-Sense — Panduan Deploy ke Bare Metal Debian

## Arsitektur Deploy

```
GitHub Actions
  ├── Build Docker image (Next.js + Express + Aedes MQTT + Socket.io)
  ├── Push ke GitHub Container Registry (ghcr.io)
  └── SSH via Tailscale ke server Debian
        ├── docker compose pull (ambil image baru)
        └── docker compose up -d (restart container)

Server Debian
  └── Nginx (reverse proxy :80/:443 → :5151)
        └── Docker container [ettawa] port 5151
              └── Node.js monolith server.js
```

---

## Prasyarat

| Kebutuhan | Detail |
|-------|-------|
| Docker & Docker Compose | Terinstall di server Debian |
| Nginx | Sudah configured dengan `upstream ettawa { server 127.0.0.1:5151; }` |
| Tailscale | Terinstall di server, sudah join network |
| Repository Secrets | `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, `DEPLOY_PATH`, `GHCR_PAT`, `TAILSCALE_AUTHKEY` |

---

## Setup Awal Server (Sekali Saja)

### 1. Copy `docker-compose.yml` ke server

Dari komputer lokal Anda, copy file ke server via SCP:

```bash
scp ettawa-web/docker-compose.yml <SSH_USER>@<SSH_HOST>:/opt/ettawa/
```

Atau jika menggunakan Tailscale IP server:
```bash
scp ettawa-web/docker-compose.yml user@100.x.x.x:/opt/ettawa/
```

> **Catatan:** Setelah pipeline CI/CD pertama berjalan, `docker-compose.yml` akan otomatis diperbarui via SCP setiap push ke `master`. Setup manual hanya diperlukan sekali.

### 2. Buat file `.env` production di server

SSH ke server lalu buat `.env`:

```bash
ssh <SSH_USER>@<SSH_HOST>
cd /opt/ettawa
nano .env
```

Isi semua nilai `<GANTI_...>` dengan nilai asli. Penting:

```env
NODE_ENV=production
PORT=5151
NEXT_PUBLIC_BACKEND_URL=https://ettawa-sakra.momoi.my.id
API_KEY=<random 64 char hex>
NEXT_PUBLIC_API_KEY=<nilai sama dengan API_KEY>
MQTT_USERNAME=<username yang sama dengan config.h ESP32>
MQTT_PASSWORD=<password yang sama dengan config.h ESP32>
MQTT_BROKER_URL=ws://127.0.0.1:5151/mqtt
ALLOWED_ORIGINS=https://ettawa-sakra.momoi.my.id
```

Generate API Key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Jalankan container pertama kali secara manual

```bash
cd /opt/ettawa/ettawa-web

# Login ke GHCR
echo "<GHCR_PAT>" | docker login ghcr.io -u <github_username> --password-stdin

# Pull dan jalankan
GHCR_REPO=<username>/<repo> docker compose pull
GHCR_REPO=<username>/<repo> docker compose up -d

# Verifikasi
curl http://localhost:5151/api/health
# Expected: {"ok":true,"service":"ettawa-sense-monolith",...}
```

---

## Deploy Otomatis (CI/CD)

Setiap push ke branch `master` akan:
1. Build Docker image dari `frontend/Dockerfile`
2. Push ke `ghcr.io/<username>/<repo>:latest`
3. SSH ke server via Tailscale
4. Pull image baru + restart container
5. Verifikasi `/api/health`

Tidak ada langkah manual. Monitor di tab **Actions** di GitHub.

---

## Update Firmware ESP32 (Wajib setelah pertama deploy)

Edit `ettawa-iot/include/config.h`:

```cpp
// [PRODUCTION] ✅ AKTIF
constexpr char MQTT_BROKER_URI[] = "wss://ettawa-sakra.momoi.my.id/mqtt";
```

Flash ulang:
```bash
cd ettawa-iot
pio run --target upload
```

---

## Verifikasi End-to-End

### Cek server berjalan
```bash
curl https://ettawa-sakra.momoi.my.id/api/health
# {"ok":true,"service":"ettawa-sense-monolith","storage_mode":"memory",...}
```

### Cek dashboard
Buka `https://ettawa-sakra.momoi.my.id?device=ES-001`
- **WS** dot → hijau (Socket.io connected)
- **MQTT** dot → hijau (Aedes broker running)
- Suhu tampil dengan badge **MOCK** (amber) saat DS18B20 tidak terpasang

### Cek koneksi ESP32
Serial Monitor setelah flash:
```
[INFO ] [MQTT-IDF] Event: CONNECTED ke WebSocket Broker!
```
Dashboard: **Collar** dot → hijau, badge **MOCK** hilang saat data real masuk.

---

## Troubleshooting

| Gejala | Kemungkinan Penyebab | Solusi |
|--------|---------------------|--------|
| Container tidak start | `.env` belum dibuat | `cp .env.production.example .env && nano .env` |
| Health check gagal | Port 5151 tidak didengar | `docker logs ettawa` — cek error startup |
| ESP32 tidak konek | `config.h` masih domain lama | Flash ulang dengan URI `wss://ettawa-sakra.momoi.my.id/mqtt` |
| Nginx 502 | Container belum ready | Tunggu 20s (start_period healthcheck) |
| SSH gagal di CI | Server belum join Tailscale | `tailscale status` di server |
| GHCR pull 401 | `GHCR_PAT` expired | Generate PAT baru di GitHub → Settings → Developer settings |

---

## Catatan Penting

| Item | Development | Production (Bare Metal) |
|------|-------------|------------------------|
| URI ESP32 | `ws://192.168.x.x:3000/mqtt` | `wss://ettawa-sakra.momoi.my.id/mqtt` |
| Port app | 3000 | **5151** (sesuai nginx upstream) |
| Server start | `npm run dev` | `docker compose up -d` |
| Auto-restart | Manual | Docker `restart: unless-stopped` |
| SSL | Tidak perlu | Nginx handle TLS termination |
| Mock data suhu | Otomatis (dev mode) | `USE_MOCK_DATA=false` di `.env` |
