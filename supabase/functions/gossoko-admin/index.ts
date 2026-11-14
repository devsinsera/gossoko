// gossoko-admin — the only place the service-role key is used for Gossoko.
//
// The SPA ships the public anon key only, so the three things that need to
// bypass RLS run here, each after proving who the caller is and what they may do:
//   queue_report  put the caller's own report into the moderation queue
//   audit         write an audit_logs row for a moderation decision
//   set_role      change another user's role (+ audit)
//   delete_account  the caller deletes their own account, everything attached to it, and their photo files
//
// Deploy: supabase functions deploy gossoko-admin --project-ref lkhtgkmivqwgnvzmjbhr
// (slug is app-prefixed on purpose: one project hosts every app's functions.)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { removeAccountFiles, type FilesClient } from './accountFiles.ts';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const ROLES = ['user', 'moderator', 'admin', 'business'];

// audit action prefix -> permission the caller must hold
const AUDIT_PERMISSION: Record<string, string> = {
  review: 'approve_content',
  comment: 'approve_content',
  venue: 'approve_venue',
  venue_claim: 'verify_venue_claim',
  moderation: 'resolve_report',
};

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const auth = req.headers.get('Authorization') ?? '';
  // Caller-scoped client: RLS and has_permission() see the real user.
  const asUser = createClient(URL_, ANON, {
    db: { schema: 'gossoko' },
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: { user }, error: userErr } = await asUser.auth.getUser();
  if (userErr || !user) return json({ error: 'Not signed in' }, 401);

  const admin = createClient(URL_, SERVICE, { db: { schema: 'gossoko' }, auth: { persistSession: false } });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: 'Bad JSON' }, 400); }

  const can = async (perm: string): Promise<boolean> => {
    const { data, error } = await asUser.rpc('has_permission', { p_permission: perm });
    return !error && Boolean(data);
  };

  switch (body.action) {
    case 'queue_report': {
      const reportId = String(body.reportId ?? '');
      if (!reportId) return json({ error: 'reportId required' }, 400);
      // Only the reporter's own report can be queued.
      const { data: report } = await admin
        .from('content_reports')
        .select('id, reported_by, report_type, reportable_type, reportable_id')
        .eq('id', reportId)
        .maybeSingle();
      if (!report || report.reported_by !== user.id) return json({ error: 'Report not found' }, 404);
      // moderation_queue.content_type allows review|comment|user|venue (migration 20261110000001).
      const contentType = report.reportable_type;
      const { error } = await admin.from('moderation_queue').insert({
        content_report_id: report.id,
        content_type: contentType,
        content_id: report.reportable_id,
        priority: report.report_type === 'inappropriate_image' ? 'high' : 'normal',
      });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    case 'audit': {
      const actionType = String(body.actionType ?? '');
      const prefix = actionType.split('.')[0];
      const perm = AUDIT_PERMISSION[prefix];
      if (!perm || !(await can(perm))) return json({ error: 'Not allowed' }, 403);
      const { error } = await admin.from('audit_logs').insert({
        actor_id: user.id,
        action_type: actionType,
        resource_type: String(body.resourceType ?? ''),
        resource_id: String(body.resourceId ?? ''),
        new_values: body.newValues ?? null,
        reason: body.reason ?? null,
      });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    case 'set_role': {
      if (!(await can('edit_user_role'))) return json({ error: 'Not allowed' }, 403);
      const targetId = String(body.userId ?? '');
      const role = String(body.role ?? '');
      if (!targetId) return json({ error: 'missing_user' }, 400);
      if (!ROLES.includes(role)) return json({ error: 'invalid_role' }, 400);
      if (targetId === user.id) return json({ error: 'self' }, 400); // no self-lockout
      const { data: target } = await admin.from('profiles').select('id, role').eq('id', targetId).maybeSingle();
      if (!target) return json({ error: 'not_found' }, 404);
      if (target.role === role) return json({ error: 'nochange' }, 400);
      const { error: upErr } = await admin
        .from('profiles')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('id', targetId);
      if (upErr) return json({ error: 'update_failed', detail: upErr.message }, 500);
      const { error: auditErr } = await admin.from('audit_logs').insert({
        actor_id: user.id,
        action_type: 'edit_user_role',
        resource_type: 'profile',
        resource_id: targetId,
        old_values: { role: target.role },
        new_values: { role },
      });
      if (auditErr) console.warn('[gossoko-admin] audit write failed:', auditErr.message);
      return json({ ok: true });
    }

    case 'delete_account': {
      // The caller deletes their OWN account. Their photo files are removed from storage, then the
      // profile row (profiles has no foreign key to auth.users; it cascades to their reviews, comments,
      // likes, saved spots, deal codes, claims, requests and photo rows), then the login. Venues they
      // added stay, un-owned.
      if (body.confirm !== 'DELETE') return json({ error: 'confirm' }, 400);
      const { data: me } = await admin.from('profiles').select('id, role').eq('id', user.id).maybeSingle();
      if (me && me.role !== 'user' && me.role !== 'business') return json({ error: 'staff' }, 400); // demote first
      // Their uploaded photo files first: the photos rows (which record the paths) cascade away with
      // the profile, and the bucket isn't cleaned by the database. Stop if this fails, so a retry can finish it.
      try {
        await removeAccountFiles(admin as unknown as FilesClient, user.id);
      } catch (e) {
        return json({ error: 'files_delete_failed', detail: e instanceof Error ? e.message : String(e) }, 500);
      }
      if (me) {
        const { error: delErr } = await admin.from('profiles').delete().eq('id', user.id);
        if (delErr) return json({ error: 'delete_failed', detail: delErr.message }, 500);
      }
      const { error: authErr } = await admin.auth.admin.deleteUser(user.id);
      if (authErr) return json({ error: 'auth_delete_failed', detail: authErr.message }, 500);
      return json({ ok: true });
    }

    default:
      return json({ error: 'Unknown action' }, 400);
  }
});
