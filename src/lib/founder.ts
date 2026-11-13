import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase as getSupabase } from '@/lib/supabase/client';

const cache = new Map<string, boolean>();

/** True for admins (the Founder page), false for everyone else, null while checking. Cached per account. */
export function useIsFounder(): boolean | null {
  const { user } = useAuth();
  const id = user?.id ?? null;
  const [v, setV] = useState<boolean | null>(id ? cache.get(id) ?? null : false);
  useEffect(() => {
    if (!id) { setV(false); return; }
    if (cache.has(id)) { setV(cache.get(id)!); return; }
    let live = true;
    getSupabase().rpc('is_admin').then(({ data, error }) => {
      if (!live) return;
      if (error) { console.warn('[gossoko] founder check failed:', error.message); setV(false); return; }
      cache.set(id, data === true);
      setV(data === true);
    });
    return () => { live = false; };
  }, [id]);
  return v;
}
