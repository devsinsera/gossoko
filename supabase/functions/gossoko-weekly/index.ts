// gossoko-weekly — "your week on Gossoko" email to verified venue owners. Run weekly (Mon 7am Brisbane).
//
//   POST (header x-cron-secret: $WEEKLY_CRON_SECRET)  {dry_run?: boolean}
//   Owners with nothing to report get no email. Opt-out = profile alerts off.
//
// Secrets: WEEKLY_CRON_SECRET, SMTP_HOST (mail.sinsera.co), SMTP_PORT (465), SMTP_USER, SMTP_PASS, SMTP_FROM.
// Until they are set every call answers {enabled:false}; nothing is sent.
//   supabase functions deploy gossoko-weekly --no-verify-jwt --project-ref lkhtgkmivqwgnvzmjbhr

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const SECRET = Deno.env.get('WEEKLY_CRON_SECRET') ?? '';
const SMTP = {
  host: Deno.env.get('SMTP_HOST') ?? '', port: Number(Deno.env.get('SMTP_PORT') ?? '465'),
  user: Deno.env.get('SMTP_USER') ?? '', pass: Deno.env.get('SMTP_PASS') ?? '', from: Deno.env.get('SMTP_FROM') ?? '',
};
const enabled = Boolean(SECRET && SMTP.host && SMTP.user && SMTP.pass && SMTP.from);
const SITE = 'https://sinsera.co/gossoko';

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

type Row = { email: string; owner_name: string | null; venue_name: string; venue_slug: string; pro: boolean;
  views: number; saves: number; new_reviews: number; directions: number | null; calls: number | null; codes_claimed: number | null; codes_redeemed: number | null };

function render(name: string | null, rows: Row[]) {
  const lines = rows.map((r) => {
    const bits = [`${r.views} views`, `${r.saves} saves`, `${r.new_reviews} new ${r.new_reviews === 1 ? 'review' : 'reviews'}`];
    if (r.pro) bits.push(`${r.directions ?? 0} directions`, `${r.calls ?? 0} calls`, `${r.codes_claimed ?? 0} codes claimed`, `${r.codes_redeemed ?? 0} redeemed`);
    return { text: `${r.venue_name}: ${bits.join(' · ')}\n${SITE}/venue/${r.venue_slug}`,
      html: `<p><strong>${esc(r.venue_name)}</strong><br>${bits.join(' · ')}<br><a href="${SITE}/venue/${encodeURIComponent(r.venue_slug)}">Open</a></p>` };
  });
  const hi = name ? `G'day ${name},` : "G'day,";
  return {
    text: `${hi}\n\nYour week on Gossoko (last 7 days):\n\n${lines.map((l) => l.text).join('\n\n')}\n\nTurn these emails off any time: Profile → Alerts.\n`,
    html: `<p>${esc(hi)}</p><p>Your week on Gossoko (last 7 days):</p>${lines.map((l) => l.html).join('')}<p style="color:#777;font-size:12px">Turn these emails off any time: Profile → Alerts.</p>`,
  };
}

/** Compare without stopping at the first differing byte, so the answer's timing says nothing about the secret. */
function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

Deno.serve(async (req) => {
  // The caller proves itself before learning anything, even whether mail is switched on.
  if (!SECRET || req.method !== 'POST' || !sameSecret(req.headers.get('x-cron-secret') ?? '', SECRET)) return json({ error: 'forbidden' }, 403);
  if (!enabled) return json({ enabled: false });
  const body = await req.json().catch(() => ({}));
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { db: { schema: 'gossoko' }, auth: { persistSession: false } });
  const { data, error } = await admin.rpc('weekly_digest_rows');
  if (error) return json({ error: error.message }, 500);

  const byOwner = new Map<string, Row[]>();
  for (const r of data as Row[]) byOwner.set(r.email, [...(byOwner.get(r.email) ?? []), r]);
  if (body.dry_run) return json({ enabled: true, dry_run: true, emails: byOwner.size });

  const client = new SMTPClient({ connection: { hostname: SMTP.host, port: SMTP.port, tls: SMTP.port === 465, auth: { username: SMTP.user, password: SMTP.pass } } });
  let sent = 0; const failed: string[] = [];
  for (const [email, rows] of byOwner) {
    const m = render(rows[0].owner_name, rows);
    try { await client.send({ from: SMTP.from, to: email, subject: 'Your week on Gossoko', content: m.text, html: m.html }); sent++; }
    catch (e) { console.error('[gossoko-weekly] send failed', e instanceof Error ? e.message : e); failed.push(email.replace(/^(.).*@/, '$1***@')); }
  }
  await client.close();
  return json({ enabled: true, sent, failed });
});
