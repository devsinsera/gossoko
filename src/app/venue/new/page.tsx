import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/permissions';
import { COLORS, RADIUS, SPACE, HAZARD_STRIPES } from '@/lib/theme';
import { VENUE_TYPE_LABELS, type VenueType } from '@/lib/seed/types';
import { submitVenue } from './actions';

export const dynamic = 'force-dynamic';

const VENUE_TYPE_OPTIONS: VenueType[] = [
  'cafe', 'food_truck', 'bakery', 'servo', 'gossoko_van',
  'snack_bar', 'restaurant', 'cafe_and_food_truck',
];

type Search = {
  error?: string;
  name?: string;
  suburb?: string;
  state?: string;
  address?: string;
  type?: string;
  tagline?: string;
  opens_at?: string;
  closes_at?: string;
  price_level?: string;
  latitude?: string;
  longitude?: string;
};

export default async function NewVenuePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/venue/new')}`);
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      <header style={{ padding: '14px 0 8px', display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
        <Link
          href="/profile"
          style={{
            display: 'inline-flex', gap: 4, alignItems: 'center',
            color: COLORS.textSecondary, textDecoration: 'none', fontSize: 13,
          }}
        >
          ← Back to profile
        </Link>
      </header>

      <section style={{
        background: COLORS.surface,
        border: `1.5px solid ${COLORS.border}`,
        borderRadius: RADIUS.lg,
        overflow: 'hidden',
        marginTop: SPACE.sm,
      }}>
        <div aria-hidden style={{ height: 6, background: HAZARD_STRIPES }} />
        <div style={{ padding: SPACE.lg }}>
          <h1 style={{ margin: 0, fontSize: 22, letterSpacing: 0.5 }}>SUGGEST A VENUE</h1>
          <p style={{ margin: `${SPACE.xs}px 0 ${SPACE.lg}px`, color: COLORS.textSecondary, fontSize: 13 }}>
            Add a spot that's missing. An admin will review it before it goes live.
          </p>

          {sp.error && (
            <div style={{
              marginBottom: SPACE.md,
              padding: '10px 12px',
              background: 'rgba(230,57,70,0.15)',
              border: `1px solid ${COLORS.red}`,
              borderRadius: RADIUS.md,
              color: COLORS.text, fontSize: 13,
            }}>
              {sp.error}
            </div>
          )}

          <form action={submitVenue} style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
            <Field label="Name" name="name" placeholder="e.g. Brickworks Café" required minLength={2} maxLength={120} defaultValue={sp.name} />

            <Select label="Type" name="type" required defaultValue={sp.type}>
              <option value="">— pick one —</option>
              {VENUE_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>{VENUE_TYPE_LABELS[t]}</option>
              ))}
            </Select>

            <Field label="Tagline (optional)" name="tagline" placeholder="One short line" maxLength={120} defaultValue={sp.tagline} />

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: SPACE.sm }}>
              <Field label="Suburb" name="suburb" placeholder="e.g. Newstead" required minLength={2} maxLength={80} defaultValue={sp.suburb} />
              <Field label="State" name="state" placeholder="QLD" required minLength={2} maxLength={8} defaultValue={sp.state ?? 'QLD'} />
            </div>

            <Field label="Street address" name="address" placeholder="123 Main St" required minLength={4} maxLength={200} defaultValue={sp.address} />

            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACE.sm }}>
                <Field label="Latitude" name="latitude" placeholder="-27.4501" required defaultValue={sp.latitude} inputMode="decimal" />
                <Field label="Longitude" name="longitude" placeholder="153.0457" required defaultValue={sp.longitude} inputMode="decimal" />
              </div>
              <p style={{ margin: `${SPACE.xs}px 0 0`, fontSize: 11, color: COLORS.textMuted }}>
                Don't know the coords? Open{' '}
                <a
                  href="https://www.google.com/maps"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: COLORS.orange }}
                >
                  Google Maps
                </a>
                , right-click the spot, click the lat/lng at the top of the menu to copy, then paste here.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACE.sm }}>
              <Field label="Opens (HH:MM)" name="opens_at" placeholder="05:30" maxLength={5} defaultValue={sp.opens_at} />
              <Field label="Closes (HH:MM)" name="closes_at" placeholder="14:00" maxLength={5} defaultValue={sp.closes_at} />
            </div>

            <Select label="Price level" name="price_level" required defaultValue={sp.price_level ?? '2'}>
              <option value="1">$ — cheap</option>
              <option value="2">$$ — mid</option>
              <option value="3">$$$ — pricey</option>
            </Select>

            <button
              type="submit"
              style={{
                background: COLORS.orange,
                color: '#0a0908',
                border: 'none',
                borderRadius: RADIUS.md,
                padding: 12,
                fontSize: 15,
                fontWeight: 800,
                letterSpacing: 0.5,
                cursor: 'pointer',
                marginTop: SPACE.sm,
              }}
            >
              Submit for review
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

function Field({
  label, name, placeholder, required, minLength, maxLength, defaultValue, inputMode,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  defaultValue?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}) {
  const baseStyle: React.CSSProperties = {
    background: COLORS.bgElev,
    color: COLORS.text,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.md,
    padding: '10px 12px',
    fontSize: 15,
    outline: 'none',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box',
  };
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{
        fontSize: 11, color: COLORS.textSecondary,
        textTransform: 'uppercase', letterSpacing: 0.5,
      }}>
        {label}
      </span>
      <input
        type="text"
        name={name}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        defaultValue={defaultValue}
        inputMode={inputMode}
        style={baseStyle}
      />
    </label>
  );
}

function Select({
  label, name, required, defaultValue, children,
}: {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
  children: React.ReactNode;
}) {
  const baseStyle: React.CSSProperties = {
    background: COLORS.bgElev,
    color: COLORS.text,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.md,
    padding: '10px 12px',
    fontSize: 15,
    outline: 'none',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box',
  };
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{
        fontSize: 11, color: COLORS.textSecondary,
        textTransform: 'uppercase', letterSpacing: 0.5,
      }}>
        {label}
      </span>
      <select name={name} required={required} defaultValue={defaultValue} style={baseStyle}>
        {children}
      </select>
    </label>
  );
}
