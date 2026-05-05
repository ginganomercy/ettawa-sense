# Rencana Implementasi Web Dashboard: Ettawa-Sense
**Proyek:** Animal Smart Collar (Kambing Etawa Stress Detection)
**Arsitektur:** Real-Time IoT Telemetry System
**Tema Visual:** Dark Glassmorphism with Blue-Teal Gradient (Biru–Hijau)

**Palet Warna:**
| Token | Hex | Penggunaan |
|---|---|---|
| `--primary` | `#0891b2` (Teal-600) | CTA, border aktif, tombol utama |
| `--primary-light` | `#22d3ee` (Cyan-400) | Glow effect, highlight |
| `--secondary` | `#059669` (Emerald-600) | Status normal, badge sukses |
| `--secondary-light` | `#34d399` (Emerald-400) | Chart line, aksen data |
| `--accent` | `#06b6d4` (Cyan-500) | Ikon, link, sparkline |
| `--bg-base` | `#0a1628` (Navy gelap) | Background utama |
| `--bg-surface` | `#0f2337` (Navy medium) | Card, panel |
| `--glass` | `rgba(8,145,178,0.08)` | Glassmorphism overlay |
| `--glass-border` | `rgba(34,211,238,0.15)` | Border kaca |

---

## 🏗️ 1. Arsitektur Teknologi (Tech Stack) Standar Industri

Untuk memastikan web tidak *crash* saat menerima data terus-menerus dari ESP32, kita memisahkan sistem menjadi 3 lapisan (*3-Tier Architecture*):

1. **Message Broker (Jalur Data):** **MQTT (EMQX / HiveMQ)**. Sangat ringan, dirancang khusus untuk perangkat IoT dengan sinyal tidak stabil.
2. **Backend Server & Database:** * **Node.js + Express + Socket.io:** Menangkap data dari MQTT dan meneruskannya langsung ke layar pengguna tanpa *refresh* (WebSocket).
   * **InfluxDB:** *Time-Series Database*. Jauh lebih efisien dari MySQL/PostgreSQL untuk menyimpan data suhu dan sumbu X,Y,Z yang masuk setiap detik.
3. **Frontend Dashboard:** **Next.js (React) + Tailwind CSS + Recharts**. Stabil, modern, dan sangat mudah untuk membuat grafik *real-time* yang mulus.

---

## 🛠️ 2. Tahap 1: Setup Backend Server (Node.js)

Backend bertugas sebagai "jembatan" antara ESP32 (via MQTT) dan Web (via WebSocket), serta menyimpan riwayat ke database.

**Langkah Eksekusi:**
1. Buat folder `ettawa-backend`, buka terminal di folder tersebut.
2. Inisialisasi proyek:
   ```bash
   npm init -y