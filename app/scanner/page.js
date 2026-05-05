'use client';

/**
 * @file app/scanner/page.js
 * @brief Halaman QR Code Scanner untuk mendeteksi DEVICE_ID kalung Ettawa-Sense.
 *
 * Flow:
 *  1. User membuka halaman /scanner
 *  2. Komponen meminta izin kamera browser
 *  3. html5-qrcode mengaktifkan scanner via video stream
 *  4. Saat QR berhasil terbaca → navigasi ke /?device={DEVICE_ID}
 *  5. Dashboard kemudian mem-filter data Socket.io berdasarkan DEVICE_ID tersebut
 *
 * Catatan:
 *  - html5-qrcode beroperasi dengan DOM manipulation langsung, sehingga
 *    WAJIB dijalankan hanya di client side ('use client').
 *  - Jika kamera tidak tersedia, html5-qrcode secara otomatis menampilkan
 *    opsi upload gambar sebagai fallback (graceful degradation).
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

/** ID elemen DOM yang akan digunakan sebagai viewport kamera oleh html5-qrcode */
const SCANNER_ELEMENT_ID = 'qr-scanner-viewport';

/** Konfigurasi kamera — preferensi kamera belakang untuk mobile UX */
const CAMERA_CONFIG = {
  fps:            10,   // Frame per second untuk proses decoding
  qrbox:          { width: 250, height: 250 }, // Area fokus scan
  aspectRatio:    1.0,  // Aspect ratio viewport video
  rememberLastUsedCamera: true,
};

