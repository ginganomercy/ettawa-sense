/** @type {import('next').NextConfig} */
const nextConfig = {
  // Custom server.js digunakan untuk monolith,
  // jadi tidak perlu output: "standalone" dari Next.js.

  // Matikan header "X-Powered-By: Next.js" untuk production security.
  poweredByHeader: false,

  // Compress responses (gzip) — penting untuk performa di cPanel shared hosting.
  compress: true,

  // Paket server-side yang tidak boleh di-bundle oleh webpack.
  // Aedes, ws, mqtt adalah native Node.js modules yang hanya jalan di server.
  // Memasukkan ke sini mencegah error "Module not found" di browser bundle.
  serverExternalPackages: ['aedes', 'ws', 'mqtt', 'aedes-persistence', 'mqemitter'],
  // Silence warning "Next.js inferred your workspace root" yang muncul
  // karena ada package-lock.json di parent directory (~/).
  // Root diarahkan ke direktori project ini.
  turbopack: {
    root: '.',
  },
};

export default nextConfig;
