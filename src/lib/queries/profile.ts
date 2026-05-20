// Queries against gossoko.profiles for the signed-in user's identity card.

import { createClient } from '@/lib/supabase/server';

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
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, username, full_name, bio, avatar_url, trade_type, role, is_verified, reviews_count, followers_count, following_count, created_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('[gossoko] getOwnProfile failed:', error.message);
    return null;
  }
  if (!data) return null;
  const r = data as Row;
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
