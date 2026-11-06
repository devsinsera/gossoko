// The signed-in user's inbox. Rows are written by database triggers; clients only read and mark read.

import { supabase as getSupabase } from '@/lib/supabase/client';

export interface Notice {
  id: string;
  type: string;
  title: string;
  body: string | null;
  created_at: string;
  is_read: boolean;
  venue_slug: string | null;
}

type Row = Omit<Notice, 'venue_slug'> & { related_id: string | null; related_type: string | null };

export async function getNotices(limit = 50): Promise<Notice[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, body, created_at, is_read, related_id, related_type')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];
  const ids = [...new Set(rows.filter((r) => r.related_type === 'venue' && r.related_id).map((r) => r.related_id as string))];
  const slugs = new Map<string, string>();
  if (ids.length) {
    const v = await supabase.from('venues').select('id, slug').in('id', ids);
    if (v.error) throw new Error(v.error.message);
    for (const x of (v.data ?? []) as { id: string; slug: string }[]) slugs.set(x.id, x.slug);
  }
  return rows.map(({ related_id, related_type, ...n }) => ({ ...n, venue_slug: related_type === 'venue' && related_id ? slugs.get(related_id) ?? null : null }));
}

export async function unreadCount(): Promise<number> {
  const { count, error } = await getSupabase()
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
    .eq('is_read', false);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function markAllRead(): Promise<void> {
  const { error } = await getSupabase().from('notifications').update({ is_read: true }).eq('is_read', false);
  if (error) throw new Error(error.message);
}
