// gossoko-push — sends one notification row to the user's phones (APNs; FCM not wired yet).
//   POST {notification_id}  header x-push-secret: $PUSH_SECRET  (called by the notifications_push trigger)
// Secrets: PUSH_SECRET, APNS_KEY_P8 (file contents), APNS_KEY_ID, APNS_TEAM_ID, APNS_TOPIC (com.sinsera.gossoko).
//   supabase functions deploy gossoko-push --no-verify-jwt --project-ref lkhtgkmivqwgnvzmjbhr

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const env = (k: string) => Deno.env.get(k) ?? '';
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
const b64u = (b: ArrayBuffer | string) => btoa(typeof b === 'string' ? b : String.fromCharCode(...new Uint8Array(b)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/* The provider token is REUSED for 40 minutes (the same rule MetreUp, Sona and Vigil's senders follow).
   It used to be signed afresh for every notification: Apple throttles a key whose tokens are re-issued
   too often (TooManyProviderTokenUpdates), and then nothing is delivered. */
let cachedJwt: { token: string; at: number } | null = null;
async function apnsJwt(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && now - cachedJwt.at < 40 * 60) return cachedJwt.token;
  const token = await signApnsJwt(now);
  cachedJwt = { token, at: now };
  return token;
}
async function signApnsJwt(now: number): Promise<string> {
  const pem = env('APNS_KEY_P8').replace(/-----[^-]+-----|\s/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const head = b64u(JSON.stringify({ alg: 'ES256', kid: env('APNS_KEY_ID') }));
  const body = b64u(JSON.stringify({ iss: env('APNS_TEAM_ID'), iat: now }));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64u(sig)}`;
}

async function sendApns(jwt: string, token: string, payload: unknown) {
  // Dev-signed builds carry sandbox tokens; retry the other host on BadDeviceToken.
  for (const host of ['api.push.apple.com', 'api.sandbox.push.apple.com']) {
    const r = await fetch(`https://${host}/3/device/${token}`, {
      method: 'POST',
      headers: { authorization: `bearer ${jwt}`, 'apns-topic': env('APNS_TOPIC'), 'apns-push-type': 'alert', 'apns-priority': '10' },
      body: JSON.stringify(payload),
    });
    if (r.ok) return { ok: true };
    const reason = (await r.json().catch(() => ({})))?.reason ?? String(r.status);
    if (reason !== 'BadDeviceToken') return { ok: false, reason };
  }
  return { ok: false, reason: 'BadDeviceToken' };
}

/** Compare without stopping at the first differing byte, so the answer's timing says nothing about the secret. */
function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (!env('PUSH_SECRET') || !sameSecret(req.headers.get('x-push-secret') ?? '', env('PUSH_SECRET'))) return json({ error: 'forbidden' }, 403);
  if (!env('APNS_KEY_P8')) return json({ enabled: false });
  const { notification_id } = await req.json().catch(() => ({}));
  if (!notification_id) return json({ error: 'notification_id required' }, 400);

  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { db: { schema: 'gossoko' } });
  const { data: n } = await db.from('notifications').select('id,user_id,title,body,type,related_id,related_type').eq('id', notification_id).maybeSingle();
  if (!n) return json({ error: 'not found' }, 404);
  const { data: toks } = await db.from('push_tokens').select('id,token,platform').eq('user_id', n.user_id).eq('is_active', true).is('deleted_at', null);
  const jwt = await apnsJwt();
  const results = [];
  for (const t of toks ?? []) {
    if (t.platform !== 'ios') { results.push({ platform: t.platform, skipped: 'fcm not wired' }); continue; }
    const r = await sendApns(jwt, t.token, { aps: { alert: { title: n.title, body: n.body ?? '' }, sound: 'default' }, type: n.type, related_id: n.related_id });
    /* a token Apple says is gone (or belongs to another app) is switched off; a refused provider token is ours to re-sign */
    if (!r.ok && (r.reason === 'Unregistered' || r.reason === 'BadDeviceToken' || r.reason === 'DeviceTokenNotForTopic')) await db.from('push_tokens').update({ is_active: false }).eq('id', t.id);
    if (!r.ok && /ProviderToken/.test(String(r.reason))) cachedJwt = null;
    results.push(r);
  }
  return json({ sent: results });
});
