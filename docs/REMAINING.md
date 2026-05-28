# Gossoko — remaining work

Last updated: 2026-05-28 · branch `finish-punch-list` (off `main`).

> 2026-05-28: §2, §5, §6, §7, §8, §9 all shipped on `finish-punch-list`
> (typecheck + build clean, 335 tests passing). Remaining work is now the
> §A config items (which need you, not code) and the follow-ups noted at the
> bottom. Earlier status (below) preserved for context.

Use this as the live "what's next" punch list. Tick items off as they ship.
Sections are roughly ordered by impact, not by sequence — see "Recommended order" at the bottom.

---

## Live URLs

- **App (production):** <https://gossoko.vercel.app>
- **Supabase dashboard:** <https://supabase.com/dashboard/project/lkhtgkmivqwgnvzmjbhr>
- **GitHub repo:** <https://github.com/devsinsera/gossoko>
- `sinsera.co/gossoko` is currently a HostGator placeholder page, *not* the app. See §D below for the fix.

---

## A. Setup steps you need to do (not code)

These don't require any code changes — they're config/env tweaks on Supabase or Vercel.

- [ ] **`SUPABASE_SERVICE_ROLE_KEY` on Vercel.** Without it, the deployed site's Report button silently fails to push items into the moderation queue (the report itself is saved; only the queue insert is skipped). Get the key from <https://supabase.com/dashboard/project/lkhtgkmivqwgnvzmjbhr/settings/api-keys>, then Vercel project → Settings → Environment Variables → add for **Production**, **Preview**, **Development** → Redeploy.
- [ ] **Supabase Auth → URL Configuration.** Required for email confirmation and password reset to point at the right domain. Set Site URL + add Redirect URLs (`/auth/reset`, `/auth/confirm` on both prod and `localhost:3000`). Currently optional because you're not relying on those flows yet, but blocking once you do.
- [ ] **First admin promotion is manual.** After signup, run `UPDATE gossoko.profiles SET role = 'admin' WHERE email = 'you@example.com';` to reach `/admin/moderation`. No UI for promoting other admins yet (see §B-7 below).
- [ ] **(Optional) Enable pre-moderation.** Add `GOSSOKO_REVIEW_PREMODERATION=true` to Vercel envs to require admin approval before new reviews go public. Default is off (auto-approve). Turn on once you have real signups so spam doesn't ship instantly.

---

## B. Code work — ranked by impact

### 1. User-submitted venues ✅ *(shipped)*
- `/venue/new` form (paste lat/lng with Google Maps helper link) → `submitVenue` inserts with `moderation_status='pending'`.
- Admin `/admin/moderation` has a "Pending Venues" section with Approve/Reject.
- Profile "Add a Venue" tile now links to `/venue/new`.

### 2. Distance from geolocation ✅ *(shipped)*
- `src/lib/geo.ts` (haversine + format, unit-tested), `src/components/DistanceProvider.tsx` (post-hydration `getCurrentPosition`, never blocks render), `VenueDistance` display component, and `nearby/NearbyList.tsx` (re-sorts/filters by real distance when coords are available).
- Graceful fallback to the static `distance_km` column on denial/timeout/unsupported.

### 3. Pre-moderation toggle ✅ *(shipped)*
- Code-side complete. Flip the `GOSSOKO_REVIEW_PREMODERATION=true` env var on Vercel when you're ready to require admin approval before new reviews go public.
- `/admin/moderation` has a "Pending Reviews" section with Approve/Reject; RLS makes the author see their own pending review but others don't until approved.

### 4. "Helpful" button actually works ✅ *(shipped, migration applied)*
- Migration `supabase/migrations/20260525000001_review_likes.sql` — applied to prod.
- `toggleHelpful` server action + `HelpfulButton` client component with optimistic UI.
- DB trigger keeps `reviews.helpful_count` in sync on insert/delete.

### 5. Comments on reviews ✅ *(shipped)*
- `src/app/_comments/*` (action + `CommentsSection`) + `src/lib/queries/comments.ts`. Expandable add-comment + list under each review card on the venue page.
- Same moderation rules as reviews (`GOSSOKO_REVIEW_PREMODERATION`), reportable via the existing `ReportButton` (`reportableType="comment"`).
- NOTE: when pre-moderation is ON, pending comments have no approve surface in `/admin/moderation` yet (reviews do) — see follow-ups below.

