// The sinsera.co login is shared with every other Sinsera app and the fleet daemons. supabase-js signs out
// GLOBALLY unless told otherwise, so a bare auth.signOut() in Gossoko logged the person out everywhere
// (16 Nov 2026 audit). Every call must name its scope; only the password-reset page may be global.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(__dirname, '..', '..', 'src');
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

describe('sign-out scope', () => {
  const calls = files(SRC).flatMap((f) =>
    [...readFileSync(f, 'utf8').matchAll(/auth\.signOut\(([^)]*)\)/g)].map((m) => ({ file: relative(SRC, f), arg: m[1].trim() })));

  it('finds the sign-out calls', () => { expect(calls.length).toBeGreaterThanOrEqual(2); });
  it('never signs out with the default (global) scope', () => {
    expect(calls.filter((c) => !/scope:\s*'(local|global)'/.test(c.arg))).toEqual([]);
  });
  it('only the password reset signs out everywhere', () => {
    expect(calls.filter((c) => /'global'/.test(c.arg)).map((c) => c.file)).toEqual(['pages/auth/reset/page.tsx']);
  });
});
