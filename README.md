# Gossoko

> Find the best tradie feed near the site.

Community review platform for cafés, coffee vans, servos, food trucks and
bakeries — rated on what actually matters on a worksite: speed, feed size,
ute parking, bang-for-buck, and an early open.

Built with Next.js 15 (App Router), React 19, TypeScript, Supabase.

---

## Status

**Initial app shell — pre-monetisation, pre-production.**

What's in:
- Mobile-first UI with bottom navigation
- Feed, Nearby (map shell), Rankings, Profile, Search, Venue Detail screens
- Seeded Brisbane venue dataset for development
- Dark industrial aesthetic with safety-orange accents
- Loading states + skeletons for every route
- Security foundation: input validation, sanitiser, rate limiter, upload validator, auth hardener
- Supabase schema + RLS policies for the production data model

What's deliberately out (for now):
- Monetisation / featured listings
- Admin systems / moderation dashboards
- Push notifications
- Production infrastructure

---

## Run locally

```bash
npm install
npm run dev
```

App runs at <http://localhost:3000>.

```bash
npm run build      # production build (also type-checks)
npm test           # vitest security suite
```

---

## Routes

| Path             | Purpose                                          |
|------------------|--------------------------------------------------|
| `/`              | Feed — featured, open now, trending, near me     |
| `/nearby`        | Map shell + distance-sorted venue list           |
| `/rankings`      | Leaderboards by overall / speed / feed / value   |
| `/profile`       | Current user, badges, recent reviews             |
| `/search`        | Free-text search with recents + popular searches |
| `/venue/[id]`    | Single venue — about, ratings, reviews, similar  |

---

## Project layout

```
src/
├── app/             # Next.js App Router pages + loading states
├── components/      # BottomNav, VenueCard, FilterChips, MapShell, etc.
├── lib/
│   ├── theme.ts     # Design tokens (colours, radii, spacing)
│   └── seed/        # Brisbane venue / review / user fixtures
├── actions/         # Server actions (auth)
├── config/          # Security config
├── types/           # Domain types (rbac, moderation)
└── middleware.ts    # Edge middleware

supabase/            # Schema, RLS, storage migrations
tests/security/      # Vitest security suite
```

---

## Ecosystem

Gossoko is part of the Sinsera ecosystem. A placeholder route exists at
`sinsera.co/gossoko` until this app is deployed standalone.

- Supabase is the canonical data home.
- Apps and modules are UX surfaces over that data.
- Cross-linking happens via foreign key, not duplicate tables.
