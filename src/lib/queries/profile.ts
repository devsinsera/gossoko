// Queries against gossoko.profiles for the signed-in user's identity card.

import { supabase as getSupabase } from '@/lib/supabase/client';

export interface OwnProfile {
  id: string;
  email: string;
  username: string;
  full_name: string;
  bio: string;
  avatar_url: string | null;
  trade_type: string | null;
  role: 'user' | 'moderator' | 'admin' | 'business';
  is_verified: boolean;
  reviews_count: number;
  followers_count: number;
  following_count: number;
  created_at: string;
}

type Row = {
  id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  trade_type: string | null;
  role: OwnProfile['role'];
  is_verified: boolean;
  reviews_count: number | null;
  followers_count: number | null;
  following_count: number | null;
  created_at: string;
};

export async function getOwnProfile(userId: string): Promise<OwnProfile | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, bio, avatar_url, trade_type, role, is_verified, reviews_count, followers_count, following_count, created_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('[gossoko] getOwnProfile failed:', error.message);
    return null;
  }
  if (!data) return null;
  const r = { ...(data as Omit<Row, 'email'>), email: (await getEmails([userId])).get(userId) ?? '' } as Row;
  return {
    id: r.id,
    email: r.email,
    username: r.username ?? r.email.split('@')[0],
    full_name: r.full_name ?? r.username ?? r.email.split('@')[0],
    bio: r.bio ?? '',
    avatar_url: r.avatar_url,
    trade_type: r.trade_type,
    role: r.role,
    is_verified: r.is_verified,
    reviews_count: Number(r.reviews_count ?? 0),
    followers_count: Number(r.followers_count ?? 0),
    following_count: Number(r.following_count ?? 0),
    created_at: r.created_at,
  };
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'GO';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Email addresses for these profiles: your own, or anyone's when you are staff. The email column
 * isn't readable through the table (it was public until 15 Nov 2026); the database answers this.
 */
export async function getEmails(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!ids.length) return out;
  const { data, error } = await getSupabase().rpc('profile_emails', { p_ids: ids });
  if (error) { console.error('[gossoko] profile_emails failed:', error.message); return out; }
  for (const r of (data ?? []) as { id: string; email: string | null }[]) if (r.email) out.set(r.id, r.email);
  return out;
}
