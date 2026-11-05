import { describe, it, expect } from 'vitest';
import { safeNext } from '@/lib/nav';

describe('safeNext (post-login redirect)', () => {
  it('keeps same-origin paths', () => {
    expect(safeNext('/venue/the-smoko-stop')).toBe('/venue/the-smoko-stop');
  });
  it('rejects absolute and protocol-relative URLs', () => {
    expect(safeNext('https://evil.example')).toBe('/');
    expect(safeNext('//evil.example')).toBe('/');
    expect(safeNext(null)).toBe('/');
    expect(safeNext('')).toBe('/');
  });
});
