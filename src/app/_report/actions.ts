'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth/permissions';

const REPORT_TYPES = ['spam', 'offensive', 'inappropriate_image', 'fake_venue', 'other'] as const;
const REPORTABLE_TYPES = ['review', 'comment', 'user', 'venue'] as const;

type ReportType = typeof REPORT_TYPES[number];
type ReportableType = typeof REPORTABLE_TYPES[number];

export async function reportContent(formData: FormData): Promise<void> {
  const reportableType = String(formData.get('reportable_type') ?? '') as ReportableType;
  const reportableId = String(formData.get('reportable_id') ?? '');
  const reportType = String(formData.get('report_type') ?? '') as ReportType;
  const reason = String(formData.get('reason') ?? '').trim();
  const back = String(formData.get('back') ?? '/');

  if (!REPORTABLE_TYPES.includes(reportableType) || !reportableId
    || !REPORT_TYPES.includes(reportType) || reason.length < 4) {
    redirect(`${safeBack(back)}?report=invalid`);
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(back)}`);
  }

  const supabase = await createClient();
  const { data: report, error: insertErr } = await supabase
    .from('content_reports')
    .insert({
      reported_by: user.id,
      report_type: reportType,
      reason,
      reportable_type: reportableType,
      reportable_id: reportableId,
    })
    .select('id')
    .single();

  if (insertErr || !report) {
    console.error('[gossoko] content_reports insert failed:', insertErr?.message);
    redirect(`${safeBack(back)}?report=error`);
  }

  // Queue the report for moderator review. moderation_queue's INSERT policy
  // only allows auth.uid() IS NULL (system inserts), so we use the
  // service-role client. If it's not configured, the report still exists but
  // won't show up in the moderation queue UI — log a warn so it's visible.
  const admin = getAdminClient();
  if (admin) {
    const queueContentType = reportableType === 'venue' ? 'review' : reportableType;
    const { error: queueErr } = await admin.from('moderation_queue').insert({
      content_report_id: report.id,
      content_type: queueContentType,
      content_id: reportableId,
      priority: reportType === 'inappropriate_image' ? 'high' : 'normal',
    });
    if (queueErr) {
      console.warn('[gossoko] moderation_queue insert failed:', queueErr.message);
    }
  } else {
    console.warn('[gossoko] SUPABASE_SERVICE_ROLE_KEY unset — moderation_queue not populated for report', report.id);
  }

  revalidatePath(safeBack(back));
  redirect(`${safeBack(back)}?report=submitted`);
}

function safeBack(target: string): string {
  if (target.startsWith('/') && !target.startsWith('//')) return target;
  return '/';
}
