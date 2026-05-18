import type { Metadata, Viewport } from 'next';
import { BottomNav } from '@/components/BottomNav';
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar';
import './globals.css';

export const metadata: Metadata = {
  title: 'Gossoko — Find the best tradie feed near the site.',
  description: 'Community reviews of cafés, coffee vans, servos and food trucks — rated for what matters on a worksite: speed, feed size, ute parking, and an early open.',
  applicationName: 'Gossoko',
  // App-Router-native manifest reference — Next.js auto-routes /manifest.webmanifest
  // to the manifest.ts module.
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Gossoko',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  // Safety orange for browser / OS chrome on mobile so the app visually owns
  // the status bar when launched from home screen.
  themeColor: '#FF7A00',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  userScalable: true,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-frame">
          <main className="app-content">{children}</main>
          <BottomNav />
        </div>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
