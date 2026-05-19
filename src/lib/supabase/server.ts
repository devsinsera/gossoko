// Server-side Supabase client for React Server Components / route handlers /
// server actions. Reads the request's cookies via next/headers so RLS evaluates
// against the signed-in user (when one exists).
//
// Defaults to the `gossoko` schema so server.from('venues') hits gossoko.venues.

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: 'gossoko' },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // RSCs can't write cookies; the writes happen in middleware. We
          // catch and swallow here so call sites in pages don't blow up.
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // No-op when called from a Server Component
          }
        },
      },
    },
  );
}
