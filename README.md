# 💻 Ettawa-Sense Web Console & AI Engine

Struktur aplikasi sisi *Software* dari Ettawa-Sense. Proyek ini membelah arsitektur ke dalam 3 *Service Layer* independen untuk menangani skala komputasi I/O besar dari aliran sensor Internet-of-Things:

1. **Frontend (Next.js 13 App Router):** Server-Side React UI Client berlapis performa tinggi.
2. **Backend (Node.js + Socket.io):** Sistem Relay/Gateway data asinkron dari sistem MQTT Global menuju koneksi web private.
3. **AI Engine (Python + SciPy):** Mikroservis Pemrosesan Sinyal Digital khusus (*Digital Signal Processing/DSP*) untuk memecahkan *Seismocardiography* dan melahirkan estimasi Detak Jantung Heart-Rate (BPM) pada hitungan 50 Hz.

---

## 🏗 Struktur Proyek
```
ettawa-web/
├── frontend/   # Berjalan pada :3000 (React / TailwindCSS)
├── backend/    # Berjalan pada :3001 (Express / Socket.io / MQTT Client)
└── ai/         # Berjalan *headless*  (Python SciPy Filter & Peak Detection)
```

## 🚀 Cara Menjalankan Keseluruhan Sistem

Untuk beroperasi dengan normal, Anda harus memisahkan tugas terminal dan menjalankan **ketiga layanan ini secara bersamaan** (*Running concurrently*). Buka 3 Jendela Terminal/PowerShell yang berbeda:

### Terminal 1: Backend Node.js
Bertugas sebagai tulang punggung WebSocket dan Data Store (*Relay & Database*).
```shell
cd ettawa-web\backend
npm install
npm run dev
```
👉 *Biarkan terminal ini terbuka. Backend akan memanggil `[MQTT] Connected` di `localhost:3001`*.

### Terminal 2: Edge AI Service (Python)
Kecerdasan pengolah sinyal (*Seismocardiography BPM Extractor*). Karena menangani data *SciPy*, jalankan ini di skema *Virtual Environment (vEnv)*.
```shell
cd ettawa-web\ai

# Buat env isolasi
python -m venv .venv
# Aktifkan (Windows)
.venv\Scripts\activate

# Install dependency numerik dan library MQTT
pip install -r requirements.txt

# Nyalakan Mesin AI!
python main.py
```
👉 *Terminal akan membedah topik `scg_stream` masuk secara infinity-loop.*

### Terminal 3: UI Dashboard (Next.js Frontend)
Berurusan dengan komponen Visual, Widget Card, Animasi CSS, dan Dynamic Routing QR Code.
```shell
cd ettawa-web\frontend
npm install
npm run dev
```
👉 *Buka link `http://localhost:3000/scanner`, lalu siapkan HP untuk menyorot Identitas QR ESP32 Anda.*

---

## 🔎 Tentang Parameter URL `?device=`
Dashboard memiliki kemampuan mem-`filter` aliran data dari ribuan kalung MQTT di Node Gateway. Namun, Node Gateway merutekan semua datanya (*broadcasting*). Beban *filtering* ditarik di sisi `SocketContext.js` React.
Jika Anda tidak melewati menu *QR Scanner*, pastikan URL Anda memuat parameter kalung IoT yang valid!
**Contoh:** `http://localhost:3000/?device=ES-001`
*(ES-001 adalah tag hardware keras dari C++ `#define DEVICE_ID` di ESP32).*
