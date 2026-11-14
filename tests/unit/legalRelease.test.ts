// Release gate for the legal pages. SKIPPED unless RELEASE_CHECK=1 (`npm run release-check`), so the
// normal suite never trips on it. Run it before the store submission / before deploying the legal pages.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ABN, CONTACT_EMAIL, LEGAL_ENTITY, MAILBOX_CONFIRMED, POSTAL, PRIVACY_EMAIL, legalTokens } from '@/config/site';

const read = (p: string) => readFileSync(fileURLToPath(new URL(`../../${p}`, import.meta.url)), 'utf8');
const live = process.env.RELEASE_CHECK === '1';

describe.skipIf(!live)('legal pages release check (RELEASE_CHECK=1)', () => {
  it('operator details are real, not placeholders', () => {
    expect(LEGAL_ENTITY).not.toMatch(/TODO|CONFIRM|\[|example/i);
    expect(ABN.replace(/\s/g, '')).toMatch(/^\d{11}$/);
    expect(PRIVACY_EMAIL).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i);
  });
  it('the privacy mailbox exists and has been tested (set MAILBOX_CONFIRMED in src/config/site.ts)', () => {
    expect(MAILBOX_CONFIRMED).toBe(true);
  });
  it('the sales contact email is set, so Get-in-touch buttons are not the claim fallback', () => {
    expect(CONTACT_EMAIL).toBeTruthy();
  });
  it('a postal address is set (or Peta has decided to go email-only: then set POSTAL to "email only")', () => {
    expect(POSTAL).toBeTruthy();
  });
  it('the lawyer-read draft banner has been removed once a lawyer has read the pages', () => {
    for (const p of ['privacy/index.html', 'terms/index.html']) expect(read(p), p).not.toContain('doc__draft');
  });
  it('no placeholder text is left in the legal pages', () => {
    const tokens = Object.keys(legalTokens());
    for (const p of ['privacy/index.html', 'terms/index.html']) {
      const html = read(p);
      expect(html).not.toMatch(/\[CONFIRM|TODO|TBC|lorem/i);
      for (const t of html.match(/__[A-Z_]+__/g) ?? []) expect(tokens).toContain(t);
    }
  });
});
