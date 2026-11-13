import { describe, expect, it } from 'vitest';
import {
  INTRO,
  INTRO_SESSION_KEY,
  flipTransform,
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
  it('keeps the sequence in order and under the 2.5s cap', () => {
    expect(INTRO.dropEnd).toBeLessThan(INTRO.pulseEnd);
    expect(INTRO.pulseEnd).toBeLessThan(INTRO.revealEnd);
    expect(INTRO.revealEnd).toBeLessThanOrEqual(INTRO.holdEnd);
    expect(INTRO.holdEnd).toBeLessThan(INTRO.flipEnd);
    expect(INTRO.flipEnd).toBeLessThanOrEqual(INTRO.hardCap);
    expect(INTRO.hardCap).toBeLessThanOrEqual(2500);
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
