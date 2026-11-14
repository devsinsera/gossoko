import { useEffect, useRef, useState } from 'react';
import pinUrl from '@/assets/brand/gossoko-pin.svg';
import wordmarkUrl from '@/assets/brand/gossoko-wordmark.svg';
import letter0 from '@/assets/brand/letters/letter-0.svg';
import letter1 from '@/assets/brand/letters/letter-1.svg';
import letter2 from '@/assets/brand/letters/letter-2.svg';
import letter3 from '@/assets/brand/letters/letter-3.svg';
import letter5 from '@/assets/brand/letters/letter-5.svg';
import letter6 from '@/assets/brand/letters/letter-6.svg';
import { WORDMARK_LETTERS, WORDMARK_PIN_SLOT, WORDMARK_VIEWBOX } from '@/assets/brand/wordmark-geometry';
import {
  flipTransform, INTRO, letterEmergeDelay, letterSpring, markIntroPlayed, shouldPlayIntro, type Box,
} from '@/lib/brandIntro';

/** Per-letter SVGs (G O S S _ K O), keyed by their index in GOSSOKO. */
const LETTER_SRC: Record<number, string> = {
  0: letter0, 1: letter1, 2: letter2, 3: letter3, 5: letter5, 6: letter6,
};
const VB = WORDMARK_VIEWBOX;
/**
 * Stacking: letters nearer the pin sit on top, so the outer letters slide out
 * from behind the inner ones (like a fanned deck) instead of crossing over
 * them. The pin itself is above all of them.
 */
const PIN_CX = WORDMARK_PIN_SLOT.x + WORDMARK_PIN_SLOT.w / 2;
const LETTER_Z: Record<number, number> = Object.fromEntries(
  WORDMARK_LETTERS.map((l) => [l.index, 10 - Math.round(Math.abs(l.x + l.w / 2 - PIN_CX) / 220)]),
);

/** Header logo the intro lands on. Pages mark it with data-brand-target="header". */
const TARGET = '[data-brand-target="header"]';

