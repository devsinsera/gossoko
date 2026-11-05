// Build-time configuration. The anon key is public by design (RLS enforces access).
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** New and edited reviews/comments wait for a moderator when this is on. */
export const REVIEW_PREMODERATION = import.meta.env.VITE_GOSSOKO_REVIEW_PREMODERATION === 'true';

/** Where the app lives, e.g. https://sinsera.co/gossoko — used in emailed links. */
export function siteUrl(): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${window.location.origin}${base}`;
}

export const KEYCHAIN_SERVER = 'sinsera.co/gossoko';
