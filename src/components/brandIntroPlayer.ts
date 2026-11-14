// The opening logo animation as plain DOM, so the website (no React) and the app share one copy.
//
// Pin drops in, pulses, shrinks into the second O while the letters spring out from behind it,
// holds, then flies (FLIP) onto the page's header logo ([data-brand-target="header"]). Tap to skip.
//
// ⚑ 15 Nov 2026 (Peta: "an icon pops up on the left of the screen before the animation starts"):
// everything is built, sized and positioned in ONE synchronous call, and nothing is visible until
// its animation is already running. The old React version positioned the pin in useEffect, which
// runs AFTER the first paint, so the pin was drawn once at its natural size at the top-left.
import pinUrl from '@/assets/brand/gossoko-pin.svg';
import wordmarkUrl from '@/assets/brand/gossoko-wordmark.svg';
import letter0 from '@/assets/brand/letters/letter-0.svg';
import letter1 from '@/assets/brand/letters/letter-1.svg';
import letter2 from '@/assets/brand/letters/letter-2.svg';
import letter3 from '@/assets/brand/letters/letter-3.svg';
import letter5 from '@/assets/brand/letters/letter-5.svg';
import letter6 from '@/assets/brand/letters/letter-6.svg';
import { WORDMARK_LETTERS, WORDMARK_PIN_SLOT, WORDMARK_VIEWBOX } from '@/assets/brand/wordmark-geometry';
import { flipTransform, INTRO, letterEmergeDelay, letterSpring, type Box } from '@/lib/brandIntro';

const LETTER_SRC: Record<number, string> = { 0: letter0, 1: letter1, 2: letter2, 3: letter3, 5: letter5, 6: letter6 };
const VB = WORDMARK_VIEWBOX;
const PIN_CX = WORDMARK_PIN_SLOT.x + WORDMARK_PIN_SLOT.w / 2;
/** Letters nearer the pin sit on top, so the outer ones slide out from behind them. */
const LETTER_Z: Record<number, number> = Object.fromEntries(
  WORDMARK_LETTERS.map((l) => [l.index, 10 - Math.round(Math.abs(l.x + l.w / 2 - PIN_CX) / 220)]),
);
const TARGET = '[data-brand-target="header"]';

function img(src: string, style: Partial<CSSStyleDeclaration>): HTMLImageElement {
  const el = document.createElement('img');
  el.src = src;
  el.alt = '';
  el.draggable = false;
  el.decoding = 'sync';
  Object.assign(el.style, style);
  return el;
}

