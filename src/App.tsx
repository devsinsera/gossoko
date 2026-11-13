import { Suspense, lazy, useEffect, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { OPEN_EVENT } from '@/lib/push';
import { AuthProvider, useAuth } from '@/lib/auth';
import { configured } from '@/lib/supabase/client';
import { BottomNav } from '@/components/BottomNav';
import { DistanceProvider } from '@/components/DistanceProvider';
import { LockScreen } from '@/components/LockScreen';
import { BiometricOffer } from '@/components/BiometricOffer';
import { BrandIntro } from '@/components/BrandIntro';
import { COLORS } from '@/lib/theme';
import FeedPage from './pages/page';
import LoginPage from './pages/login/page';
import SignupPage from './pages/signup/page';
import ForgotPage from './pages/auth/forgot/page';
import ResetPage from './pages/auth/reset/page';
import ConfirmPage from './pages/auth/confirm/page';
import NotFound from './pages/not-found';

const NearbyPage = lazy(() => import('./pages/nearby/page'));
const RankingsPage = lazy(() => import('./pages/rankings/page'));
const SearchPage = lazy(() => import('./pages/search/page'));
const ProfilePage = lazy(() => import('./pages/profile/page'));
const VenuePage = lazy(() => import('./pages/venue/[slug]/page'));
const NewVenuePage = lazy(() => import('./pages/venue/new/page'));
const NewReviewPage = lazy(() => import('./pages/review/new/page'));
const NotificationsPage = lazy(() => import('./pages/notifications/page'));
const FounderPage = lazy(() => import('./pages/founder/page'));
const DealsPage = lazy(() => import('./pages/deals/page'));
const ManageIndexPage = lazy(() => import('./pages/manage/page'));
const ManageVenuePage = lazy(() => import('./pages/manage/[slug]/page'));
const AdminBusinessPage = lazy(() => import('./pages/admin/business/page'));
const AdminLayout = lazy(() => import('./pages/admin/layout'));
const ModerationPage = lazy(() => import('./pages/admin/moderation/page'));
const AdminUsersPage = lazy(() => import('./pages/admin/users/page'));

/** Scroll to top on navigation, like a page load. */
function Frame() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  // A tapped push alert asks to open a page (lib/push.ts).
  useEffect(() => {
    const go = (e: Event) => { const to = (e as CustomEvent<string>).detail; if (typeof to === 'string' && to.startsWith('/')) navigate(to); };
    window.addEventListener(OPEN_EVENT, go);
    return () => window.removeEventListener(OPEN_EVENT, go);
  }, [navigate]);
  return (
    <div className="app-frame" key={pathname.split('/')[1] || 'feed'}>
      <main className="app-content"><Outlet /></main>
      <BottomNav />
    </div>
  );
}

/** Auth screens and admin sit outside the tab frame. */
function Bare({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function Gate({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (!configured()) {
    return (
      <p style={{ padding: 24, color: COLORS.text }}>
        Gossoko isn't configured: the Supabase address and key were not built into this app.
      </p>
    );
  }
  if (status === 'loading') return <div style={{ minHeight: '100vh', background: COLORS.bg }} />;
  if (status === 'locked') return <LockScreen />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <BrandIntro />
      <AuthProvider>
        <DistanceProvider>
          <Gate>
            <Suspense fallback={<div style={{ minHeight: '100vh', background: COLORS.bg }} />}>
              <Routes>
                <Route element={<Frame />}>
                  <Route index element={<FeedPage />} />
                  <Route path="nearby" element={<NearbyPage />} />
                  <Route path="rankings" element={<RankingsPage />} />
                  <Route path="search" element={<SearchPage />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="founder" element={<FounderPage />} />
                  <Route path="deals" element={<DealsPage />} />
                  <Route path="manage" element={<ManageIndexPage />} />
                  <Route path="manage/:slug" element={<ManageVenuePage />} />
                  <Route path="venue/new" element={<NewVenuePage />} />
                  <Route path="venue/:slug" element={<VenuePage />} />
                  <Route path="review/new" element={<NewReviewPage />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
                <Route path="login" element={<Bare><LoginPage /></Bare>} />
                <Route path="signup" element={<Bare><SignupPage /></Bare>} />
                <Route path="auth/forgot" element={<Bare><ForgotPage /></Bare>} />
                <Route path="auth/reset" element={<Bare><ResetPage /></Bare>} />
                <Route path="auth/confirm" element={<Bare><ConfirmPage /></Bare>} />
                <Route path="admin" element={<AdminLayout />}>
                  <Route index element={<Navigate to="/admin/moderation" replace />} />
                  <Route path="moderation" element={<ModerationPage />} />
                  <Route path="users" element={<AdminUsersPage />} />
                  <Route path="business" element={<AdminBusinessPage />} />
                </Route>
              </Routes>
            </Suspense>
            <BiometricOffer />
          </Gate>
        </DistanceProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
