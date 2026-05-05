'use client';

/**
 * @file app/page.js
 * @brief Root page — Dashboard Ettawa-Sense dengan filter per DEVICE_ID.
 *
 * Flow:
 *  1. Baca URL parameter `?device=` via useSearchParams
 *  2. Jika tidak ada → tampilkan ScanPromptScreen (CTA ke /scanner)
 *  3. Jika ada → render Dashboard dengan SocketProvider yang sudah difilter
 *     per device_id kalung yang dipilih
 *
 * Mengapa filter di sini, bukan di setiap komponen?
 *   SocketProvider menerima deviceId sebagai prop dan memfilter di level
 *   context. Semua komponen turunan (TempGauge, AccelChart, dll.) secara
 *   otomatis hanya menerima data yang relevan tanpa perlu logika tambahan.
 */

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSocket, SocketProvider } from '@/context/SocketContext';
import DeviceStatus from '@/components/DeviceStatus';
import TempGauge from '@/components/TempGauge';
import StressCard from '@/components/StressCard';
import HeartRateCard from '@/components/HeartRateCard';
import AccelChart from '@/components/AccelChart';
import AlertFeed from '@/components/AlertFeed';
import HistoryChart from '@/components/HistoryChart';
import Link from 'next/link';

/* ══════════════════════════════════════════════════════════════════
   SCAN PROMPT — Muncul saat belum ada DEVICE_ID di URL
   ══════════════════════════════════════════════════════════════════ */
