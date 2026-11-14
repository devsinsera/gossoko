// Build-time configuration. The anon key is public by design (RLS enforces access).
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** New and edited reviews/comments wait for a moderator when this is on. */
export const REVIEW_PREMODERATION = import.meta.env.VITE_GOSSOKO_REVIEW_PREMODERATION === 'true';

/** The app's own folder under the site: the website is at BASE_URL, the app at BASE_URL + admin/. */
export const APP_BASE = `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}admin/`;

/** Where the app lives, e.g. https://sinsera.co/gossoko/admin — used in emailed links. */
export function siteUrl(): string {
  const base = APP_BASE.replace(/\/$/, '');
  return `${window.location.origin}${base}`;
}

export const KEYCHAIN_SERVER = 'sinsera.co/gossoko';
