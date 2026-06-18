// Service-role Supabase client. BYPASSES Row Level Security — use only on the
// server, and only after `requirePermission()` has authorised the caller.
//
// Required for inserts into tables whose RLS only allows `auth.uid() IS NULL`
// (e.g. audit_logs). If SUPABASE_SERVICE_ROLE_KEY is not set, returns null so
// callers can degrade gracefully (skip audit logging).

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

// Loose typing: no generated Database type yet, and we mainly need .from()
// access. `any` here is contained to the service-role boundary.
type AdminClient = SupabaseClient<any, any, any>;

let cached: AdminClient | null | undefined;

export function getAdminClient(): AdminClient | null {
  if (cached !== undefined) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    cached = null;
    return null;
  }

  cached = createSupabaseClient(url, key, {
    db: { schema: 'gossoko' },
    auth: { persistSession: false, autoRefreshToken: false },
  }) as AdminClient;
  return cached;
}
