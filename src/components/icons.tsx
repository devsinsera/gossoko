// Inline SVG icons — keeps the dependency surface tiny and lets us tune
// stroke weight for the industrial vibe (1.75 = chunky but readable).
import type { SVGProps } from 'react';

type Props = SVGProps<SVGSVGElement> & { size?: number };

const base = ({ size = 24, ...p }: Props) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...p,
});

export function HomeIcon(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}

export function MapPinIcon(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="M12 22s-7-7.1-7-12a7 7 0 1 1 14 0c0 4.9-7 12-7 12z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export function SearchIcon(props: Props) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function TrophyIcon(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="M8 4h8v4a4 4 0 1 1-8 0z" />
      <path d="M5 4h3v3a3 3 0 0 1-3-3z" />
      <path d="M16 4h3a3 3 0 0 1-3 3z" />
      <path d="M10 13v3h4v-3" />
      <path d="M8 20h8" />
      <path d="M9 16h6l-1 4h-4z" />
    </svg>
  );
}

export function UserIcon(props: Props) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
    </svg>
  );
}

export function HardHatIcon(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="M3 18h18v2H3z" />
      <path d="M5 18a7 7 0 0 1 14 0" />
      <path d="M10 11V7h4v4" />
    </svg>
  );
}

export function CoffeeIcon(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" />
      <path d="M17 11h2a2 2 0 0 1 0 4h-2" />
      <path d="M7 4v2M11 4v2M15 4v2" />
    </svg>
  );
}

export function TruckIcon(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="M2 7h12v9H2z" />
      <path d="M14 10h4l3 3v3h-7z" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  );
}

export function ClockIcon(props: Props) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function StarIcon({ filled, ...rest }: Props & { filled?: boolean }) {
  const p = base(rest);
  return (
    <svg {...p} fill={filled ? 'currentColor' : 'none'}>
      <path d="m12 3 2.7 5.5 6 .9-4.3 4.2 1 6L12 17l-5.4 2.8 1-6L3.3 9.4l6-.9z" />
    </svg>
  );
}

export function ChevronRightIcon(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function ChevronLeftIcon(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}

export function CheckIcon(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="M4 12.5 9 17.5 20 6.5" />
    </svg>
  );
}

export function FilterIcon(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="M3 5h18M6 12h12M10 19h4" />
    </svg>
  );
}

export function FlameIcon(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="M12 3s4 4 4 8a4 4 0 0 1-8 0c0-1.5.5-2.5 1.5-3.5C9.5 9 9 6 12 3z" />
      <path d="M12 13a3 3 0 0 0-2 5 3 3 0 1 0 4-3" />
    </svg>
  );
}

export function ZapIcon(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
    </svg>
  );
}

export function SunriseIcon(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="M3 18h18" />
      <path d="M6 14a6 6 0 0 1 12 0" />
      <path d="M12 4v3M5.6 7.6l1.5 1.5M18.4 7.6l-1.5 1.5M2 21h20" />
    </svg>
  );
}

export function ParkingIcon(props: Props) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M10 16V8h3a2.5 2.5 0 0 1 0 5h-3" />
    </svg>
  );
}

export function HeartIcon({ filled, ...rest }: Props & { filled?: boolean }) {
  const p = base(rest);
  return (
    <svg {...p} fill={filled ? 'currentColor' : 'none'}>
      <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />
    </svg>
  );
}

export function PlusIcon(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function XIcon(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="m6 6 12 12M6 18 18 6" />
    </svg>
  );
}

export function VerifiedIcon(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="m12 2 2.5 2.5L18 4l.5 3.5L22 9l-2 3 2 3-3.5 1.5L18 20l-3.5-.5L12 22l-2.5-2.5L6 20l-.5-3.5L2 15l2-3-2-3 3.5-1.5L6 4l3.5.5z" />
      <path d="m8 12 3 3 5-6" />
    </svg>
  );
}

export function CompassIcon(props: Props) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15 9-2 5-5 2 2-5z" />
    </svg>
  );
}
