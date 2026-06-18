import { ImageResponse } from 'next/og';
import { IconArt } from '@/lib/icon-art';

// Pre-render at build time — the icon never changes per request, so generate
// once and let the CDN serve it (the Cache-Control header below makes it
// effectively immutable at the edge).
export const dynamic = 'force-static';

export async function GET() {
  return new ImageResponse(<IconArt size={192} />, {
    width: 192,
    height: 192,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
