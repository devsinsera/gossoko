import { useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import { siteUrl } from '@/lib/env';
import { COLORS, RADIUS } from '@/lib/theme';

/** A QR code for the counter. It opens the venue's page (deals, reviews, save). Printable. */
export function VenueQr({ slug, name }: { slug: string; name: string }) {
  const url = `${siteUrl()}/venue/${slug}`;
  const [copied, setCopied] = useState(false);
  // Printing doesn't exist inside the phone apps' web view; use the website from a computer for a poster.
  const native = typeof window !== 'undefined' && Boolean((window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());
  const svg = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    return qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  }, [url]);

  return (
    <section className="section">
      <div className="section-title"><h2>Counter QR</h2></div>
      <div className="qr-poster" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.lg, padding: 16, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div role="img" aria-label={`QR code for ${name}`} dangerouslySetInnerHTML={{ __html: svg }}
          style={{ width: 132, height: 132, background: '#fff', borderRadius: RADIUS.md, padding: 4, flex: '0 0 auto' }} />
        <div style={{ flex: 1, minWidth: 180 }}>
          <p style={{ margin: 0, color: COLORS.text, fontWeight: 800 }}>Scan to rate {name}</p>
          <p style={{ margin: '4px 0 10px', color: COLORS.textSecondary, fontSize: 13, lineHeight: 1.5 }}>
            Stick it on the counter or the van window. Customers land on your page to rate you, save you and grab a deal code.
          </p>
          <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {!native && <button type="button" onClick={() => window.print()} style={{ background: COLORS.orange, color: '#0a0908', border: 'none', borderRadius: RADIUS.md, padding: '9px 14px', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>Print</button>}
            <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); } catch { /* ignore */ } }}
              style={{ background: 'none', border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: RADIUS.md, padding: '9px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              {copied ? 'Link copied' : 'Copy link'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