### 6. Edit/delete-your-review polish ✅ *(shipped)*
- Profile "My Recent Reviews" rows now have an Edit shortcut to `/review/new?venue=<slug>` and a soft-delete (`reviews.deleted_at`) with confirmation. Controls are gated to the signed-in owner.

### 7. Admin user/role management ✅ *(shipped)*
- `/admin/users` lists profiles with a role dropdown (admins only, `edit_user_role`), audit-logs each change, prevents self-lockout.
- NOTE: changing another user's role needs the service-role client (no RLS UPDATE policy lets an admin change others' roles), so it requires `SUPABASE_SERVICE_ROLE_KEY` (§A-1). Without it the action shows a clear "configure service key" banner instead of failing silently.

### 8. `tests/security/*` unused-import cleanup ✅ *(shipped)*
- Removed the 9 TS6133 errors; `tsc --noEmit` is now clean across the whole tree.

### 9. Venue claims flow ✅ *(shipped — schema-faithful subset)*
- "Claim this venue" on the venue page (contextual states: manage / pending / declined / sign-in) → creates a pending `venue_claims` row → admin Approve/Reject in `/admin/moderation` → on approval `venues.created_by` transfers to the claimant.
- NOTE: the real `venue_claims` table has NO `verification_type` / `evidence_storage_path` / appeal columns, so this is the email-less, evidence-upload-less subset. Evidence upload / email verification would need a migration first — out of scope for this pass.

### 10. Email confirmation defaults *(~10 min, when you turn email confirmation on)*
- The `/auth/confirm` route handler exists and works.
- When Supabase email confirmation is enabled, the SMTP sender needs to be configured (default uses Supabase's; rate-limited at ~3 emails/hour for the free tier). Worth swapping to a real provider (Resend, Postmark) before launch — same config, just paste API key.

---

## C. Recommended order

All §B code items are shipped on `finish-punch-list`. What's left is config (you) + optional follow-ups:

**Still on you (config, not code):**
1. ⬜ §A-1 `SUPABASE_SERVICE_ROLE_KEY` on Vercel — unblocks the report→queue insert AND `/admin/users` role changes AND venue-claim/role audit logging.
2. ⬜ §A-2 Supabase Auth URL config (needed before relying on email confirm / password reset).
3. ⬜ §A-3 First admin promotion via SQL.
4. ⬜ §A-4 Flip `GOSSOKO_REVIEW_PREMODERATION=true` when ready (note the comment-moderation follow-up below before doing so).

**Done:** §1, §2, §3, §4, §5, §6, §7, §8, §9.

## C2. Follow-ups identified during the 2026-05-28 pass

- **Pending-comment moderation surface.** With pre-moderation ON, new comments land `pending` and are visible only to author/admins, but `/admin/moderation` has no "Pending Comments" section to approve them (reviews/venues/claims do). Add one before enabling §A-4.
- **Queue resolution doesn't act on the reported content.** `resolveQueueItem` marks the `moderation_queue` row resolved but doesn't hide/approve the underlying review or comment. Pre-existing for reviews; now also applies to reported comments (§5 made comments reportable).
- **§10 email defaults** (real SMTP provider) still pending — only matters once email confirmation is turned on.

---

## D. Open architectural questions

- **`gossoko.sinsera.co` subdomain.** Your other two apps use this pattern (`cutlass.sinsera.co`, `garage.sinsera.co`) wired as Vercel aliases. To do the same for Gossoko: add a `gossoko` CNAME at the registrar pointing to `cname.vercel-dns.com`, then run `vercel alias set gossoko.vercel.app gossoko.sinsera.co`. Alternative: keep the HostGator proxy and set `basePath: '/gossoko'` in `next.config.mjs`.
- **Single shared Supabase project with Sinsera Core, or split?** Currently you use one project + `gossoko.*` schema. Works fine, but means a Sinsera Core RLS bug could in theory expose Gossoko data and vice versa. Consider splitting once both apps have meaningful PII.
- **Per-axis aggregation strategy.** Currently aggregates client-side in TS over all review rows for the venues being listed. Fine for ~hundreds of venues × ~tens of reviews each. Past that, move to a Postgres view (`gossoko.venue_axis_averages`) or a `STORED` generated column per axis on `venues` that a trigger keeps fresh.
