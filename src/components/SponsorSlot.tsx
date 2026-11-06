import { useEffect } from 'react';
import { useLoad } from '@/lib/useLoad';
import { getSponsor, trackSponsor } from '@/lib/queries/business';
import { COLORS } from '@/lib/theme';

/** "Smoko of the week": one brand, admin-sold, always labelled Sponsored. Renders nothing when unsold. */
export function SponsorSlot() {
  const { data: s } = useLoad(getSponsor, []);
  const id = s?.id;
  useEffect(() => { if (id) trackSponsor('sponsor_view'); }, [id]);
  if (!s) return null;
  return (
    <section className="section">
      <div className="section-title"><h2>Smoko of the week</h2></div>
      <a href={s.link_url} target="_blank" rel="noopener noreferrer sponsored" onClick={() => trackSponsor('sponsor_click')}
        style={{ display: 'block', position: 'relative', padding: '14px 16px', borderRadius: 12, textDecoration: 'none',
          background: COLORS.surface, border: `1.5px solid ${COLORS.orange}` }}>
        <span style={{ position: 'absolute', top: 10, right: 10, fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase',
          color: COLORS.textSecondary, border: `1px solid ${COLORS.border}`, borderRadius: 4, padding: '3px 6px' }}>Sponsored</span>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: COLORS.orange, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{s.brand}</div>
        <div style={{ marginTop: 4, fontWeight: 800, fontSize: 17, color: COLORS.text, paddingRight: 80 }}>{s.headline}</div>
        {s.body && <div style={{ marginTop: 4, fontSize: 13.5, color: COLORS.textSecondary, lineHeight: 1.45 }}>{s.body}</div>}
      </a>
    </section>
  );
}
