import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display:  'swap',
});

export const metadata = {
  title: 'Ettawa-Sense — Smart Goat Collar Dashboard',
  description:
    'Dashboard monitoring real-time stres kambing Etawa — IoT Smart Collar berbasis ESP32, MQTT, dan sensor biometrik.',
  keywords: ['IoT', 'ettawa', 'kambing', 'stress detection', 'MQTT', 'ESP32', 'real-time'],
  // Mobile/PWA tags
  themeColor:   '#0891b2',
  appleWebApp: {
    capable:         true,
    title:           'Ettawa-Sense',
    statusBarStyle:  'black-translucent',
  },
  viewport: {
    width:              'device-width',
    initialScale:       1,
    maximumScale:       1,
    userScalable:       false,
    viewportFit:        'cover',   // safe area for notch / Dynamic Island
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={inter.variable}>
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
