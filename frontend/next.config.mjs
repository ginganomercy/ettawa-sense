import { fileURLToPath } from 'url';
import path from 'path';

// Resolusi absolute path direktori ini.
// Diperlukan agar Turbopack tidak salah deteksi workspace root ke
// C:\Users\RAFLY A.R\ (karena ada package-lock.json Laragon di sana).
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Workspace root adalah folder `ettawa-web` (1 level di atas frontend)
const workspaceRoot = path.resolve(__dirname, '..');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Matikan header "X-Powered-By: Next.js" untuk production security.
  poweredByHeader: false,

  // Compress resp`onses (gzip) — penting untuk performa di production.
  compress: true,

  // Sembunyikan logo "N" (Dev Indicator) di pojok bawah layar
  devIndicators: {
    appIsrStatus: false,
    buildActivity: false,
  },

  // Arahkan root ke workspace root (ettawa-web) agar Turbopack bisa
  // membaca dependency 'next' yang di-hoist oleh npm workspaces
  turbopack: {
    root: workspaceRoot,
  },
};

export default nextConfig;
