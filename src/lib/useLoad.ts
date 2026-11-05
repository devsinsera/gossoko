import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

const EVENT = 'gossoko:invalidate';

/** Tell every mounted loader to re-fetch (the browser equivalent of revalidatePath). */
export function invalidate(): void {
  window.dispatchEvent(new Event(EVENT));
}

export interface Loaded<T> {
  data: T | undefined;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Runs an async loader on mount and whenever deps change; ignores stale results. */
export function useLoad<T>(fn: () => Promise<T>, deps: DependencyList): Loaded<T> {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let live = true;
    setLoading(true);
    fnRef.current().then(
      (d) => { if (live) { setData(d); setError(null); setLoading(false); } },
      (e) => { if (live) { setError(e instanceof Error ? e.message : String(e)); setLoading(false); } },
    );
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  useEffect(() => {
    window.addEventListener(EVENT, reload);
    return () => window.removeEventListener(EVENT, reload);
  }, [reload]);
  return { data, loading, error, reload };
}
