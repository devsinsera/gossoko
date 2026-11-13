import { useEffect, useRef, useState } from 'react';
import pinUrl from '@/assets/brand/gossoko-pin.svg';
import wordmarkUrl from '@/assets/brand/gossoko-wordmark.svg';
import { WORDMARK_PIN_SLOT, WORDMARK_VIEWBOX } from '@/assets/brand/wordmark-geometry';
import { flipTransform, INTRO, markIntroPlayed, shouldPlayIntro, type Box } from '@/lib/brandIntro';

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
 * Opening animation, once per session. Pin drops in, pulses, shrinks into the
 * second O while the letters reveal outwards, holds, then flies (FLIP) to the
 * header logo of the page underneath. Tap anywhere to skip. The page renders
 * underneath, so the intro never holds up loading.
 */
export function BrandIntro() {
  const [active, setActive] = useState(() =>
    typeof window !== 'undefined' &&
    shouldPlayIntro(sessionStore(), window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false),
  );
  const overlayRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const wordRef = useRef<HTMLImageElement>(null);
  const pinRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!active) return;
    const overlay = overlayRef.current;
    const group = groupRef.current;
    const word = wordRef.current;
    const pin = pinRef.current;
    if (!overlay || !group || !word || !pin) return;

    const anims: Animation[] = [];
    const timers: number[] = [];
    let done = false;

    const later = (fn: () => void, ms: number) => {
      timers.push(window.setTimeout(fn, ms));
    };
    const finish = () => {
      if (done) return;
      done = true;
      timers.forEach((t) => window.clearTimeout(t));
      anims.forEach((a) => a.cancel());
      overlay.removeEventListener('pointerdown', finish);
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
    // Hero pin: about 36% of the screen height, centred. Transforms are relative to the slot.
    const hk = (vh * 0.36) / slot.height;
    const dx = vw / 2 - (slot.left + slot.width / 2);
    const dy = vh / 2 - (slot.top + slot.height / 2);

    Object.assign(group.style, { left: `${gx}px`, top: `${gy}px`, width: `${heroW}px`, height: `${heroH}px` });
    Object.assign(pin.style, {
      left: `${slot.left}px`, top: `${slot.top}px`, width: `${slot.width}px`, height: `${slot.height}px`,
    });
    // Reveal: letters open outwards from the pin slot.
    const cxPct = ((slot.left + slot.width / 2 - gx) / heroW) * 100;
    const closed = `inset(0 ${100 - cxPct}% 0 ${cxPct}%)`;
    const open = 'inset(0 0% 0 0%)';

    const T = INTRO;
    // One keyframed pin track, timed in ms of the whole intro (offsets = ms / revealEnd).
    const at = (ms: number) => ms / T.revealEnd;
    const hero = (s: number, yOff = 0) => `translate(${dx}px, ${dy + yOff}px) scale(${s})`;
    const pinTrack: Keyframe[] = [
      // 0 to 0.8s: drop in from above, bounce to rest.
      { offset: 0, transform: hero(hk, -vh * 0.6), easing: 'ease-out' },
      { offset: at(T.dropEnd * 0.9), transform: hero(hk, 0), easing: 'ease-in' },
      { offset: at(T.dropEnd + 60), transform: hero(hk, -vh * 0.035), easing: 'ease-in' },
      { offset: at(T.dropEnd + 130), transform: hero(hk, 0), easing: 'ease-out' },
      // 0.8 to 1.3s: small pulse.
      { offset: at((T.dropEnd + T.pulseEnd) / 2), transform: hero(hk * 1.08, 0), easing: 'ease-in-out' },
      { offset: at(T.pulseEnd), transform: hero(hk, 0), easing: 'cubic-bezier(.6,0,.3,1)' },
      // 1.3 to 2.0s: shrink into the second O.
      { offset: 1, transform: 'translate(0px, 0px) scale(1)' },
    ];
    anims.push(pin.animate(pinTrack, { duration: T.revealEnd, fill: 'forwards' }));
    // The wordmark's own pin takes over at the end of the reveal.
    anims.push(pin.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 50, delay: T.revealEnd, fill: 'forwards',
    }));
    // Letters reveal outwards from the slot.
    anims.push(word.animate([{ clipPath: closed }, { clipPath: open }], {
      duration: T.revealEnd - T.pulseEnd,
      delay: T.pulseEnd,
      easing: 'cubic-bezier(.6,0,.3,1)',
      fill: 'both',
    }));

    // Hold, then FLIP to the header logo of the page underneath.
    later(() => {
      const target = document.querySelector<HTMLElement>(TARGET);
      if (!target) {
        // Nothing to land on (a page without the header logo): fade out.
        anims.push(overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }));
        later(finish, 200);
        return;
      }
      const r = target.getBoundingClientRect();
      const t = flipTransform(
        { left: gx, top: gy, width: heroW, height: heroH },
        { left: r.left, top: r.top, width: r.width, height: r.height },
      );
      overlay.style.pointerEvents = 'none';
      const flipDur = T.flipEnd - T.holdEnd;
      anims.push(group.animate([
        { transform: 'translate(0px, 0px) scale(1)' },
        { transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale})` },
      ], { duration: flipDur, easing: 'cubic-bezier(.6,0,.3,1)', fill: 'forwards' }));
      anims.push(overlay.animate([
        { background: 'rgba(10,9,8,1)' },
        { background: 'rgba(10,9,8,0)' },
      ], { duration: flipDur, fill: 'forwards' }));
      later(finish, flipDur + 20);
    }, T.holdEnd);

    return () => {
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
      <div ref={groupRef} style={{ position: 'absolute', transformOrigin: '0 0' }}>
        <img
          ref={wordRef}
          src={wordmarkUrl}
          alt=""
          draggable={false}
          style={{ display: 'block', width: '100%', height: '100%' }}
        />
      </div>
      <img
        ref={pinRef}
        src={pinUrl}
        alt=""
        draggable={false}
        style={{ position: 'absolute', transformOrigin: 'center center', pointerEvents: 'none' }}
      />
      <span
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
