# Gossoko — remaining work

Last updated: 2026-05-20 · branch `main` · latest commit `699b4bc`.

Use this as the live "what's next" punch list. Tick items off as they ship.
Sections are roughly ordered by impact, not by sequence — see "Recommended order" at the bottom.

---

## A. Setup steps you need to do (not code)

These don't require any code changes — they're config/env tweaks on Supabase or Vercel.

- [ ] **`SUPABASE_SERVICE_ROLE_KEY` on Vercel.** Without it, the deployed site's Report button silently fails to push items into the moderation queue (the report itself is saved; only the queue insert is skipped). Get the key from <https://supabase.com/dashboard/project/lkhtgkmivqwgnvzmjbhr/settings/api-keys>, then Vercel project → Settings → Environment Variables → add for **Production**, **Preview**, **Development** → Redeploy.
- [ ] **Supabase Auth → URL Configuration.** Required for email confirmation and password reset to point at the right domain. Set Site URL + add Redirect URLs (`/auth/reset`, `/auth/confirm` on both prod and `localhost:3000`). Currently optional because you're not relying on those flows yet, but blocking once you do.
- [ ] **First admin promotion is manual.** After signup, run `UPDATE gossoko.profiles SET role = 'admin' WHERE email = 'you@example.com';` to reach `/admin/moderation`. No UI for promoting other admins yet (see §B-7 below).

---

## B. Code work — ranked by impact

### 1. User-submitted venues ✅ *(shipped)*
- `/venue/new` form (paste lat/lng with Google Maps helper link) → `submitVenue` inserts with `moderation_status='pending'`.
- Admin `/admin/moderation` has a "Pending Venues" section with Approve/Reject.
- Profile "Add a Venue" tile now links to `/venue/new`.

### 2. Distance from geolocation *(~30 min)*
- Replace `venues.distance_km` static-column reads with `getCurrentPosition()` → compute haversine distance per venue.
- Lives in a client wrapper (e.g. `src/components/DistanceProvider.tsx`) that hydrates after page load and updates the home/nearby/rankings lists.
- Graceful fallback: if geo denied, show the static column value (current behaviour).

### 3. Pre-moderation toggle ✅ *(shipped)*
- Set `GOSSOKO_REVIEW_PREMODERATION=true` in Vercel envs to require admin approval before new reviews go public. Default is off (auto-approve).
- `/admin/moderation` now has a "Pending Reviews" section with Approve/Reject; RLS makes the user see their own pending review but others don't until approved.

### 4. "Helpful" button actually works *(~30 min)*
- Currently a dead `<button>` on every review card.
- Needs a small schema addition: `review_likes (review_id, user_id, created_at, PK (review_id, user_id))`.
- Server action `toggleHelpful(reviewId)` inserts or deletes a row + trigger updates `reviews.helpful_count`.
- Button becomes a `'use client'` component with optimistic UI.

### 5. Comments on reviews *(~45 min)*
- Schema already exists (`comments` table). No UI yet.
- Below each review card on the venue page: expandable "Add a comment" textarea + comments list.
- Same moderation rules as reviews (auto-approve, reportable).

### 6. Edit/delete-your-review polish *(~15 min)*
- Profile "My Recent Reviews" rows could link to `/review/new?venue=<slug>` (which already auto-detects existing) instead of just the venue page — saves a click.
- Add a small Delete action next to Edit, with a soft-delete (`deleted_at`).

### 7. Admin user/role management *(~45 min)*
- Today: only SQL can change a profile's role.
- Build `/admin/users` — list of profiles with role dropdown for admins (`edit_user_role` permission already exists in the RBAC schema).
- Audit-log each role change (already supported by the existing `audit_logs` table).

### 8. `tests/security/*` unused-import cleanup *(~5 min)*
- 9 pre-existing TS6133 errors in `tests/security/*` — unused `beforeEach`, `vi`, `NextRequest`, `script`, `max`, `key` imports.
- Easy win, makes `tsc --noEmit` clean across the whole tree.

### 9. Venue claims flow *(~1 hour, builds on §1)*
- `venue_claims` table already exists with `verification_type` ('email' | 'evidence'), `evidence_storage_path`, appeal tracking.
- UI: "Claim this venue" button on venue page → form (proof type, email or evidence upload to storage bucket already provisioned in migration 003) → admin verifies in `/admin/moderation` → on approval, `venue.created_by` updates to the claimant.

### 10. Email confirmation defaults *(~10 min, when you turn email confirmation on)*
- The `/auth/confirm` route handler exists and works.
- When Supabase email confirmation is enabled, the SMTP sender needs to be configured (default uses Supabase's; rate-limited at ~3 emails/hour for the free tier). Worth swapping to a real provider (Resend, Postmark) before launch — same config, just paste API key.

---

## C. Recommended order

Two reasonable sequences depending on your goal:

**Path A — fastest path to "real-world usable":**
1. §1 Add a Venue (without this, the catalogue can't grow)
2. §A-1 Service-role key on Vercel (otherwise §1's admin queue is silent on prod)
3. §3 Pre-moderation toggle (turn on once you have real signups so spam doesn't ship instantly)
4. §4 Helpful button (small but the dead button is a credibility hit)

**Path B — best demo experience:**
1. §2 Distance from geo (lights up "5km away" everywhere — feels real)
2. §1 Add a Venue
3. §5 Comments
4. §4 Helpful

---

## D. Open architectural questions

- **Single shared Supabase project with Sinsera Core, or split?** Currently you use one project + `gossoko.*` schema. Works fine, but means a Sinsera Core RLS bug could in theory expose Gossoko data and vice versa. Consider splitting once both apps have meaningful PII.
- **Where does `sinsera.co/gossoko` actually live?** Today it's a static "under dev" page served from HostGator. The real Gossoko app is on Vercel. Decide whether you want to (a) point a subdomain like `gossoko.sinsera.co` at the Vercel deployment, or (b) keep the HostGator proxy and configure `basePath: '/gossoko'` in `next.config.mjs` so the app works under that path.
- **Per-axis aggregation strategy.** Currently aggregates client-side in TS over all review rows for the venues being listed. Fine for ~hundreds of venues × ~tens of reviews each. Past that, move to a Postgres view (`gossoko.venue_axis_averages`) or a `STORED` generated column per axis on `venues` that a trigger keeps fresh.
