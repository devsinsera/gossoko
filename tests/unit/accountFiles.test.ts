import { describe, it, expect } from 'vitest';
import { collectAccountFiles, removeAccountFiles, PHOTO_BUCKET, type FilesClient } from '../../supabase/functions/gossoko-admin/accountFiles';

const ME = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';

function fake(rows: string[], objects: Record<string, string[]>) {
  const removed: string[][] = [];
  const buckets: string[] = [];
  const client: FilesClient = {
    from: () => ({ select: () => ({ eq: async (_c: string, v: string) => ({ data: rows.filter((p) => p.startsWith(v)).map((path) => ({ path })), error: null }) }) }),
    storage: {
      from: (bucket: string) => {
        buckets.push(bucket);
        return {
          list: async (prefix: string, { limit, offset }: { limit: number; offset: number }) =>
            ({ data: (objects[prefix] ?? []).slice(offset, offset + limit).map((name) => ({ name, id: 'x' })), error: null }),
          remove: async (paths: string[]) => { removed.push(paths); return { data: null, error: null }; },
        };
      },
    },
  };
  return { client, removed, buckets };
}

describe('account deletion removes photo files', () => {
  it('removes recorded photos and orphans in the user folder, from the gossoko-photos bucket', async () => {
    const f = fake([`${ME}/a.jpg`, `${ME}/b.jpg`, `${OTHER}/z.jpg`], { [ME]: ['b.jpg', 'orphan.jpg'], [OTHER]: ['z.jpg'] });
    const n = await removeAccountFiles(f.client, ME);
    expect(n).toBe(3);
    expect(f.removed.flat().sort()).toEqual([`${ME}/a.jpg`, `${ME}/b.jpg`, `${ME}/orphan.jpg`]);
    expect(new Set(f.buckets)).toEqual(new Set([PHOTO_BUCKET]));
  });

  it('never returns a path outside the user folder', async () => {
    const f = fake([], { [ME]: Array.from({ length: 1500 }, (_, i) => `${i}.jpg`) });
    const paths = await collectAccountFiles(f.client, ME);
    expect(paths).toHaveLength(1500);                 // pages through the folder
    expect(paths.every((p) => p.startsWith(`${ME}/`))).toBe(true);
  });

  it('refuses a malformed user id', async () => {
    await expect(removeAccountFiles(fake([], {}).client, '../etc')).rejects.toThrow();
  });

  it('the edge function calls it before deleting the profile rows', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../../supabase/functions/gossoko-admin/index.ts', import.meta.url), 'utf8');
    const del = src.slice(src.indexOf("case 'delete_account'"));
    expect(del.indexOf('removeAccountFiles(')).toBeGreaterThan(0);
    expect(del.indexOf('removeAccountFiles(')).toBeLessThan(del.indexOf(".from('profiles').delete()"));
  });

  it('the privacy policy no longer asks people to email us to erase image files', async () => {
    const { readFileSync } = await import('node:fs');
    const html = readFileSync(new URL('../../privacy/index.html', import.meta.url), 'utf8');
    expect(html).not.toMatch(/aren&rsquo;t wiped automatically/);
    expect(html).toMatch(/image files in our storage/);
  });
});
