import { Link } from '@/lib/nav';
import { useLocation } from 'react-router-dom';
import pinUrl from '@/assets/brand/gossoko-pin.svg';
import { HomeIcon, MapPinIcon, SearchIcon, TrophyIcon, UserIcon } from './icons';

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

/** Bottom tab bar on a phone; a left rail on a tablet (globals.css `.tab-nav`). */
export function BottomNav() {
  const pathname = useLocation().pathname || '/';

  return (
    <nav aria-label="Primary" className="tab-nav">
      <span className="tab-nav__brand" aria-hidden>
        <img src={pinUrl} alt="" />
      </span>
      <div className="tab-nav__items">
        {ITEMS.map(({ href, label, Icon, matches }) => {
          const active = matches(pathname);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className="tab-nav__item"
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