function ScanPromptScreen() {
  return (
    <div className="scan-prompt-page">
      <div className="scan-prompt-card">
        {/* Icon */}
        <div className="scan-prompt-icon-wrapper">
          <span className="scan-prompt-icon">🐐</span>
          <div className="scan-prompt-ring" />
        </div>

        {/* Text */}
        <div className="scan-prompt-text">
          <h1 className="scan-prompt-title">Ettawa-Sense</h1>
          <p className="scan-prompt-sub">Smart Goat Collar Dashboard</p>
          <p className="scan-prompt-desc">
            Scan QR Code pada kalung kambing untuk mulai memantau data real-time.
          </p>
        </div>

        {/* CTA */}
        <Link href="/scanner" className="scan-prompt-btn" id="scan-qr-btn">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 7V5a2 2 0 012-2h2m10 0h2a2 2 0 012 2v2M3 17v2a2 2 0 002 2h2m10 0h2a2 2 0 002-2v-2M7 7h3v3H7zm7 0h3v3h-3zm-7 7h3v3H7zm7 0h3v3h-3z" />
          </svg>
          <span>Scan QR Smart Collar</span>
        </Link>

        {/* Tips */}
        <div className="scan-prompt-tips">
          <p className="scan-prompt-tips-title">📍 Cara Penggunaan</p>
          <ol className="scan-prompt-tips-list">
            <li>Klik tombol "Scan QR Smart Collar" di atas</li>
            <li>Izinkan akses kamera saat diminta</li>
            <li>Arahkan kamera ke QR Code pada kalung</li>
            <li>Dashboard akan terbuka otomatis</li>
          </ol>
        </div>
      </div>

      <p className="scan-prompt-footer">Ettawa-Sense v1.0 · ESP32 + DS18B20 + MPU6050</p>

      <style>{`
        .scan-prompt-page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          background: linear-gradient(145deg, #0a1628 0%, #0d1f35 100%);
          gap: 1.25rem;
        }
        .scan-prompt-card {
          width: 100%;
          max-width: 380px;
          background: rgba(8, 145, 178, 0.06);
          border: 1px solid rgba(34, 211, 238, 0.15);
          border-radius: 1.5rem;
          padding: 2rem 1.5rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
          backdrop-filter: blur(16px);
          box-shadow: 0 0 60px rgba(8, 145, 178, 0.08);
        }
        .scan-prompt-icon-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .scan-prompt-icon {
          width: 72px;
          height: 72px;
          background: linear-gradient(135deg, #0891b2, #059669);
          border-radius: 1.25rem;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          box-shadow: 0 8px 32px rgba(8, 145, 178, 0.3);
          animation: float 3s ease-in-out infinite;
        }
        .scan-prompt-ring {
          position: absolute;
          inset: -8px;
          border-radius: 1.5rem;
          border: 1.5px solid rgba(34, 211, 238, 0.25);
          animation: ringPulse 2.5s ease-in-out infinite;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-6px); }
        }
        @keyframes ringPulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50%       { opacity: 0.7; transform: scale(1.04); }
        }
        .scan-prompt-text { text-align: center; }
        .scan-prompt-title {
          font-size: 1.5rem;
          font-weight: 800;
          background: linear-gradient(135deg, #22d3ee, #34d399);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin: 0;
        }
        .scan-prompt-sub {
          font-size: 0.8rem;
          color: rgba(226, 232, 240, 0.5);
          margin: 0.25rem 0 0.75rem;
        }
        .scan-prompt-desc {
          font-size: 0.875rem;
          color: rgba(226, 232, 240, 0.7);
          line-height: 1.6;
          margin: 0;
        }
        .scan-prompt-btn {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.875rem 1.75rem;
          background: linear-gradient(135deg, #0891b2, #059669);
          border-radius: 0.875rem;
          color: #fff;
          font-size: 0.95rem;
          font-weight: 700;
          text-decoration: none;
          transition: opacity 0.2s, transform 0.2s;
          box-shadow: 0 4px 20px rgba(8, 145, 178, 0.35);
          width: 100%;
          justify-content: center;
        }
        .scan-prompt-btn:hover  { opacity: 0.92; transform: translateY(-2px); box-shadow: 0 6px 28px rgba(8, 145, 178, 0.45); }
        .scan-prompt-btn:active { transform: translateY(0); }
        .scan-prompt-tips {
          width: 100%;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(34, 211, 238, 0.08);
          border-radius: 0.875rem;
          padding: 0.875rem 1rem;
        }
        .scan-prompt-tips-title {
          font-size: 0.8rem;
          font-weight: 700;
          color: rgba(226, 232, 240, 0.7);
          margin: 0 0 0.5rem;
        }
        .scan-prompt-tips-list {
          margin: 0;
          padding-left: 1.25rem;
          color: rgba(226, 232, 240, 0.5);
          font-size: 0.775rem;
          line-height: 1.75;
        }
        .scan-prompt-footer {
          font-size: 0.72rem;
          color: rgba(226, 232, 240, 0.3);
          margin: 0;
        }
      `}</style>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   CONNECTING SCREEN
   ══════════════════════════════════════════════════════════════════ */
function ConnectingScreen({ deviceId }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-6 fade-in"
      style={{ background: 'linear-gradient(145deg,#f0f9ff 0%,#ecfdf5 100%)' }}>

      {/* Logo */}
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl float shadow-lg"
          style={{ background: 'linear-gradient(135deg,#0891b2,#059669)' }}
        >🐐</div>
        <div className="text-center">
          <h1 className="text-2xl font-black gradient-text">Ettawa-Sense</h1>
          <p className="text-slate-400 text-sm mt-0.5">Smart Goat Collar Dashboard</p>
        </div>
      </div>

      {/* Spinner */}
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full spinner"
          style={{ border: '3px solid #e0f2f1', borderTop: '3px solid #0891b2' }} />
        <div className="text-center">
          <p className="text-slate-700 text-sm font-semibold">Menghubungkan ke Backend...</p>
          {deviceId && (
            <p className="text-teal-600 text-xs mt-0.5 font-mono font-bold">
              Kalung: {deviceId}
            </p>
          )}
          <p className="text-slate-400 text-xs mt-0.5">
            URL Backend: <code className="text-teal-600 font-mono">{process.env.NEXT_PUBLIC_BACKEND_URL || 'unknown'}</code>
          </p>
        </div>
      </div>

      {/* Checklist */}
      <div className="glass-card p-4 w-full max-w-xs flex flex-col gap-3">
        <ConnectStep label="Monolith Server" hint="cd ettawa-web/frontend → npm run dev" />
        <ConnectStep label="MQTT Broker (Aedes)" hint="ws://localhost:3000/mqtt (embedded)" />
        <ConnectStep
          label={`ESP32 Kalung ${deviceId ?? '—'}`}
          hint={`ettawa/collar/${deviceId ?? '+'}/telemetry`}
        />
      </div>

      {/* Back to scan */}
      <Link href="/scanner"
        style={{ color: '#0891b2', fontSize: '0.8rem', textDecoration: 'underline' }}>
        Ganti kalung (scan ulang)
      </Link>

      <p className="text-slate-400 text-xs">Ettawa-Sense v1.0 · ESP32 + DS18B20 + MPU6050</p>
    </div>
  );
}

function ConnectStep({ label, hint }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-5 h-5 rounded-full flex items-center justify-center bg-teal-50 border border-teal-100 flex-shrink-0 mt-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
      </span>
      <div>
        <p className="text-sm text-slate-700 font-semibold">{label}</p>
        <p className="text-xs text-slate-400 font-mono">{hint}</p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   HEADER
   ══════════════════════════════════════════════════════════════════ */
function Header({ deviceId }) {
  const { wsConnected, mqttConnected, deviceStatus } = useSocket();
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-4 py-3"
      style={{
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(8,145,178,0.10)',
        boxShadow: '0 1px 8px rgba(8,145,178,0.06)',
      }}>
      {/* Brand + Device ID */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0 shadow"
          style={{ background: 'linear-gradient(135deg,#0891b2,#059669)' }}>
          🐐
        </div>
        <div>
          <h1 className="text-sm font-black gradient-text leading-none">Ettawa-Sense</h1>
          <p className="text-xs text-slate-400">
            {deviceId
              ? <span className="font-mono font-bold text-teal-600">{deviceId}</span>
              : 'Smart Collar Dashboard'
            }
          </p>
        </div>
      </div>

      {/* Status dots + Scan button */}
      <div className="flex items-center gap-1.5">
        <Dot ok={wsConnected} title="WS" />
        <Dot ok={mqttConnected} title="MQTT" />
        <Dot ok={deviceStatus.online} title="Collar" />
        <Link href="/scanner"
          className="ml-1 px-2 py-1 rounded-full text-[10px] font-bold"
          style={{
            background: 'rgba(8,145,178,0.08)',
            border: '1px solid rgba(8,145,178,0.2)',
            color: '#0891b2',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
          title="Ganti kalung"
          id="change-collar-btn"
        >
          <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 7V5a2 2 0 012-2h2m10 0h2a2 2 0 012 2v2M3 17v2a2 2 0 002 2h2m10 0h2a2 2 0 002-2v-2" />
          </svg>
          QR
        </Link>
      </div>
    </header>
  );
}

function Dot({ ok, title }) {
  return (
    <div className="flex items-center gap-1 px-1.5 py-1 rounded-full text-[10px] font-bold"
      style={{
        background: ok ? '#cffafe' : '#f1f5f9',
        color: ok ? '#0e7490' : '#94a3b8',
        border: `1px solid ${ok ? '#a5f3fc' : '#e2e8f0'}`,
      }}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-teal-500 animate-pulse' : 'bg-slate-300'}`} />
      <span className="truncate max-w-[45px] sm:max-w-none">{title}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   DASHBOARD
   ══════════════════════════════════════════════════════════════════ */
function Dashboard({ deviceId }) {
  const { wsConnected } = useSocket();
  if (!wsConnected) return <ConnectingScreen deviceId={deviceId} />;

  return (
    /* ── Desktop: centered phone frame | Mobile: full screen ── */
    <div className="sm:min-h-screen sm:flex sm:items-start sm:justify-center sm:py-6 sm:px-4"
      style={{ background: 'linear-gradient(145deg,#e0f2fe 0%,#dcfce7 100%)' }}>
      <div
        className="
          flex flex-col min-h-screen w-full
          sm:min-h-0 sm:w-[390px] sm:rounded-[32px] sm:overflow-hidden
          sm:shadow-2xl sm:border sm:border-white/60
        "
        style={{ background: 'linear-gradient(145deg,#f0f9ff 0%,#f0fdf4 100%)' }}
      >
        <Header deviceId={deviceId} />

        <main className="flex-1 px-2.5 py-4 flex flex-col gap-2.5">

          {/* Row 1: Status + Stress */}
          <div className="grid grid-cols-2 gap-2.5 fade-in-up" style={{ animationDelay: '0ms' }}>
            <DeviceStatus />
            <StressCard />
          </div>

          {/* Row 2: HeartRate + Temp */}
          <div className="grid grid-cols-2 gap-2.5 fade-in-up" style={{ animationDelay: '40ms' }}>
            <HeartRateCard />
            <TempGauge />
          </div>

          {/* Row 3: Accel */}
          <div className="fade-in-up" style={{ animationDelay: '80ms' }}>
            <AccelChart />
          </div>

          {/* Row 4: History */}
          <div className="fade-in-up" style={{ animationDelay: '120ms' }}>
            <HistoryChart hours={24} />
          </div>

          {/* Row 4: Alerts */}
          <div className="fade-in-up" style={{ animationDelay: '180ms' }}>
            <AlertFeed />
          </div>
        </main>

        <footer className="text-center text-xs text-slate-400 py-3"
          style={{ borderTop: '1px solid rgba(8,145,178,0.08)' }}>
          <span className="gradient-text font-bold">Ettawa-Sense</span>
          {' '}v1.0 · Monitoring:{' '}
          <span className="font-mono font-semibold text-teal-600">{deviceId}</span>
        </footer>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   INNER PAGE — Membaca query param, menentukan screen yang ditampilkan
   ══════════════════════════════════════════════════════════════════ */
function InnerPage() {
  const searchParams = useSearchParams();
  // decodeURIComponent untuk handle ID yang mengandung karakter khusus
  const rawDevice = searchParams.get('device');
  const deviceId = rawDevice ? decodeURIComponent(rawDevice) : null;

  // Belum ada device yang dipilih → tampilkan CTA scan terlebih dulu
  if (!deviceId) {
    return <ScanPromptScreen />;
  }

  return (
    <SocketProvider deviceId={deviceId}>
      <Dashboard deviceId={deviceId} />
    </SocketProvider>
  );
}

/* ══════════════════════════════════════════════════════════════════
   EXPORT — Dibungkus Suspense karena useSearchParams() memerlukan ini
   di Next.js App Router agar tidak error saat streaming SSR
   ══════════════════════════════════════════════════════════════════ */
export default function Page() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0a1628', color: '#22d3ee', fontSize: '0.9rem'
      }}>
        Memuat...
      </div>
    }>
      <InnerPage />
    </Suspense>
  );
}
