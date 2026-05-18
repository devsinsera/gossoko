import type { Metadata, Viewport } from 'next';
import { BottomNav } from '@/components/BottomNav';
import './globals.css';

export const metadata: Metadata = {
  title: 'Gossoko — Find the best tradie feed near the site.',
  description: 'Community reviews of cafés, coffee vans, servos and food trucks — rated for what matters on a worksite: speed, feed size, ute parking, and an early open.',
};

export const viewport: Viewport = {
  themeColor: '#0a0908',
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
      </body>
    </html>
  );
}
