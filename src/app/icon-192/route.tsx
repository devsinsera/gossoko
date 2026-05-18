import { ImageResponse } from 'next/og';
import { IconArt } from '@/lib/icon-art';

// Cache the generated PNG aggressively — the icon never changes per request.
export const runtime = 'edge';
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
