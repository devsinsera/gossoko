import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { isNativeShell, salesRouteTarget, type SalesPage, type ShellGlobals } from '@/site/native';
import { COLORS } from '@/lib/theme';
import NotFound from './not-found';

/**
 * /about and /business inside the app. The real pages are static files (about/, business/) the
 * server serves before the app; this only catches an in-app navigation. Web: load the static page.
 * Phone apps: back to the feed, so no price is ever reachable in the apps.
 */
export default function SalesRedirect({ page }: { page: SalesPage }) {
  const target = salesRouteTarget(page, isNativeShell(globalThis as ShellGlobals), import.meta.env.BASE_URL);
  const href = target.kind === 'load' ? target.href : null;
  // Already at the static page's address but got the app: the page isn't on the server. Don't loop.
  const here = typeof window !== 'undefined' && href !== null && window.location.pathname === href;
  useEffect(() => {
    if (href && !here) window.location.replace(href);
  }, [href, here]);
  if (target.kind === 'app') return <Navigate to={target.to} replace />;
  if (here) return <NotFound />;
  return <div style={{ minHeight: '100vh', background: COLORS.bg }} />;
}
