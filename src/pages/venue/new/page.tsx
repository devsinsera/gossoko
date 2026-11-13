import { Link } from '@/lib/nav';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { ActionForm } from '@/components/ActionForm';
import { COLORS, RADIUS, SPACE, HAZARD_STRIPES, BRAND_GRADIENT } from '@/lib/theme';
import { VENUE_TYPE_LABELS, type VenueType } from '@/lib/types';
import { submitVenue } from './actions';

const VENUE_TYPE_OPTIONS: VenueType[] = [
  'cafe', 'food_truck', 'bakery', 'servo', 'gossoko_van',
  'snack_bar', 'restaurant', 'cafe_and_food_truck',
];

export default function NewVenuePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: string; lng: string } | null>(null);
  const [locMsg, setLocMsg] = useState<string | null>(null);
  const [locBusy, setLocBusy] = useState(false);

  /** Standing at the spot? One tap fills in the coordinates. */
  function useMyLocation() {
    if (!navigator.geolocation) { setLocMsg('This device can\'t share its location — enter the coordinates below.'); return; }
    setLocBusy(true);
    setLocMsg(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) });
        setLocMsg(`Location set (accurate to about ${Math.round(pos.coords.accuracy)} m). Move if you're not at the venue.`);
        setLocBusy(false);
      },
      () => { setLocMsg('Couldn\'t get your location. Allow location for Gossoko in settings, or enter the coordinates below.'); setLocBusy(false); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }
  // Fields keep their values on a failed submit because the form never remounts.
  const sp: { error?: string } & Record<string, string | undefined> = { error: error ?? undefined };
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent('/venue/new')}`} replace />;

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

          <ActionForm
            action={submitVenue}
            onDone={(r) => {
              const res = r as Awaited<ReturnType<typeof submitVenue>>;
              if (res.ok) navigate('/profile?venue=submitted');
              else if (res.unauthenticated) navigate('/login?next=%2Fvenue%2Fnew');
              else setError(res.error);
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}
          >
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
              <button type="button" onClick={useMyLocation} disabled={locBusy}
                style={{ width: '100%', marginBottom: SPACE.sm, background: 'transparent', color: COLORS.orange, border: `1.5px solid ${COLORS.orange}`, borderRadius: RADIUS.md, padding: 11, fontWeight: 800, fontSize: 14, cursor: 'pointer', opacity: locBusy ? 0.7 : 1 }}>
                {locBusy ? 'Finding you…' : '📍 I\'m at the venue — use my location'}
              </button>
              {locMsg && <p role="status" style={{ margin: `0 0 ${SPACE.sm}px`, fontSize: 12.5, color: COLORS.textSecondary }}>{locMsg}</p>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACE.sm }}>
                <Field key={`lat-${coords?.lat ?? ''}`} label="Latitude" name="latitude" placeholder="-27.4501" required defaultValue={coords?.lat ?? sp.latitude} inputMode="decimal" />
                <Field key={`lng-${coords?.lng ?? ''}`} label="Longitude" name="longitude" placeholder="153.0457" required defaultValue={coords?.lng ?? sp.longitude} inputMode="decimal" />
              </div>
              <p style={{ margin: `${SPACE.xs}px 0 0`, fontSize: 11, color: COLORS.textMuted }}>
                Not there right now? Open{' '}
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
                background: BRAND_GRADIENT,
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
          </ActionForm>
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
