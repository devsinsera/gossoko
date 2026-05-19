// Browser-side Supabase client. Use this in 'use client' components only.
// Defaults to the `gossoko` schema so client.from('venues') hits gossoko.venues.

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: 'gossoko' } },
  );
}
