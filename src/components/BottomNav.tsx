'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HomeIcon, MapPinIcon, SearchIcon, TrophyIcon, UserIcon } from './icons';
import { COLORS, BOTTOM_NAV_HEIGHT } from '@/lib/theme';

type Item = {
  href: string;
  label: string;
  Icon: (p: { size?: number }) => React.ReactNode;
  matches: (p: string) => boolean;
};

const ITEMS: Item[] = [
  { href: '/',         label: 'Feed',     Icon: HomeIcon,    matches: (p) => p === '/' },
  { href: '/nearby',   label: 'Nearby',   Icon: MapPinIcon,  matches: (p) => p.startsWith('/nearby') },
  { href: '/search',   label: 'Search',   Icon: SearchIcon,  matches: (p) => p.startsWith('/search') },
  { href: '/rankings', label: 'Rankings', Icon: TrophyIcon,  matches: (p) => p.startsWith('/rankings') },
  { href: '/profile',  label: 'Profile',  Icon: UserIcon,    matches: (p) => p.startsWith('/profile') },
];

export function BottomNav() {
  const pathname = usePathname() || '/';

  return (
    <nav
      aria-label="Primary"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        height: `calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
        background: '#0a0908ee',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: `1px solid ${COLORS.border}`,
        zIndex: 50,
        display: 'flex',
        justifyContent: 'center',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          width: '100%',
          maxWidth: 480,
          alignItems: 'stretch',
        }}
      >
        {ITEMS.map(({ href, label, Icon, matches }) => {
          const active = matches(pathname);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                minHeight: 44,
                color: active ? COLORS.orange : COLORS.textSecondary,
                position: 'relative',
              }}
            >
              <span style={{ display: 'flex' }}>
                <Icon size={22} />
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  fontWeight: active ? 700 : 500,
                }}
              >
                {label}
              </span>
              {active && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: 4,
                    height: 3,
                    width: 24,
                    background: COLORS.orange,
                    borderRadius: 2,
                    boxShadow: `0 0 8px ${COLORS.orange}`,
                  }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
