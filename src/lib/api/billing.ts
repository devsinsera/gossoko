// Calls the gossoko-billing edge function (Stripe checkout / billing portal).
import { supabase } from '@/lib/supabase/client';

type Out = { ok: true; url: string } | { ok: false; error: string };

async function call(body: Record<string, unknown>): Promise<{ data?: Record<string, unknown>; error?: string }> {
  const { data, error } = await supabase().functions.invoke('gossoko-billing', { body });
  if (error) {
    const res = (error as { context?: Response }).context;
    if (res && typeof res.json === 'function') {
      try {
        const j = await res.json();
        if (j?.error) return { error: String(j.error) };
      } catch { /* fall through */ }
    }
    return { error: error.message };
  }
  return { data };
}

/** Is online payment switched on? False when the function or its Stripe secrets aren't set. */
export async function billingEnabled(): Promise<boolean> {
  const { data } = await call({ action: 'config' });
  return data?.enabled === true;
}

async function session(action: 'checkout' | 'portal', venueId: string): Promise<Out> {
  const { data, error } = await call({ action, venue_id: venueId, return_url: window.location.href.split('?')[0] });
  if (error || typeof data?.url !== 'string') return { ok: false, error: error ?? 'Couldn\'t open the payment page.' };
  return { ok: true, url: data.url };
}

export const startCheckout = (venueId: string) => session('checkout', venueId);
export const openBillingPortal = (venueId: string) => session('portal', venueId);
