// Calls the gossoko-admin edge function (the only holder of the service-role key).
import { supabase } from '@/lib/supabase/client';

async function call(body: Record<string, unknown>): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase().functions.invoke('gossoko-admin', { body });
  if (error) {
    // FunctionsHttpError carries the response; surface its JSON error code if present.
    const res = (error as { context?: Response }).context;
    if (res && typeof res.json === 'function') {
      try {
        const j = await res.json();
        if (j?.error) return { ok: false, error: String(j.error) };
      } catch { /* fall through */ }
    }
    return { ok: false, error: error.message };
  }
  if (data?.error) return { ok: false, error: String(data.error) };
  return { ok: true };
}

export const queueReport = (reportId: string) => call({ action: 'queue_report', reportId });

export const writeAudit = (a: {
  actionType: string; resourceType: string; resourceId: string;
  newValues?: unknown; reason?: string | null;
}) => call({ action: 'audit', ...a });

export const setUserRole = (userId: string, role: string) => call({ action: 'set_role', userId, role });
