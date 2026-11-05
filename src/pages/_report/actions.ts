import { supabase } from '@/lib/supabase/client';
import { getCurrentUser } from '@/lib/auth/permissions';
import { queueReport } from '@/lib/api/admin';
import { invalidate } from '@/lib/useLoad';

export const REPORT_TYPES = ['spam', 'offensive', 'inappropriate_image', 'fake_venue', 'other'] as const;
export const REPORTABLE_TYPES = ['review', 'comment', 'user', 'venue'] as const;
export type ReportType = typeof REPORT_TYPES[number];
export type ReportableType = typeof REPORTABLE_TYPES[number];

export type ReportOutcome = 'submitted' | 'invalid' | 'error' | 'unauthenticated';

export async function reportContent(input: {
  reportableType: string;
  reportableId: string;
  reportType: string;
  reason: string;
}): Promise<ReportOutcome> {
  const reason = input.reason.trim();
  if (!(REPORTABLE_TYPES as readonly string[]).includes(input.reportableType) || !input.reportableId
    || !(REPORT_TYPES as readonly string[]).includes(input.reportType) || reason.length < 4) {
    return 'invalid';
  }
  const user = await getCurrentUser();
  if (!user) return 'unauthenticated';

  const { data: report, error } = await supabase()
    .from('content_reports')
    .insert({
      reported_by: user.id,
      report_type: input.reportType,
      reason,
      reportable_type: input.reportableType,
      reportable_id: input.reportableId,
    })
    .select('id')
    .single();
  if (error || !report) {
    console.error('[gossoko] content_reports insert failed:', error?.message);
    return 'error';
  }

  // The moderation queue only accepts system inserts, so the gossoko-admin edge
  // function files it. The report itself is already saved either way.
  const q = await queueReport(report.id);
  if (!q.ok) console.warn('[gossoko] moderation queue insert failed:', q.error);

  invalidate();
  return 'submitted';
}
