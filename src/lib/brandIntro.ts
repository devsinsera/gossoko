// Opening logo animation: timings and the rules for when it plays.
// The overlay itself lives in components/BrandIntro.tsx; this file has no DOM
// so the rules can be tested.

/** Once per session (sessionStorage), and never with reduced motion. */
export const INTRO_SESSION_KEY = 'gossoko.intro.v1';

/** Timeline, in ms from start. Reference: the 3.4s brand clip, compressed. */
export const INTRO = {
  dropEnd: 800,      // pin drops in from above, bounces to rest at centre
  pulseEnd: 1300,    // small pulse at centre
  revealEnd: 2000,   // pin shrinks into the O; letters reveal outwards
  holdEnd: 2150,     // logo holds briefly
  flipEnd: 2400,     // logo flies to the header spot (FLIP)
  hardCap: 2500,     // never longer than this, whatever is loaded
} as const;

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
