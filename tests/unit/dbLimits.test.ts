// 16 Nov audit leftovers: migration 20261116000002 (photo removal, handled reports, server limits).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const sql = readFileSync('supabase/migrations/20261116000002_photo_remove_report_count_limits.sql', 'utf8');

describe('20261116000002', () => {
  it('lets the uploader / a moderator find their photo so storage.remove() deletes it', () => {
    expect(sql).toMatch(/create policy "gossoko photos: read own" on storage\.objects for select/);
  });
  it('auto-hide counts only reports staff have not handled', () => {
    expect(sql).toMatch(/r\.status = 'pending' and r\.reviewed_at is null/);
  });
  it('limits match the form limits', () => {
    expect(sql).toMatch(/title[^)]*<= 120[\s\S]*body[^)]*<= 2000/);
    expect(sql).toMatch(/length\(body\) <= 1000/);
    expect(sql).toMatch(/discount_percentage between 1 and 99/);
  });
});
