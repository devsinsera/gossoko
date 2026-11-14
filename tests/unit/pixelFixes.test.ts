// UI fixes from the Pixel 8a pass (14 Nov): rendered to static HTML in node, no browser needed.
import { describe, it, expect, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: null, status: 'out', signOut: async () => undefined }) }));
vi.mock('@/lib/founder', () => ({ useIsFounder: () => false }));

const inRouter = (el: ReturnType<typeof h>) => renderToStaticMarkup(h(MemoryRouter, null, el));

describe('Profile, signed out', () => {
  it('puts Sign in / Create account at the top, before the profile and actions', async () => {
    const { default: ProfilePage } = await import('@/pages/profile/page');
    const html = inRouter(h(ProfilePage));
    const signIn = html.indexOf('href="/login"');
    expect(signIn).toBeGreaterThan(-1);
    expect(html).toContain('href="/signup"');
    expect(signIn).toBeLessThan(html.indexOf('Write a Review'));
    expect(signIn).toBeLessThan(html.indexOf('Guest'));
  });
});

describe('Review form rating buttons', () => {
  it('the chosen rating is a pressed, filled orange button with dark text', async () => {
    const { AxisField } = await import('@/pages/review/new/page');
    const html = inRouter(h(AxisField, { axis: 'speed', label: 'Speed', colName: 'speed_rating', defaultValue: 4 }));
    const buttons = html.match(/<button[^>]*>/g) ?? [];
    expect(buttons).toHaveLength(5);
    const pressed = buttons.filter((b) => b.includes('aria-pressed="true"'));
    expect(pressed).toHaveLength(1);
    expect(pressed[0]).toMatch(/aria-label="Speed: 4 out of 5"/);
    expect(pressed[0]).toMatch(/background:#FF7A00/i);
    expect(pressed[0]).toMatch(/color:#0a0908/i);
    expect(buttons.filter((b) => b.includes('aria-pressed="false"'))).toHaveLength(4);
    expect(html).toMatch(/<input type="hidden"[^>]*name="speed_rating"[^>]*value="4"/);
  });
  it('nothing is pressed before the user picks', async () => {
    const { AxisField } = await import('@/pages/review/new/page');
    const html = inRouter(h(AxisField, { axis: 'speed', label: 'Speed', colName: 'speed_rating' }));
    expect(html).not.toContain('aria-pressed="true"');
  });
});

describe('Photo picker', () => {
  it('shows a styled "Add photos" button; the native input stays hidden but keeps name/accept', async () => {
    const { PhotoPicker, pickerLabel } = await import('@/components/PhotoPicker');
    const html = renderToStaticMarkup(h(PhotoPicker, { name: 'photos', accept: 'image/*', max: 3 }));
    expect(html).toMatch(/<button type="button"[^>]*>.*Add photos/);
    const input = /<input[^>]*type="file"[^>]*>/.exec(html)?.[0] ?? '';
    expect(input).toContain('name="photos"');
    expect(input).toContain('accept="image/*"');
    expect(input).toContain('multiple');
    expect(input).toMatch(/opacity:0/);
    expect(pickerLabel(0, 3)).toBe('Add photos');
    expect(pickerLabel(2, 3)).toBe('2 photos · change');
    expect(pickerLabel(5, 3)).toBe('3 photos · change');
  });
  it('the review form and owner dashboard no longer render a bare file input', async () => {
    const { readFileSync } = await import('node:fs');
    for (const f of ['src/pages/review/new/page.tsx', 'src/pages/manage/[slug]/page.tsx']) {
      const src = readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
      expect(src, f).not.toMatch(/type="file"/);
      expect(src, f).toContain('<PhotoPicker');
    }
  });
});

describe('Venue page review button', () => {
  it('says "Edit your review" once the user has one', async () => {
    const { reviewCta } = await import('@/lib/queries/reviews');
    expect(reviewCta('smoko-stop', null)).toEqual({ href: '/review/new?venue=smoko-stop', label: 'Write a review', editing: false });
    expect(reviewCta('smoko-stop', { id: 'r1' })).toEqual({ href: '/review/new?venue=smoko-stop', label: 'Edit your review', editing: true });
  });
});

describe('Owner chart', () => {
  it('labels a week by weekday, keeps values, and flags an empty range', async () => {
    const { dayBars, chartEmpty } = await import('@/lib/chart');
    const week = ['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14']
      .map((date, i) => ({ date, views: i === 6 ? 10 : i }));
    const bars = dayBars(week);
    expect(bars.map((b) => b.label)).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    expect(bars.map((b) => b.value)).toEqual([0, 1, 2, 3, 4, 5, 10]);
    expect(bars[6].pct).toBe(100);
    expect(bars[5].pct).toBe(50);
    expect(chartEmpty(week)).toBe(false);
    expect(chartEmpty(week.map((d) => ({ ...d, views: 0 })))).toBe(true);
    expect(chartEmpty([])).toBe(true);
  });
  it('a 30-day range gets about 7 date labels, always including today', async () => {
    const { dayBars } = await import('@/lib/chart');
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(2026, 10, 14 - 29 + i);
      return { date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, views: 1 };
    });
    const labels = dayBars(days).map((b) => b.label).filter(Boolean);
    expect(labels.length).toBeGreaterThanOrEqual(5);
    expect(labels.length).toBeLessThanOrEqual(8);
    expect(labels[labels.length - 1]).toBe('14/11');
  });
});

