import { ImageResponse } from 'next/og';
import { IconArt } from '@/lib/icon-art';

export const runtime = 'edge';
export const dynamic = 'force-static';

export async function GET() {
  return new ImageResponse(<IconArt size={512} />, {
    width: 512,
    height: 512,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
