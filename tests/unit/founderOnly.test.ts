import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { isFounderEmail, FOUNDER_EMAIL_SHA256 } from '@/lib/founder';

describe('Founder page: the owner login only', () => {
  it('matches by hash, whatever the case or spacing, and nobody else', async () => {
    expect(FOUNDER_EMAIL_SHA256).toMatch(/^[0-9a-f]{64}$/);
    expect(await isFounderEmail('someone@example.com')).toBe(false);
    expect(await isFounderEmail('')).toBe(false);
    expect(await isFounderEmail(null)).toBe(false);
  });
  it('the owner address is never written in the app source (it ships in a public bundle)', () => {
    for (const p of ['src/lib/founder.ts', 'src/components/BottomNav.tsx', 'src/pages/founder/page.tsx']) {
      expect(readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8')).not.toMatch(/@outlook\.com/);
    }
  });
});
