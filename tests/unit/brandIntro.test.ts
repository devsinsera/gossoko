import { describe, expect, it } from 'vitest';
import {
  INTRO,
  INTRO_SESSION_KEY,
  flipTransform,
  letterEmergeDelay,
  letterSpring,
  markIntroPlayed,
  shouldPlayIntro,
  type IntroStorage,
} from '@/lib/brandIntro';

function memory(initial: Record<string, string> = {}): IntroStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = v; },
  };
}

describe('shouldPlayIntro', () => {
  it('plays on a first load of the session', () => {
    expect(shouldPlayIntro(memory(), false)).toBe(true);
  });

  it('does not play again once it has played this session', () => {
    const store = memory();
    markIntroPlayed(store);
    expect(store.data[INTRO_SESSION_KEY]).toBe('1');
    expect(shouldPlayIntro(store, false)).toBe(false);
  });

  it('never plays with reduced motion', () => {
    expect(shouldPlayIntro(memory(), true)).toBe(false);
  });

  it('plays when there is no storage at all', () => {
    expect(shouldPlayIntro(null, false)).toBe(true);
  });

  it('plays when storage throws (private mode, blocked site data)', () => {
    const broken: IntroStorage = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    };
    expect(shouldPlayIntro(broken, false)).toBe(true);
    expect(() => markIntroPlayed(broken)).not.toThrow();
  });
});

describe('INTRO timeline', () => {
  it('keeps the sequence in order and under the 2.8s cap', () => {
    expect(INTRO.dropEnd).toBeLessThan(INTRO.pulseEnd);
    expect(INTRO.pulseEnd).toBeLessThan(INTRO.shrinkEnd);
    expect(INTRO.shrinkEnd).toBeLessThan(INTRO.revealEnd);
    expect(INTRO.pulseEnd).toBeLessThan(INTRO.revealEnd);
    expect(INTRO.revealEnd).toBeLessThanOrEqual(INTRO.holdEnd);
    expect(INTRO.holdEnd).toBeLessThan(INTRO.flipEnd);
    expect(INTRO.flipEnd).toBeLessThanOrEqual(INTRO.hardCap);
    expect(INTRO.hardCap).toBeLessThanOrEqual(2800);
  });

  it('lets the farthest letter settle by the end of the reveal', () => {
    // Letters start emerging while the pin is still shrinking (so they come
    // out from behind it), and the last one has finished before the hold.
    expect(INTRO.emergeStart).toBeGreaterThan(INTRO.pulseEnd);
    expect(INTRO.emergeStart).toBeLessThan(INTRO.shrinkEnd);
    expect(INTRO.emergeStart + INTRO.emergeSpread + INTRO.emergeDur).toBeLessThanOrEqual(INTRO.revealEnd);
  });
});

describe('letter bounce', () => {
  it('brings the nearest letters out first', () => {
    const near = letterEmergeDelay(40, 40, 170);
    const mid = letterEmergeDelay(100, 40, 170);
    const far = letterEmergeDelay(170, 40, 170);
    expect(near).toBe(INTRO.emergeStart);
    expect(near).toBeLessThan(mid);
    expect(mid).toBeLessThan(far);
    expect(far).toBe(INTRO.emergeStart + INTRO.emergeSpread);
    // Degenerate span: everyone together, never NaN.
    expect(letterEmergeDelay(5, 5, 5)).toBe(INTRO.emergeStart);
  });

  const scales = (kf: Keyframe[]) =>
    kf.flatMap((k) => {
      const m = /scale\(([^,]+), ([^)]+)\)/.exec(String(k.transform));
      return m ? [Number(m[1]), Number(m[2])] : [];
    });
  const translate = (k: Keyframe) => {
    const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(String(k.transform))!;
    return [Number(m[1]), Number(m[2])];
  };

  it('starts at the pin centre and ends exactly at rest', () => {
    const kf = letterSpring(120, -6, 12);
    expect(translate(kf[0])).toEqual([120, -6]);
    expect(kf[kf.length - 1].transform).toBe('translate(0px, 0px) scale(1, 1)');
    expect(kf.map((k) => k.offset)).toEqual([...kf.map((k) => k.offset)].sort());
  });

  it('overshoots outwards (away from the pin), then settles', () => {
    // Letter left of the pin: pin is at +dx, so outwards is -x.
    const left = letterSpring(150, 0, 10);
    expect(translate(left[1])[0]).toBeCloseTo(-10);
    expect(translate(left[2])[0]).toBeGreaterThan(0); // swings back past rest
    // Letter right of the pin: outwards is +x.
    const right = letterSpring(-80, 0, 10);
    expect(translate(right[1])[0]).toBeCloseTo(10);
  });

  it('never scales a letter above 1 (crisp on iOS: downsample only)', () => {
    for (const kf of [letterSpring(150, 4, 14), letterSpring(-40, -3, 9)]) {
      const s = scales(kf);
      expect(s.length).toBeGreaterThan(0);
      expect(Math.max(...s)).toBeLessThanOrEqual(1);
      expect(Math.min(...s)).toBeGreaterThan(0);
      // Transform only: no filters or clip paths in the letter track.
      for (const k of kf) expect(Object.keys(k).sort()).toEqual(['easing', 'offset', 'transform'].filter((p) => p in k));
    }
  });
});

describe('flipTransform', () => {
  it('moves a box onto a target and scales it to the target width', () => {
    const t = flipTransform(
      { left: 100, top: 300, width: 500, height: 100 },
      { left: 20, top: 16, width: 125, height: 25 },
    );
    expect(t.x).toBe(-80);
    expect(t.y).toBe(-284);
    expect(t.scale).toBeCloseTo(0.25);
  });

  it('is the identity when the target equals the start', () => {
    const b = { left: 4, top: 8, width: 200, height: 40 };
    expect(flipTransform(b, b)).toEqual({ x: 0, y: 0, scale: 1 });
  });
});
