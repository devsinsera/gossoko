// /gossoko/login/ — the sign-in address. The sign-in screens are part of the app, so this moves on:
// already signed in -> the app; "#start" (the website's Get started buttons) -> Create account;
// anything else -> Log in. The query and hash are kept, so emailed auth links still work.
export function loginTarget(loc: { search: string; hash: string }, signedIn: boolean): string {
  const app = '/gossoko/admin/';
  if (loc.hash === '#start') return `${app}signup${loc.search}`;
  if (loc.hash === '#shop') return `${app}signup?type=shop`;
  if (loc.hash.includes('access_token') || loc.hash.includes('type=recovery')) return `${app}auth/confirm${loc.search}${loc.hash}`;
  if (signedIn) return `${app}${loc.search}`;
  return `${app}login${loc.search}${loc.hash}`;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  let signedIn = false;
  try { signedIn = Boolean(window.localStorage.getItem('gossoko.auth')); } catch { /* private mode */ }
  window.location.replace(loginTarget(window.location, signedIn));
}