/** Start the opening now. Calls onDone when it has finished or been skipped. Returns a stop function. */
export function playBrandIntro(onDone: () => void = () => {}): () => void {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // ── build: every element gets its final size and place before it is attached ──
  const overlay = document.createElement('div');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.dataset.brandIntro = '';
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', zIndex: '9999', background: '#0a0908', overflow: 'hidden', touchAction: 'none',
  });

  const heroW = Math.min(vw * 0.8, 520);
  const sc = heroW / VB.w;
  const heroH = VB.h * sc;
  const gx = (vw - heroW) / 2;
  const gy = (vh - heroH) / 2;
  const slot: Box = {
    left: gx + (WORDMARK_PIN_SLOT.x - VB.x) * sc,
    top: gy + (WORDMARK_PIN_SLOT.y - VB.y) * sc,
    width: WORDMARK_PIN_SLOT.w * sc,
    height: WORDMARK_PIN_SLOT.h * sc,
  };
  // The pin is laid out at its LARGEST size and only ever scaled down, so WebKit keeps it sharp.
  const hk = (vh * 0.36) / slot.height;
  const peak = hk * 1.08;
  const pinW = slot.width * peak;
  const pinH = slot.height * peak;
  const endDx = slot.left + slot.width / 2 - vw / 2;
  const endDy = slot.top + slot.height / 2 - vh / 2;
  const hero = (s: number, yOff = 0) => `translate(0px, ${yOff}px) scale(${(hk * s) / peak})`;

  // The group (wordmark + letters) is its own stacking context; the pin sits above it.
  const group = document.createElement('div');
  Object.assign(group.style, {
    position: 'absolute', transformOrigin: '0 0', zIndex: '0', willChange: 'transform',
    left: `${gx}px`, top: `${gy}px`, width: `${heroW}px`, height: `${heroH}px`,
  });
  const word = img(wordmarkUrl, { display: 'block', width: '100%', height: '100%', opacity: '0' });
  const lettersBox = document.createElement('div');
  Object.assign(lettersBox.style, { position: 'absolute', inset: '0' });
  const letters = WORDMARK_LETTERS.map((l) => {
    const el = img(LETTER_SRC[l.index], {
      position: 'absolute',
      left: `${((l.x - VB.x) / VB.w) * 100}%`, top: `${((l.y - VB.y) / VB.h) * 100}%`,
      width: `${(l.w / VB.w) * 100}%`, height: `${(l.h / VB.h) * 100}%`,
      transformOrigin: 'center 60%', zIndex: String(LETTER_Z[l.index]), willChange: 'transform, opacity', opacity: '0',
    });
    lettersBox.appendChild(el);
    return { el, l };
  });
  group.append(word, lettersBox);
  // Starts at the top of its drop (off-screen above) and invisible, in case a frame is drawn first.
  const pin = img(pinUrl, {
    position: 'absolute', transformOrigin: 'center center', pointerEvents: 'none', zIndex: '1', willChange: 'transform',
    left: `${vw / 2 - pinW / 2}px`, top: `${vh / 2 - pinH / 2}px`, width: `${pinW}px`, height: `${pinH}px`,
    transform: hero(1, -vh * 0.6), opacity: '0',
  });
  const skip = document.createElement('span');
  skip.textContent = 'Tap to skip';
  Object.assign(skip.style, {
    position: 'absolute', left: '0', right: '0', bottom: 'max(28px, env(safe-area-inset-bottom))', textAlign: 'center',
    fontFamily: 'var(--font-label, system-ui)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6b645c',
  });
  overlay.append(group, pin, skip);
  document.body.appendChild(overlay);

  // ── run ──
  const anims: Animation[] = [];
  const timers: number[] = [];
  let done = false;
  let landing: HTMLElement | null = null;
  const showLanding = () => { if (landing) landing.style.visibility = ''; landing = null; };
  const later = (fn: () => void, ms: number) => { timers.push(window.setTimeout(fn, ms)); };
  const stop = () => {
    if (done) return;
    done = true;
    timers.forEach((t) => window.clearTimeout(t));
    anims.forEach((a) => a.cancel());
    overlay.removeEventListener('pointerdown', finish);
    showLanding();
    overlay.remove();
  };
  function finish() { if (done) return; stop(); onDone(); }
  overlay.addEventListener('pointerdown', finish, { once: true });
  later(finish, INTRO.hardCap);

  const T = INTRO;
  const at = (ms: number) => ms / T.revealEnd;
  pin.style.opacity = '';
  anims.push(pin.animate([
    { offset: 0, transform: hero(1, -vh * 0.6), easing: 'ease-out' },
    { offset: at(T.dropEnd * 0.9), transform: hero(1, 0), easing: 'cubic-bezier(.5,0,.9,.6)' },
    { offset: at(T.dropEnd + 60), transform: hero(1, -vh * 0.035), easing: 'ease-in' },
    { offset: at(T.dropEnd + 130), transform: hero(1, 0), easing: 'ease-out' },
    { offset: at((T.dropEnd + T.pulseEnd) / 2), transform: hero(1.08, 0), easing: 'cubic-bezier(.37,0,.63,1)' },
    { offset: at(T.pulseEnd), transform: hero(1, 0), easing: 'cubic-bezier(.65,0,.35,1)' },
    { offset: at(T.shrinkEnd), transform: `translate(${endDx}px, ${endDy}px) scale(${1 / peak})` },
    { offset: 1, transform: `translate(${endDx}px, ${endDy}px) scale(${1 / peak})` },
  ], { duration: T.revealEnd, fill: 'both' }));

  const pinCx = (WORDMARK_PIN_SLOT.x + WORDMARK_PIN_SLOT.w / 2 - VB.x) * sc;
  const pinCy = (WORDMARK_PIN_SLOT.y + WORDMARK_PIN_SLOT.h / 2 - VB.y) * sc;
  const legs = letters.map(({ el, l }) => {
    const cx = (l.x - VB.x + l.w / 2) * sc;
    const cy = (l.y - VB.y + l.h / 2) * sc;
    return { el, dx: pinCx - cx, dy: pinCy - cy, dist: Math.abs(pinCx - cx) };
  });
  const dmin = Math.min(...legs.map((l) => l.dist));
  const dmax = Math.max(...legs.map((l) => l.dist));
  for (const leg of legs) {
    const delay = letterEmergeDelay(leg.dist, dmin, dmax);
    const over = Math.min(heroW * 0.05, Math.max(heroW * 0.033, leg.dist * 0.09));
    anims.push(leg.el.animate(letterSpring(leg.dx, leg.dy, over), { duration: T.emergeDur, delay, fill: 'both' }));
    anims.push(leg.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 110, delay, fill: 'both' }));
  }
  // Hand over to the static wordmark (same art) once every letter has settled.
  const swap = { duration: 1, delay: T.revealEnd, fill: 'forwards' as const };
  anims.push(word.animate([{ opacity: 0 }, { opacity: 1 }], { ...swap, fill: 'both' }));
  anims.push(lettersBox.animate([{ opacity: 1 }, { opacity: 0 }], swap));
  anims.push(pin.animate([{ opacity: 1 }, { opacity: 0 }], swap));

  // Hold, then FLIP onto the header logo of the page underneath (or fade if there is none on screen).
  later(() => {
    const target = document.querySelector<HTMLElement>(TARGET);
    const r = target?.getBoundingClientRect();
    const visible = !!r && r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < window.innerHeight;
    if (!target || !r || !visible) {
      anims.push(overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }));
      later(finish, 200);
      return;
    }
    const t = flipTransform({ left: gx, top: gy, width: heroW, height: heroH }, { left: r.left, top: r.top, width: r.width, height: r.height });
    overlay.style.pointerEvents = 'none';
    landing = target;
    target.style.visibility = 'hidden';
    anims.push(skip.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: 'forwards' }));
    const flipDur = T.flipEnd - T.holdEnd;
    anims.push(group.animate([
      { transform: 'translate(0px, 0px) scale(1)' },
      { transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale})` },
    ], { duration: flipDur, easing: 'cubic-bezier(.65,0,.25,1)', fill: 'forwards' }));
    anims.push(overlay.animate([{ background: 'rgba(10,9,8,1)' }, { background: 'rgba(10,9,8,0)' }], { duration: flipDur, fill: 'forwards' }));
    later(finish, flipDur + 20);
  }, T.holdEnd);

  return stop;
}
