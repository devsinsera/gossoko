import { Link } from '@/lib/nav';
import { useLocation } from 'react-router-dom';
import pinUrl from '@/assets/brand/gossoko-pin.svg';
import { useIsFounder } from '@/lib/founder';
import { useKeyboardOpen } from '@/lib/keyboard';
import { HomeIcon, MapPinIcon, SearchIcon, TrophyIcon, UserIcon } from './icons';

type Item = {
  href: string;
  label: string;
  Icon: (p: { size?: number }) => React.ReactNode;
  matches: (p: string) => boolean;
  /** Only on the side rail (tablet/desktop); phones reach it from Profile. */
  railOnly?: boolean;
};

const ITEMS: Item[] = [
  { href: '/',         label: 'Feed',     Icon: HomeIcon,    matches: (p) => p === '/' },
  { href: '/nearby',   label: 'Nearby',   Icon: MapPinIcon,  matches: (p) => p.startsWith('/nearby') },
  { href: '/search',   label: 'Search',   Icon: SearchIcon,  matches: (p) => p.startsWith('/search') },
  { href: '/rankings', label: 'Rankings', Icon: TrophyIcon,  matches: (p) => p.startsWith('/rankings') },
  { href: '/profile',  label: 'Profile',  Icon: UserIcon,    matches: (p) => p.startsWith('/profile') },
];

/** Bottom tab bar on a phone; a left rail on a tablet (globals.css `.tab-nav`). */
export function BottomNav() {
  const pathname = useLocation().pathname || '/';
  const founder = useIsFounder();
  // Android shrinks the page when the keyboard opens; don't let the tab bar ride up on top of it.
  const keyboard = useKeyboardOpen();
  // The owner's Founder tab (like Sona): admins only, on the rail.
  const items: Item[] = founder
    ? [...ITEMS, { href: '/founder', label: 'Founder', Icon: TrophyIcon, matches: (p) => p.startsWith('/founder'), railOnly: true }]
    : ITEMS;

  return (
    <nav aria-label="Primary" className={keyboard ? 'tab-nav tab-nav--keyboard' : 'tab-nav'}>
      <span className="tab-nav__brand" aria-hidden>
        <img src={pinUrl} alt="" />
      </span>
      <div className="tab-nav__items">
        {items.map(({ href, label, Icon, matches, railOnly }) => {
          const active = matches(pathname);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className={railOnly ? 'tab-nav__item tab-nav__item--rail' : 'tab-nav__item'}
            >
              <span style={{ display: 'flex' }}>
                <Icon size={22} />
              </span>
              <span className="tab-nav__label">{label}</span>
              {active && <span aria-hidden className="tab-nav__mark" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
