# Gossoko

> Find the best tradie feed near the site.

Community review platform for cafés, coffee vans, servos, food trucks and
bakeries — rated on what matters on a worksite: speed, feed size, ute parking,
bang-for-buck, and an early open.

One codebase, three surfaces:

| Surface        | How                                                                 |
|----------------|---------------------------------------------------------------------|
| Web            | Vite + React SPA at <https://sinsera.co/gossoko/> (static, FTPS)    |
| iPhone / iPad  | Capacitor shell (`native/ios`) loading the web app, Face ID + Keychain |
| Android        | Capacitor shell (`native/android`), same web app                     |

No server of its own. Data is the shared Supabase project (schema `gossoko.*`,
RLS-enforced). The three things that need the service-role key (queue a report,
write an audit row, change a user's role) live in the `gossoko-admin` edge
function — `supabase/functions/gossoko-admin`.

## Run

```bash
npm install
npm run dev          # http://127.0.0.1:4780/gossoko/
npm test             # vitest
npm run build        # tsc --noEmit + vite build -> dist/
npm run deploy       # test + build + FTPS to sinsera.co/gossoko (TLS 1.2, size-checked)
```

`.env.local` (gitignored): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
optional `VITE_GOSSOKO_REVIEW_PREMODERATION=true`, and `SINSERA_FTP_*` for deploy.

## Native

```bash
cd native && npm install
npx cap sync
npm run build:ios-sim        # simulator build, no signing
npm run open:ios             # Xcode (team 3R7FM9TSMX, com.sinsera.gossoko)
npm run open:android         # needs a JDK + Android SDK
```

The shells point at the live site (`capacitor.config.json` -> `server.url`), so a
web deploy updates every app. `native/www/offline.html` is the no-network page.
Icons come from one drawing: `python3 scripts/make_icons.py` writes
`public/*`, `native/icon.png`, the iOS AppIcon, the Android launcher icons (adaptive
foreground pin + map background) and the Mac app icon (`native/mac/Sources/Assets.xcassets/AppIcon.appiconset`).

## Sign-in (Sinsera rule)

Remember me (session in Keychain on the phone), a Face ID / Touch ID / Optic ID
offer after sign-in, biometric lock on reopen with device-passcode fallback and a
full sign-in if it fails, Password AutoFill tied to `webcredentials:sinsera.co`
(entitlement in `native/ios/App/App/App.entitlements`; the app id is in the
Core AASA file).

## Routes

`/` feed · `/nearby` · `/rankings` · `/search` · `/profile` · `/venue/:slug` ·
`/venue/new` · `/review/new?venue=` · `/login` · `/signup` · `/auth/forgot` ·
`/auth/reset` · `/auth/confirm` · `/admin/moderation` · `/admin/users`

## Layout

```
src/pages/       route components (+ per-feature actions.ts: plain async functions)
src/components/  BottomNav, VenueCard, ActionForm, LockScreen, BiometricOffer …
src/lib/         supabase client, auth/session, bio (Keychain + biometrics), queries, api
supabase/        schema + RLS migrations, functions/gossoko-admin
native/          Capacitor iOS + Android shells
tests/           vitest (security libs + auth/nav units)
```
