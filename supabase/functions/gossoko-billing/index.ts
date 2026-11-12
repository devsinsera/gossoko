// gossoko-billing — Stripe for venue Pro. Holds the Stripe secret and the service-role key.
//
//   POST {action:'config'}                      is online payment switched on?
//   POST {action:'checkout', venue_id, return_url}  owner -> Stripe Checkout (subscription) URL
//   POST {action:'portal',   venue_id, return_url}  owner -> Stripe billing portal URL
//   POST (Stripe-Signature header)              webhook; writes gossoko.venue_plans
//
// Secrets: STRIPE_SECRET_KEY, STRIPE_PRICE_PRO (price_…), STRIPE_WEBHOOK_SECRET (whsec_…).
// Until they are set every call answers {enabled:false}; nothing else changes.
// Deploy WITHOUT jwt verification (Stripe has no JWT; checkout/portal verify the caller below):
//   supabase functions deploy gossoko-billing --no-verify-jwt --project-ref lkhtgkmivqwgnvzmjbhr
// Webhook URL: https://lkhtgkmivqwgnvzmjbhr.supabase.co/functions/v1/gossoko-billing
// Events: checkout.session.completed, invoice.paid, invoice.payment_failed,
//         customer.subscription.updated, customer.subscription.deleted

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SK = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const PRICE = Deno.env.get('STRIPE_PRICE_PRO') ?? '';
const WHSEC = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const enabled = Boolean(SK && PRICE && WHSEC);

const SITE = 'https://sinsera.co';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const admin = createClient(URL_, SERVICE, { db: { schema: 'gossoko' }, auth: { persistSession: false } });

async function stripe(path: string, params?: Record<string, string>, method = params ? 'POST' : 'GET') {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${SK}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params ? new URLSearchParams(params) : undefined,
  });
  const out = await res.json();
  if (!res.ok) throw new Error(out?.error?.message ?? `Stripe ${res.status}`);
  return out;
}

