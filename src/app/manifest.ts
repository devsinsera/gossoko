import type { MetadataRoute } from 'next';
import { BRAND } from '@/lib/icon-art';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.short,
    description: BRAND.description,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: BRAND.bg,
    theme_color: BRAND.orange,
    categories: ['food', 'lifestyle', 'social'],
    icons: [
      {
        src: '/icon-192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        // Maskable variant — same art, browsers may apply a circular/squircle
        // mask so safe area should already be inside the inner border.
        src: '/icon-512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Open Now',
        short_name: 'Open',
        description: 'Venues open right now',
        url: '/nearby',
        icons: [{ src: '/icon-192', sizes: '192x192' }],
      },
      {
        name: 'Top Rated',
        short_name: 'Top',
        description: 'Highest-rated venues in Brisbane',
        url: '/rankings',
        icons: [{ src: '/icon-192', sizes: '192x192' }],
      },
      {
        name: 'Search',
        short_name: 'Search',
        description: 'Find a venue by name or suburb',
        url: '/search',
        icons: [{ src: '/icon-192', sizes: '192x192' }],
      },
    ],
  };
}
