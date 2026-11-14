// Opening logo animation: timings and the rules for when it plays.
// The overlay itself lives in components/BrandIntro.tsx; this file has no DOM
// so the rules can be tested.

/** Once per session (sessionStorage), and never with reduced motion. */
export const INTRO_SESSION_KEY = 'gossoko.intro.v1';

/** Timeline, in ms from start. Reference: the 3.4s brand clip, compressed. */
export const INTRO = {
  dropEnd: 800,      // pin drops in from above, bounces to rest at centre
  pulseEnd: 1300,    // small pulse at centre
  shrinkEnd: 1700,   // pin shrinks into the second O
  emergeStart: 1380, // first (nearest) letters start springing out from behind the pin
  emergeSpread: 220, // the farthest letter (G) starts this much later
  emergeDur: 640,    // each letter's spring, start to settled
  revealEnd: 2250,   // last letter settled; static wordmark takes over
  holdEnd: 2290,     // logo holds briefly
  flipEnd: 2680,     // logo flies to the header spot (FLIP)
  hardCap: 2800,     // never longer than this, whatever is loaded
} as const;

/**
 * Stagger for the letter bounce: nearest letters to the pin come out first.
 * `dist` is the letter's distance from the pin centre; dmin/dmax are the
 * nearest and farthest letters. Returns the delay in ms from intro start.
 */
export function letterEmergeDelay(dist: number, dmin: number, dmax: number): number {
  const span = dmax - dmin;
  const t = span > 0 ? Math.min(1, Math.max(0, (dist - dmin) / span)) : 0;
  return Math.round(INTRO.emergeStart + t * INTRO.emergeSpread);
}

/**
 * One letter's spring out from behind the pin, as Web Animations keyframes
 * (transform only). (dx, dy) is the pin centre relative to the letter's
 * resting centre, in px; `over` is the overshoot in px past the resting spot.
 * The letter starts small at the pin centre, shoots out past its spot with a
 * little horizontal squash, swings back, settles. Every scale is <= 1 so a
 * letter laid out at its final size is only ever downsampled (stays crisp).
 */
export function letterSpring(dx: number, dy: number, over: number): Keyframe[] {
  const len = Math.hypot(dx, dy) || 1;
  // Unit vector pointing outwards (from the pin towards the letter's spot).
  const ux = -dx / len;
  const uy = -dy / len;
  const at = (k: number) => `${(ux * over * k).toFixed(2)}px, ${(uy * over * k).toFixed(2)}px`;
  return [
    { offset: 0, transform: `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) scale(0.5, 0.5)`, easing: 'cubic-bezier(.25,.8,.35,1)' },
    { offset: 0.46, transform: `translate(${at(1)}) scale(0.9, 1)`, easing: 'cubic-bezier(.4,0,.5,1)' },
    { offset: 0.7, transform: `translate(${at(-0.32)}) scale(1, 0.95)`, easing: 'cubic-bezier(.4,0,.5,1)' },
    { offset: 0.86, transform: `translate(${at(0.1)}) scale(0.98, 1)`, easing: 'ease-out' },
    { offset: 1, transform: 'translate(0px, 0px) scale(1, 1)' },
  ];
}

/** Minimal storage shape so tests can pass a fake. */
export type IntroStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** True when the intro should run: not reduced motion, not already played this session. */
export function shouldPlayIntro(storage: IntroStorage | null, reducedMotion: boolean): boolean {
  if (reducedMotion) return false;
  try {
    return storage?.getItem(INTRO_SESSION_KEY) !== '1';
  } catch {
    // Storage blocked (private mode, cleared site data): play once per load.
    return true;
  }
}

/** Record that the intro has played this session. Never throws. */
export function markIntroPlayed(storage: IntroStorage | null): void {
  try {
    storage?.setItem(INTRO_SESSION_KEY, '1');
  } catch {
    // Nothing to do: the intro may play again on the next load.
  }
}

export type Box = { left: number; top: number; width: number; height: number };

/**
 * FLIP: the transform that moves a logo of `from` size and position onto `to`.
 * The group is anchored at its top-left (transform-origin 0 0).
 */
export function flipTransform(from: Box, to: Box): { x: number; y: number; scale: number } {
  return {
    x: to.left - from.left,
    y: to.top - from.top,
    scale: to.width / from.width,
  };
}