// Stripe-Signature: t=…,v1=hex — HMAC-SHA256 of `${t}.${raw}`, 5 minute tolerance.
// While a signing secret is being rolled Stripe sends a v1 for EACH secret: every v1 is tried, not only the last.
async function verify(raw: string, header: string): Promise<boolean> {
  const pairs = header.split(',').map((p) => { const i = p.indexOf('='); return [p.slice(0, i).trim(), p.slice(i + 1).trim()] as [string, string]; });
  const t = Number(pairs.find(([k]) => k === 't')?.[1]);
  const sent = pairs.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300 || !sent.length) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(WHSEC), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${raw}`)));
  const hex = Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('');
  let ok = false;
  for (const v1 of sent) {
    if (hex.length !== v1.length) continue;
    let diff = 0;
    for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ v1.charCodeAt(i);
    if (diff === 0) ok = true;
  }
  return ok;
}

// One venue per subscription: venue_id rides on the subscription's metadata.
async function writePlan(sub: Record<string, any>, status: 'active' | 'past_due' | 'cancelled') {
  const venueId = sub.metadata?.venue_id as string | undefined;
  if (!venueId) return;
  const item = sub.items?.data?.[0];
  const end = sub.current_period_end ?? item?.current_period_end;
  const periodEnd = end ? new Date(end * 1000).toISOString() : new Date().toISOString();
  const { error } = await admin.from('venue_plans').upsert({
    venue_id: venueId,
    status,
    current_period_end: status === 'cancelled' ? new Date().toISOString() : periodEnd,
    source: 'stripe',
    stripe_customer_id: sub.customer,
    stripe_subscription_id: sub.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'venue_id' });
  if (error) throw new Error(error.message);
  if (status === 'active') await admin.from('pro_requests').update({ status: 'done' }).eq('venue_id', venueId).eq('status', 'open');
}

/** What a venue's plan is, from the subscription as Stripe holds it. */
const planStatus = (sub: Record<string, any>): 'active' | 'past_due' | 'cancelled' =>
  sub.status === 'active' || sub.status === 'trialing' ? 'active' : sub.status === 'past_due' ? 'past_due' : 'cancelled';
/** The subscription an invoice belongs to. Newer Stripe API versions moved it under `parent`. */
const invoiceSubscription = (inv: Record<string, any>): string | null => {
  const s = inv.subscription ?? inv.parent?.subscription_details?.subscription ?? null;
  return typeof s === 'string' ? s : s?.id ?? null;
};

async function webhook(req: Request): Promise<Response> {
  const raw = await req.text();
  if (!enabled || !(await verify(raw, req.headers.get('stripe-signature') ?? ''))) return json({ error: 'Bad signature' }, 400);
  const ev = JSON.parse(raw);
  const obj = ev.data.object;
  /* ⚑ THE PLAN IS WRITTEN FROM THE SUBSCRIPTION AS STRIPE HOLDS IT NOW (13 Nov 2026) — LoopRoom's
     rule for its payout accounts. Stripe does not promise the order events arrive in: this wrote the
     snapshot each event carried, so a late "updated (active)" landing after "deleted" put a
     cancelled venue back on Pro. And a finished checkout wrote "active" whatever the subscription's
     own state was. Every event now re-reads the subscription and writes that. */
  const fresh = (id: string) => stripe(`subscriptions/${id}`);
  try {
    switch (ev.type) {
      case 'checkout.session.completed':
      case 'invoice.paid': {
        const id = ev.type === 'invoice.paid' ? invoiceSubscription(obj) : obj.subscription;
        if (id) { const sub = await fresh(id); await writePlan(sub, planStatus(sub)); }
        break;
      }
      case 'invoice.payment_failed': {
        const id = invoiceSubscription(obj);
        if (id) {
          const sub = await fresh(id);
          const now = planStatus(sub);
          /* Stripe may not have moved the subscription to past_due yet: a failed payment is never "active" */
          await writePlan(sub, now === 'active' ? 'past_due' : now);
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = await fresh(obj.id);
        await writePlan(sub, planStatus(sub));
        break;
      }
    }
  } catch (e) {
    // 500 makes Stripe retry; events are idempotent upserts.
    return json({ error: (e as Error).message }, 500);
  }
  return json({ received: true });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (req.headers.get('stripe-signature')) return webhook(req);

  const auth = req.headers.get('Authorization') ?? '';
  const asUser = createClient(URL_, ANON, { db: { schema: 'gossoko' }, global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return json({ error: 'Not signed in' }, 401);

  let body: Record<string, string>;
  try { body = await req.json(); } catch { return json({ error: 'Bad JSON' }, 400); }
  if (body.action === 'config') return json({ enabled });
  if (!enabled) return json({ enabled: false, error: 'Online payment isn\'t switched on yet.' }, 503);

  const venueId = body.venue_id;
  const { data: owns } = await asUser.rpc('is_venue_owner', { p_venue: venueId });
  if (!owns) return json({ error: 'Only the verified owner can do that.' }, 403);
  // Return only to our own site.
  const back = body.return_url?.startsWith(`${SITE}/`) ? body.return_url : `${SITE}/gossoko/manage`;

  try {
    if (body.action === 'checkout') {
      const { data: plan } = await admin.from('venue_plans').select('status, source').eq('venue_id', venueId).maybeSingle();
      if (plan?.source === 'stripe' && plan.status === 'active') return json({ error: 'This venue already has an active subscription.' }, 409);
      const s = await stripe('checkout/sessions', {
        mode: 'subscription',
        'line_items[0][price]': PRICE,
        'line_items[0][quantity]': '1',
        client_reference_id: venueId,
        customer_email: user.email ?? '',
        'metadata[venue_id]': venueId,
        'subscription_data[metadata][venue_id]': venueId,
        success_url: `${back}${back.includes('?') ? '&' : '?'}paid=1`,
        cancel_url: back,
        allow_promotion_codes: 'true',
      });
      return json({ url: s.url });
    }
    if (body.action === 'portal') {
      const { data: plan } = await admin.from('venue_plans').select('stripe_customer_id').eq('venue_id', venueId).maybeSingle();
      if (!plan?.stripe_customer_id) return json({ error: 'No card on file for this venue.' }, 404);
      const s = await stripe('billing_portal/sessions', { customer: plan.stripe_customer_id, return_url: back });
      return json({ url: s.url });
    }
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
  return json({ error: 'Unknown action' }, 400);
});