describe('Keyboard: hide the phone tab bar', () => {
  it('hides when the viewport shrinks a lot, or a focused field on a touch screen shrank it', async () => {
    const { keyboardOpen } = await import('@/lib/keyboard');
    expect(keyboardOpen({ editableFocused: true, coarsePointer: true, viewportHeight: 520, baselineHeight: 844 })).toBe(true);   // keyboard up
    expect(keyboardOpen({ editableFocused: false, coarsePointer: true, viewportHeight: 500, baselineHeight: 844 })).toBe(true);
    expect(keyboardOpen({ editableFocused: true, coarsePointer: true, viewportHeight: 720, baselineHeight: 844 })).toBe(true);   // small keyboard
    expect(keyboardOpen({ editableFocused: true, coarsePointer: true, viewportHeight: 844, baselineHeight: 844 })).toBe(false);  // focused, no keyboard (Search autofocus)
    expect(keyboardOpen({ editableFocused: true, coarsePointer: false, viewportHeight: 844, baselineHeight: 844 })).toBe(false); // desktop
    expect(keyboardOpen({ editableFocused: false, coarsePointer: true, viewportHeight: 800, baselineHeight: 844 })).toBe(false); // URL bar
  });
  it('the CSS hides the tab bar while the keyboard is up and paints a solid strip under the status bar', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync(new URL('../../src/globals.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\.tab-nav--keyboard\s*\{\s*display:\s*none/);
    expect(css).toMatch(/body::before\s*\{[^}]*position:\s*fixed[^}]*height:\s*var\(--safe-top\)[^}]*background:\s*var\(--bg\)/);
  });
});

describe('Check a code keeps the scroll position', () => {
  it('puts the page back where it was if the check re-render jumps it to the top', async () => {
    const { keepScroll } = await import('@/lib/keepScroll');
    const timers: (() => void)[] = [];
    const win = {
      scrollY: 640,
      scrollTo(o: { top: number }) { this.scrollY = o.top; },
      requestAnimationFrame(f: () => void) { timers.push(f); return 0; },
      setTimeout(f: () => void) { timers.push(f); return 0; },
    };
    const res = await keepScroll(async () => { win.scrollY = 0; return 'ok'; }, win as never);
    expect(res).toBe('ok');
    timers.forEach((f) => f());
    expect(win.scrollY).toBe(640);
  });
  it('the Check button is not disabled while checking (that drops focus and closes the keyboard)', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../../src/pages/manage/[slug]/page.tsx', import.meta.url), 'utf8');
    const redeem = src.slice(src.indexOf('function Redeem('), src.indexOf('function Deals('));
    expect(redeem).toContain('keepScroll(');
    expect(redeem).not.toMatch(/type="submit" disabled=/);
  });
});
