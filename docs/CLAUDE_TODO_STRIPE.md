# Gossoko Stripe: tasks for Claude (TEST MODE)

Master plan (all apps): `~/Dev-Sinsera/Sinsera Core/docs/CLAUDE_STRIPE_PLAN.md`.

Written 13 Nov 2026 by Grok Bot for Peta. Stripe sandbox only: `acct_1UVkItFQ2OSiEJs3` ("Sinsera PTY LTD sandbox").

**Hard rules:** No deploy, no `git push`, no Supabase secret changes, no live keys, no live payments without Peta's explicit OK for that specific step. Never print or commit secret values. Refuse any `sk_live_`/`rk_live_` key.

## Already done in the Stripe sandbox (13 Nov 2026)

| Object | ID |
|---|---|
| Product "Gossoko Venue Pro" (metadata `product=gossoko`, `app=gossoko`, `plan=venue_pro`) | `prod_VcV8EXFQ0bNIMn` |
| Price A$19.00 / month, AUD, recurring (same metadata) | `price_1UbG8VFQ2OSiEJs3EOw0kxOE` |
| Webhook endpoint "Gossoko billing (test)" -> `https://lkhtgkmivqwgnvzmjbhr.supabase.co/functions/v1/gossoko-billing` | `we_1UbG8fFQ2OSiEJs3zbnPtiPc` |
| Webhook events | `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted` |
| Billing portal config (existing, default; shared with MetreUp) | `bpc_1UW2EtFQ2OSiEJs3I7LDalRQ` (plan switching OFF, cancel ON, so it cannot move a venue onto a MetreUp plan) |

Secret values live ONLY in `~/.config/sinsera-keys/gossoko/stripe-test.env` (chmod 600, not in git):
`GOSSOKO_STRIPE_WEBHOOK_SECRET` and `STRIPE_PRICE_PRO`. Do not print the values.

## Tasks (in order)

1. **Own webhook secret name.** `supabase/functions/gossoko-billing/index.ts` line ~23 reads `STRIPE_WEBHOOK_SECRET`, which belongs to MetreUp's `tt-stripe-webhook`. Change it to read `GOSSOKO_STRIPE_WEBHOOK_SECRET` with **no fallback** (same pattern as `commerce-stripe-webhook` / `COMMERCE_STRIPE_WEBHOOK_SECRET`). Update the header comment (line ~8). Also check `src/lib/api/billing.ts` for any mention of the old name.
2. **Tag payments as Gossoko.** In the `checkout` action (`stripe('checkout/sessions', ...)`, line ~164) add:
   - `'metadata[product]': 'gossoko'`, `'metadata[app]': 'gossoko'`
   - `'subscription_data[metadata][product]': 'gossoko'`, `'subscription_data[metadata][app]': 'gossoko'`
   (MetreUp's products use the `app` key; `product` is what Mop Mate uses. Set both so the revenue dashboard can group by either. See `Sinsera Core/docs/CLAUDE_TODO_REVENUE_DASHBOARD.md`.)
3. **Commit locally only** (Gossoko repo, branch `main`). No push until Peta OKs.
4. **Check the shared `STRIPE_SECRET_KEY` on Supabase project `lkhtgkmivqwgnvzmjbhr`** is the sandbox test key for `acct_1UVkItFQ2OSiEJs3`, not live, before relying on it. Do not print it. Use a no-op Stripe call and read `livemode` from the response (print only true/false). If it is live, stop and tell Peta.
5. **After Peta OKs:** set Supabase secrets from the env file (do not echo values):
   `supabase secrets set --env-file ~/.config/sinsera-keys/gossoko/stripe-test.env --project-ref lkhtgkmivqwgnvzmjbhr`
   (sets `GOSSOKO_STRIPE_WEBHOOK_SECRET` and `STRIPE_PRICE_PRO`; do NOT touch `STRIPE_WEBHOOK_SECRET`).
6. **After Peta OKs:** redeploy
   `supabase functions deploy gossoko-billing --no-verify-jwt --project-ref lkhtgkmivqwgnvzmjbhr`

## Acceptance tests (test mode)

- `POST {action:'config'}` as a signed-in user returns `{enabled:true}`.
- Unsigned or forged `Stripe-Signature` POST returns 400.
- MetreUp's `tt-stripe-webhook` still verifies its events (its secret was not touched): send a test event from Stripe to `we_1UVzrRFQ2OSiEJs3Rq1iln81` and see 200.
- As a verified venue owner, `checkout` -> Stripe Checkout page shows **A$19.00 per month**; pay with card `4242 4242 4242 4242`, any future date, any CVC.
- Webhook delivery to `we_1UbG8fFQ2OSiEJs3zbnPtiPc` shows 200 in Stripe.
- `gossoko.venue_plans` row for that venue: `status=active`, `source=stripe`, `stripe_customer_id` and `stripe_subscription_id` set; open `pro_requests` for the venue marked `done`.
- Subscription and checkout session in Stripe carry `metadata.product=gossoko` and `metadata.app=gossoko`.
- `portal` action opens the Stripe billing portal; cancelling there sets `venue_plans.status=cancelled`.
- Clean up the test subscription/customer afterwards.

## Open / not for Claude to decide

- **Promoted tier:** undecided by Peta (paid checkout or not, and price). No price exists; do not build it yet.
- Display copy for Venue Pro is "$19 a month".
- Going live (live keys, live price, live webhook) needs Peta's explicit OK and is a separate step.