function sessionStore(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Opening animation. Pin drops in, pulses, shrinks into the second O while
 * the letters spring out from behind it (nearest first, with a small
 * overshoot and squash), holds, then flies (FLIP) to the header logo of the
 * page underneath. Tap anywhere to skip. The page renders
 * underneath, so the intro never holds up loading.
 */
export function BrandIntro() {
  const [active, setActive] = useState(() =>
    typeof window !== 'undefined' &&
    // Every full load of the site/app plays it (a reload is a new opening). The
    // component mounts once, so moving between pages never replays it.
    shouldPlayIntro(null, window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false),
  );
  const overlayRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const wordRef = useRef<HTMLImageElement>(null);
  const lettersRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!active) return;
    const overlay = overlayRef.current;
    const group = groupRef.current;
    const word = wordRef.current;
    const pin = pinRef.current;
    const lettersBox = lettersRef.current;
    if (!overlay || !group || !word || !pin || !lettersBox) return;

    const anims: Animation[] = [];
    const timers: number[] = [];
    let done = false;
    // The header logo we fly onto. Hidden while the flying copy is in the air so
    // the screen never shows two logos at once; shown again the moment we land.
    let landing: HTMLElement | null = null;
    const showLanding = () => {
      if (landing) landing.style.visibility = '';
      landing = null;
    };

    const later = (fn: () => void, ms: number) => {
      timers.push(window.setTimeout(fn, ms));
    };
    const finish = () => {
      if (done) return;
      done = true;
      timers.forEach((t) => window.clearTimeout(t));
      anims.forEach((a) => a.cancel());
      overlay.removeEventListener('pointerdown', finish);
      showLanding();
      markIntroPlayed(sessionStore());
      setActive(false);
    };
    overlay.addEventListener('pointerdown', finish, { once: true });
    later(finish, INTRO.hardCap);

    // Geometry: the wordmark is centred, `heroW` wide. Pin slot is in its viewBox units.
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const heroW = Math.min(vw * 0.8, 520);
    const sc = heroW / WORDMARK_VIEWBOX.w;
    const heroH = WORDMARK_VIEWBOX.h * sc;
    const gx = (vw - heroW) / 2;
    const gy = (vh - heroH) / 2;
    const slot: Box = {
      left: gx + (WORDMARK_PIN_SLOT.x - WORDMARK_VIEWBOX.x) * sc,
      top: gy + (WORDMARK_PIN_SLOT.y - WORDMARK_VIEWBOX.y) * sc,
      width: WORDMARK_PIN_SLOT.w * sc,
      height: WORDMARK_PIN_SLOT.h * sc,
    };
    // Hero pin: about 36% of the screen height, centred.
    //
    // Sharpness: WebKit (iOS/iPadOS WKWebView, Safari) rasterises an element at
    // its *layout* size and then scales that bitmap on the GPU for transform
    // animations. The pin used to be laid out at its small slot size and blown
    // up with scale(~4.7), so on phones it was a blurry, blocky upscale. Now the
    // pin is laid out at its LARGEST on-screen size (hero x pulse peak) and every
    // keyframe scales it DOWN (scale <= 1), so the GPU only ever downsamples a
    // full-resolution vector raster.
    const hk = (vh * 0.36) / slot.height;
    const peak = hk * 1.08; // biggest the pin gets (top of the pulse)
    const pinW = slot.width * peak;
    const pinH = slot.height * peak;
    const pinL = vw / 2 - pinW / 2;
    const pinT = vh / 2 - pinH / 2;
    // Where the pin ends: centred on the slot, at slot size.
    const endDx = slot.left + slot.width / 2 - vw / 2;
    const endDy = slot.top + slot.height / 2 - vh / 2;

    Object.assign(group.style, { left: `${gx}px`, top: `${gy}px`, width: `${heroW}px`, height: `${heroH}px` });
    Object.assign(pin.style, {
      left: `${pinL}px`, top: `${pinT}px`, width: `${pinW}px`, height: `${pinH}px`,
    });
    const T = INTRO;
    // One keyframed pin track, timed in ms of the whole intro (offsets = ms / revealEnd).
    const at = (ms: number) => ms / T.revealEnd;
    // s is the pin's size relative to the hero size (1 = hero); always <= peak/hk.
    const hero = (s: number, yOff = 0) => `translate(0px, ${yOff}px) scale(${(hk * s) / peak})`;
    const pinTrack: Keyframe[] = [
      // 0 to 0.8s: drop in from above, bounce to rest.
      { offset: 0, transform: hero(1, -vh * 0.6), easing: 'ease-out' },
      { offset: at(T.dropEnd * 0.9), transform: hero(1, 0), easing: 'cubic-bezier(.5,0,.9,.6)' },
      { offset: at(T.dropEnd + 60), transform: hero(1, -vh * 0.035), easing: 'ease-in' },
      { offset: at(T.dropEnd + 130), transform: hero(1, 0), easing: 'ease-out' },
      // 0.8 to 1.3s: small pulse (peak = scale(1), the layout size).
      { offset: at((T.dropEnd + T.pulseEnd) / 2), transform: hero(1.08, 0), easing: 'cubic-bezier(.37,0,.63,1)' },
      { offset: at(T.pulseEnd), transform: hero(1, 0), easing: 'cubic-bezier(.65,0,.35,1)' },
      // 1.3 to 1.7s: shrink into the second O, then sit there while the letters come out.
      { offset: at(T.shrinkEnd), transform: `translate(${endDx}px, ${endDy}px) scale(${1 / peak})` },
      { offset: 1, transform: `translate(${endDx}px, ${endDy}px) scale(${1 / peak})` },
    ];
    anims.push(pin.animate(pinTrack, { duration: T.revealEnd, fill: 'forwards' }));

    // Letters bounce out from behind the pin. Each letter is its own <img>,
    // laid out at its final (largest) size inside the group and drawn BELOW
    // the pin, so it starts hidden behind it. Transform + opacity only, and
    // every scale is <= 1 (see letterSpring), so letters stay crisp.
    const pinCx = (WORDMARK_PIN_SLOT.x + WORDMARK_PIN_SLOT.w / 2 - VB.x) * sc;
    const pinCy = (WORDMARK_PIN_SLOT.y + WORDMARK_PIN_SLOT.h / 2 - VB.y) * sc;
    const imgs = [...lettersBox.querySelectorAll<HTMLImageElement>('img[data-letter]')];
    const legs = imgs.map((img) => {
      const L = WORDMARK_LETTERS.find((l) => l.index === Number(img.dataset.letter))!;
      const cx = (L.x - VB.x + L.w / 2) * sc;
      const cy = (L.y - VB.y + L.h / 2) * sc;
      return { img, dx: pinCx - cx, dy: pinCy - cy, dist: Math.abs(pinCx - cx) };
    });
    const dmin = Math.min(...legs.map((l) => l.dist));
    const dmax = Math.max(...legs.map((l) => l.dist));
    for (const leg of legs) {
      const delay = letterEmergeDelay(leg.dist, dmin, dmax);
      const over = Math.min(heroW * 0.05, Math.max(heroW * 0.033, leg.dist * 0.09));
      anims.push(leg.img.animate(letterSpring(leg.dx, leg.dy, over), {
        duration: T.emergeDur, delay, fill: 'both',
      }));
      // Pops visible while still tucked behind the pin.
      anims.push(leg.img.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 110, delay, fill: 'both',
      }));
    }
    // Hand over to the static wordmark (same art, same pixels) once every
    // letter has settled: it carries the wordmark's own pin, so the flying pin
    // and the loose letters go at the same instant.
    const swap = { duration: 1, delay: T.revealEnd, fill: 'forwards' as const };
    anims.push(word.animate([{ opacity: 0 }, { opacity: 1 }], { ...swap, fill: 'both' }));
    anims.push(lettersBox.animate([{ opacity: 1 }, { opacity: 0 }], swap));
    anims.push(pin.animate([{ opacity: 1 }, { opacity: 0 }], swap));

    // Hold, then FLIP to the header logo of the page underneath.
    later(() => {
      const target = document.querySelector<HTMLElement>(TARGET);
      const tr = target?.getBoundingClientRect();
      // Land only on a logo that is actually on screen (not display:none, not
      // scrolled away); otherwise fade out rather than fly to a corner.
      const visible = !!tr && tr.width > 1 && tr.height > 1 && tr.bottom > 0 && tr.top < window.innerHeight;
      if (!target || !tr || !visible) {
        // Nothing to land on (a page without the header logo): fade out.
        anims.push(overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }));
        later(finish, 200);
        return;
      }
      const r = tr;
      const t = flipTransform(
        { left: gx, top: gy, width: heroW, height: heroH },
        { left: r.left, top: r.top, width: r.width, height: r.height },
      );
      overlay.style.pointerEvents = 'none';
      landing = target;
      target.style.visibility = 'hidden';
      const skip = overlay.querySelector<HTMLElement>('[data-intro-skip]');
      if (skip) anims.push(skip.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: 'forwards' }));
      const flipDur = T.flipEnd - T.holdEnd;
      anims.push(group.animate([
        { transform: 'translate(0px, 0px) scale(1)' },
        { transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale})` },
      ], { duration: flipDur, easing: 'cubic-bezier(.65,0,.25,1)', fill: 'forwards' }));
      anims.push(overlay.animate([
        { background: 'rgba(10,9,8,1)' },
        { background: 'rgba(10,9,8,0)' },
      ], { duration: flipDur, fill: 'forwards' }));
      later(finish, flipDur + 20);
    }, T.holdEnd);

    return () => {
      showLanding();
      timers.forEach((t) => window.clearTimeout(t));
      anims.forEach((a) => a.cancel());
      overlay.removeEventListener('pointerdown', finish);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (!active) return null;
  return (
    <div
      ref={overlayRef}
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#0a0908',
        overflow: 'hidden',
        touchAction: 'none',
      }}
    >
      {/* zIndex 0 makes the group its own stacking context, so the letters'
          z-order stays inside it and the pin (zIndex 1) is always on top. */}
      <div ref={groupRef} style={{ position: 'absolute', transformOrigin: '0 0', zIndex: 0, willChange: 'transform' }}>
        <img
          ref={wordRef}
          src={wordmarkUrl}
          alt=""
          draggable={false}
          style={{ display: 'block', width: '100%', height: '100%', opacity: 0 }}
        />
        <div ref={lettersRef} style={{ position: 'absolute', inset: 0 }}>
          {WORDMARK_LETTERS.map((l) => (
            <img
              key={l.index}
              data-letter={l.index}
              src={LETTER_SRC[l.index]}
              alt=""
              draggable={false}
              style={{
                position: 'absolute',
                left: `${((l.x - VB.x) / VB.w) * 100}%`,
                top: `${((l.y - VB.y) / VB.h) * 100}%`,
                width: `${(l.w / VB.w) * 100}%`,
                height: `${(l.h / VB.h) * 100}%`,
                transformOrigin: 'center 60%',
                zIndex: LETTER_Z[l.index],
                willChange: 'transform, opacity',
                opacity: 0,
              }}
            />
          ))}
        </div>
      </div>
      <img
        ref={pinRef}
        src={pinUrl}
        alt=""
        draggable={false}
        style={{ position: 'absolute', transformOrigin: 'center center', pointerEvents: 'none', zIndex: 1, willChange: 'transform' }}
      />
      <span
        data-intro-skip
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 'max(28px, env(safe-area-inset-bottom))',
          textAlign: 'center',
          fontFamily: 'var(--font-label)',
          fontSize: 10,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: '#6b645c',
        }}
      >
        Tap to skip
      </span>
    </div>
  );
}