export default function ScannerPage() {
  const router        = useRouter();
  const scannerRef    = useRef(null);  // Referensi ke instance Html5Qrcode
  const isMounted     = useRef(false); // Guard untuk cleanup async

  const [status, setStatus]         = useState('idle');    // idle | starting | scanning | success | error
  const [errorMsg, setErrorMsg]     = useState('');
  const [scannedId, setScannedId]   = useState('');

  /**
   * Callback saat QR berhasil terbaca.
   * Menghentikan scanner lalu navigasi ke dashboard dengan DEVICE_ID.
   * Dibungkus useCallback agar referensi stabil dan tidak re-run effect.
   */
  const handleScanSuccess = useCallback(async (decodedText) => {
    if (!isMounted.current) return;

    const trimmed = decodedText.trim();
    setScannedId(trimmed);
    setStatus('success');

    // Hentikan scanner sebelum navigasi
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop();
      }
    } catch (e) {
      // Abaikan error stop — navigasi tetap dilanjutkan
    }

    // Beri jeda singkat agar user bisa melihat konfirmasi visual
    setTimeout(() => {
      router.push(`/?device=${encodeURIComponent(trimmed)}`);
    }, 1200);
  }, [router]);

  /**
   * Inisialisasi dan start scanner.
   * Dijalankan only di client-side setelah komponen mount.
   */
  useEffect(() => {
    isMounted.current = true;

    let htmlScanner = null;

    async function startScanner() {
      setStatus('starting');

      try {
        // Dynamic import — html5-qrcode menggunakan window/document API
        // sehingga tidak boleh di-import di top level (akan gagal di SSR)
        const { Html5Qrcode } = await import('html5-qrcode');

        htmlScanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
        scannerRef.current = htmlScanner;

        await htmlScanner.start(
          { facingMode: 'environment' }, // Kamera belakang (mobile-first)
          CAMERA_CONFIG,
          handleScanSuccess,
          undefined // onScanFailure — tidak perlu handler, scan terus berjalan
        );

        if (isMounted.current) {
          setStatus('scanning');
        }
      } catch (err) {
        if (!isMounted.current) return;
        console.error('[Scanner] Gagal start:', err);
        setErrorMsg(err?.message ?? 'Gagal mengakses kamera. Pastikan izin kamera sudah diaktifkan.');
        setStatus('error');
      }
    }

    startScanner();

    // Cleanup: hentikan scanner saat komponen unmount
    return () => {
      isMounted.current = false;
      if (scannerRef.current) {
        try {
          scannerRef.current.stop().catch(() => {});
        } catch (e) {
          // Abaikan error "Cannot stop, scanner is not running or paused"
        }
        scannerRef.current = null;
      }
    };
  }, [handleScanSuccess]);

  return (
    <div className="scanner-page">
      {/* ── Header ──────────────────────────────────────────── */}
      <header className="scanner-header">
        <div className="scanner-header-inner">
          <Link href="/" className="back-btn" aria-label="Kembali ke dashboard">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m7-7-7 7 7 7" />
            </svg>
            <span>Dashboard</span>
          </Link>
          <div className="scanner-title-group">
            <span className="scanner-icon">📡</span>
            <h1 className="scanner-title">Scan Smart Collar</h1>
          </div>
          <div style={{ width: 96 }} /> {/* Spacer untuk centering */}
        </div>
      </header>

      {/* ── Main Content ────────────────────────────────────── */}
      <main className="scanner-main">
        {/* Instruksi */}
        <p className="scanner-subtitle">
          Arahkan kamera ke <strong>QR Code</strong> pada kalung kambing
        </p>

        {/* Viewport Kamera */}
        <div className="scanner-card">
          <div className="scanner-viewport-wrapper">
            {/* Elemen target html5-qrcode — JANGAN hapus atau pindahkan */}
            <div id={SCANNER_ELEMENT_ID} className="scanner-viewport" />

            {/* Overlay sudut dekoratif */}
            <div className="scanner-corner scanner-corner--tl" />
            <div className="scanner-corner scanner-corner--tr" />
            <div className="scanner-corner scanner-corner--bl" />
            <div className="scanner-corner scanner-corner--br" />

            {/* Status overlay di atas kamera */}
            {status === 'starting' && (
              <div className="scanner-overlay">
                <div className="scanner-spinner" />
                <p className="scanner-overlay-text">Mengaktifkan kamera...</p>
              </div>
            )}
            {status === 'success' && (
              <div className="scanner-overlay scanner-overlay--success">
                <div className="scanner-success-icon">✓</div>
                <p className="scanner-overlay-text">Kalung <strong>{scannedId}</strong> ditemukan!</p>
                <p className="scanner-overlay-subtext">Membuka dashboard...</p>
              </div>
            )}
            {status === 'error' && (
              <div className="scanner-overlay scanner-overlay--error">
                <div className="scanner-error-icon">!</div>
                <p className="scanner-overlay-text">Kamera tidak tersedia</p>
              </div>
            )}
          </div>

          {/* Status info di bawah scanner */}
          <div className="scanner-status-bar">
            {status === 'scanning' && (
              <>
                <span className="scanner-dot scanner-dot--pulse" />
                <span className="scanner-status-text scanning">Memindai...</span>
              </>
            )}
            {status === 'starting' && (
              <>
                <span className="scanner-dot scanner-dot--idle" />
                <span className="scanner-status-text">Mempersiapkan kamera</span>
              </>
            )}
            {status === 'success' && (
              <>
                <span className="scanner-dot scanner-dot--success" />
                <span className="scanner-status-text success">Berhasil: {scannedId}</span>
              </>
            )}
            {status === 'error' && (
              <>
                <span className="scanner-dot scanner-dot--error" />
                <span className="scanner-status-text error">{errorMsg}</span>
              </>
            )}
          </div>
        </div>

        {/* Tips penggunaan */}
        <div className="scanner-tips">
          <h2 className="scanner-tips-title">💡 Tips</h2>
          <ul className="scanner-tips-list">
            <li>Pastikan QR Code pada kalung terlihat dan tidak tertutup</li>
            <li>Dekatkan kamera ±10–20 cm dari QR Code</li>
            <li>Gunakan pencahayaan yang cukup</li>
          </ul>
        </div>

        {/* Error recovery */}
        {status === 'error' && (
          <button
            className="scanner-retry-btn"
            onClick={() => window.location.reload()}
            aria-label="Coba lagi akses kamera"
          >
            Coba Lagi
          </button>
        )}
      </main>

      {/* ── Styles ── */}
      <style>{`
        .scanner-page {
          min-height: 100vh;
          background: var(--bg-base, #0a1628);
          color: #e2e8f0;
          font-family: 'Inter', system-ui, sans-serif;
          display: flex;
          flex-direction: column;
        }

        /* Header */
        .scanner-header {
          padding: 1rem 1.5rem;
          border-bottom: 1px solid rgba(34, 211, 238, 0.12);
          background: rgba(8, 145, 178, 0.06);
          backdrop-filter: blur(12px);
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .scanner-header-inner {
          max-width: 640px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .back-btn {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          color: rgba(34, 211, 238, 0.8);
          text-decoration: none;
          font-size: 0.875rem;
          font-weight: 500;
          padding: 0.4rem 0.75rem;
          border-radius: 0.5rem;
          border: 1px solid rgba(34, 211, 238, 0.2);
          transition: all 0.2s;
          width: 96px;
        }
        .back-btn:hover {
          background: rgba(34, 211, 238, 0.1);
          color: #22d3ee;
        }
        .scanner-title-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .scanner-icon { font-size: 1.25rem; }
        .scanner-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: #e2e8f0;
          margin: 0;
        }

        /* Main */
        .scanner-main {
          flex: 1;
          max-width: 640px;
          width: 100%;
          margin: 0 auto;
          padding: 2rem 1.25rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
        }
        .scanner-subtitle {
          text-align: center;
          color: rgba(226, 232, 240, 0.7);
          font-size: 0.9rem;
          margin: 0;
        }
        .scanner-subtitle strong { color: #22d3ee; }

        /* Card */
        .scanner-card {
          width: 100%;
          background: rgba(8, 145, 178, 0.06);
          border: 1px solid rgba(34, 211, 238, 0.15);
          border-radius: 1.25rem;
          backdrop-filter: blur(16px);
          overflow: hidden;
        }

        /* Viewport */
        .scanner-viewport-wrapper {
          position: relative;
          width: 100%;
          aspect-ratio: 1 / 1;
          max-width: 360px;
          margin: 1.5rem auto 0;
          border-radius: 1rem;
          overflow: hidden;
        }
        .scanner-viewport {
          width: 100%;
          height: 100%;
        }
        /* Override html5-qrcode internal styles */
        .scanner-viewport > video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          border-radius: 1rem !important;
        }

        /* Corner brackets dekoratif */
        .scanner-corner {
          position: absolute;
          width: 24px;
          height: 24px;
          border-color: #22d3ee;
          border-style: solid;
          z-index: 2;
          pointer-events: none;
        }
        .scanner-corner--tl { top: 8px; left: 8px; border-width: 3px 0 0 3px; border-radius: 4px 0 0 0; }
        .scanner-corner--tr { top: 8px; right: 8px; border-width: 3px 3px 0 0; border-radius: 0 4px 0 0; }
        .scanner-corner--bl { bottom: 8px; left: 8px; border-width: 0 0 3px 3px; border-radius: 0 0 0 4px; }
        .scanner-corner--br { bottom: 8px; right: 8px; border-width: 0 3px 3px 0; border-radius: 0 0 4px 0; }

        /* Overlay states */
        .scanner-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          background: rgba(10, 22, 40, 0.88);
          backdrop-filter: blur(4px);
          z-index: 3;
          border-radius: 1rem;
        }
        .scanner-overlay--success { background: rgba(5, 150, 105, 0.88); }
        .scanner-overlay--error   { background: rgba(239, 68, 68, 0.88); }
        .scanner-overlay-text {
          color: #e2e8f0;
          font-size: 0.95rem;
          font-weight: 600;
          text-align: center;
          margin: 0;
        }
        .scanner-overlay-subtext {
          color: rgba(226, 232, 240, 0.7);
          font-size: 0.8rem;
          margin: 0;
        }

        /* Spinner */
        .scanner-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(34, 211, 238, 0.2);
          border-top-color: #22d3ee;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Success/Error icons */
        .scanner-success-icon {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: rgba(52, 211, 153, 0.2);
          border: 2px solid #34d399;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          color: #34d399;
          animation: pop 0.3s ease-out;
        }
        .scanner-error-icon {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: rgba(239, 68, 68, 0.2);
          border: 2px solid #ef4444;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          color: #ef4444;
          font-weight: 700;
        }
        @keyframes pop {
          from { transform: scale(0.6); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }

        /* Status bar */
        .scanner-status-bar {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.875rem 1rem;
          border-top: 1px solid rgba(34, 211, 238, 0.08);
        }
        .scanner-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .scanner-dot--pulse {
          background: #22d3ee;
          animation: pulse 1.2s ease-in-out infinite;
        }
        .scanner-dot--idle    { background: rgba(226, 232, 240, 0.3); }
        .scanner-dot--success { background: #34d399; }
        .scanner-dot--error   { background: #ef4444; }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.5; transform: scale(0.8); }
        }
        .scanner-status-text {
          font-size: 0.8rem;
          color: rgba(226, 232, 240, 0.6);
        }
        .scanner-status-text.scanning { color: #22d3ee; }
        .scanner-status-text.success  { color: #34d399; }
        .scanner-status-text.error    { color: #ef4444; }

        /* Tips */
        .scanner-tips {
          width: 100%;
          background: rgba(8, 145, 178, 0.04);
          border: 1px solid rgba(34, 211, 238, 0.1);
          border-radius: 1rem;
          padding: 1rem 1.25rem;
        }
        .scanner-tips-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: rgba(226, 232, 240, 0.8);
          margin: 0 0 0.5rem;
        }
        .scanner-tips-list {
          margin: 0;
          padding-left: 1.25rem;
          color: rgba(226, 232, 240, 0.55);
          font-size: 0.8rem;
          line-height: 1.7;
        }

        /* Retry button */
        .scanner-retry-btn {
          padding: 0.75rem 2rem;
          background: linear-gradient(135deg, #0891b2, #059669);
          border: none;
          border-radius: 0.75rem;
          color: #fff;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.2s;
        }
        .scanner-retry-btn:hover  { opacity: 0.9; transform: translateY(-1px); }
        .scanner-retry-btn:active { transform: translateY(0); }
      `}</style>
    </div>
  );
}
