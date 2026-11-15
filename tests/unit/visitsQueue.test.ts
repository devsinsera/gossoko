// 16 Nov audit: a check-in that got no answer from the server (no signal) must wait, not be dropped.
import { describe, it, expect } from 'vitest';
import { noAnswer } from '@/lib/visits';

describe('visit upload: no signal vs refused', () => {
  it('a fetch failure is "no answer": the visit waits', () => {
    expect(noAnswer({ message: 'TypeError: Failed to fetch' })).toBe(true);
    expect(noAnswer({ message: 'Load failed' })).toBe(true);
    expect(noAnswer({ message: 'NetworkError when attempting to fetch resource.' })).toBe(true);
  });
  it('a server refusal (has a code) is an answer: the visit is dropped', () => {
    expect(noAnswer({ code: 'P0001', message: 'too far from the venue' })).toBe(false);
    expect(noAnswer({ code: '42501', message: 'permission denied' })).toBe(false);
  });
  it('success is not "no answer"', () => { expect(noAnswer(null)).toBe(false); });
});
