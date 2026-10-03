# AR Mining Training App

AR safety training for Jharkhand's mining, steel and mica workers (SIH 2026, PS SIH26041).
See [PROJECT_BRIEF.md](PROJECT_BRIEF.md) for the full scope and phase plan.

> Status: **Phase 5**. AR engine, app shell (installable, offline), AR Basics practice module,
> the assessment engine, two assessed modules (**Fire & Explosion Response**, **Gas Leak &
> Confined Space**), signed certificates with QR verification and a sync engine (Phase 4), and the
> admin compliance portal, on the web and as its own Android app (Phase 5). The full setup and
> demo guide comes in Phase 7.

## Training modules

| Module                    | Kind     | What the worker does                                                                                                                                                                                                                                                             |
| ------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AR Basics                 | Practice | Place and turn the area, tap, drag, aim, press-and-hold, crouch                                                                                                                                                                                                                  |
| Fire & Explosion Response | Assessed | Raise the alarm, identify an electrical fire, pick the extinguisher, PASS (pull, aim, squeeze, sweep), stay low under smoke, evacuate past a blocked exit, stay out                                                                                                              |
| Gas Leak & Confined Space | Assessed | Mark the hazard zones and the manhole where LPG collects, stop a spark, get out upwind (windsock), call it in; then test the pit (O₂ → LEL → H₂S/CO), ventilate, re-test and sign the permit, dress the entrant, post an attendant, radio check, non-entry rescue with the winch |

**Assessment:** 60% practical (correct actions, order, time) + 40% scenario quiz (5 illustrated,
narrated questions). Pass mark 70%. Any critical error fails the attempt, with an explanation:
water on an electrical fire, a blocked exit or the lift, going back inside (Fire); operating a
switch in the gas, entry with no attendant outside, going in to rescue without breathing
apparatus (Gas). After a failure the
worker can practise only the steps they missed; after a pass, refresher drills are scheduled for
1, 3 and 7 days and offered on the home screen. All safety text lives in
`packages/shared/content/modules/*.json` with source notes for expert review.

## Layout

| Path                      | What                                                                     |
| ------------------------- | ------------------------------------------------------------------------ |
| `apps/mobile`             | Worker app: React 18 + TS + Vite, React Three Fiber, `@react-three/xr`   |
| `apps/mobile/src/engine`  | AR engine: placement, input, aiming, crouch tracking, 3D fallback, HUD   |
| `apps/mobile/src/modules` | Module scenes (3D content + step logic), one folder per module           |
| `apps/admin`              | Admin portal: React + Vite + Tailwind (shadcn/ui), Recharts, Leaflet     |
| `apps/admin/android`      | Admin Android app (Capacitor): the portal packaged in a native WebView   |
| `services/api`            | FastAPI service (Python, `.venv` inside)                                 |
| `packages/shared`         | Shared TypeScript types, content schemas, scoring types                  |
| `packages/shared/content` | Module content JSON (reviewable; every module has `review.source/notes`) |
| `apps/android`            | Android app (TWA) config; `npm run android` generates and builds it      |
| `scripts`                 | Dev helpers: phone/adb, Android build, API venv and runner, translations |

## Prerequisites

- Node.js 20.19+ (24 recommended) and npm
- Python 3.11+
- Android SDK Platform-Tools (`adb`). The phone script also finds it in the default
  Android Studio SDK folder, so it does not have to be on `PATH`.
- Android 10+ phone with Chrome and Google Play Services for AR, USB debugging enabled

## First-time setup

```sh
npm install
npm run setup:api
```

The API creates `services/api/dev.db` and seeds demo data on first start: 4 sites
(Dhanbad, Bokaro, Ranchi, Koderma) and 48 workers. **Demo login: any worker ID from
`11001`–`11012`, `12001`–`12012`, `13001`–`13012`, `14001`–`14012`, PIN `1234`.**

## Daily dev loop (phone over USB, hot reload)

Run each in its own terminal:

```sh
npm run dev        # mobile app on http://127.0.0.1:5173 (hot reload)
npm run dev:api    # API on http://127.0.0.1:8000
npm run phone      # adb reverse 5173 + 8000, then opens http://localhost:5173 in Chrome on the phone
```

`localhost` on the phone is tunnelled to the laptop by `adb reverse`, which makes it a secure
context (WebXR requires one) and keeps hot reload working. Re-run `npm run phone` after
reconnecting the cable.

- **Phone console logs:** open `chrome://inspect/#devices` in Chrome on the laptop and click
  **inspect** under `localhost:5173`.
- **Force the 3D fallback** on an AR-capable phone: open `http://localhost:5173/?mode=3d`.
- **Performance / debug:** add `?debug` to log fps, draw calls and triangles every 2 s.

## Install it on the phone as its own app

The dev server has no service worker (so hot reload never serves stale files). To get the
installable, offline-capable app:

```sh
npm run dev:api     # the first login on a phone needs the API
npm run app         # production build, served on http://127.0.0.1:4173
npm run phone:app   # adb reverse 4173 + 8000 and open it in Chrome on the phone
```

On the phone: Chrome menu (⋮) → **Install app** (or the **Install app** button on the
language screen / home menu). It gets its own home-screen icon and opens full screen without
the browser bar. After the first login it works without the laptop and without internet:
the app shell, fonts, content and narration are all precached, and workers who have logged in
on that phone can log in again offline with their PIN.

## Android app (APK) on the phone

A real installable Android app: **AR Mining Training** in the app drawer, opening full screen
with no browser bar. It is a Trusted Web Activity generated with Bubblewrap from
`apps/android/twa-manifest.json`: a small signed APK that runs the deployed web app
(https://ar-mining-training.vercel.app) in Chrome's engine, so WebXR AR works exactly as in
Chrome. Chrome hides its address bar because the site's `/.well-known/assetlinks.json` names the
APK's signing key.

```sh
npm run dev:api     # the first login on a phone needs the API (reached through adb reverse)
npm run android     # build web app → deploy to Vercel → build + sign APK → adb install → launch
```

- `npm run android -- --no-deploy` rebuilds and reinstalls the APK only;
  `-- --no-install` only builds `apps/android/dist/ar-mining-training.apk`.
- First run: `npx vercel login` if asked; the script creates the signing key in
  `apps/android/keys/` (gitignored). **Back that folder up**: updates must be signed with the
  same key, and a new key means changing `assetlinks.json` and reinstalling.
- Needs Android Studio's bundled JDK (or JDK 17–23 via `ARMT_JDK`) and the Android SDK.
- The app loads the live site, so after a deploy it offers the update on the next launch without
  reinstalling. After the first login it works offline, like the installed web app.
- Screen: the app shell is portrait; each module sets its orientation in
  `apps/mobile/src/modules/registry.ts` (AR Basics rotates freely, the assessed modules stay
  portrait).
- API: the app calls `http://localhost:8000` on the phone, which `adb reverse` forwards to the
  laptop (the API allows the Vercel origin and Chrome's private-network preflight). If Chrome
  asks to allow access to devices on the local network, tap **Allow**. A hosted API (Phase 6)
  removes the need for the cable.

## Certificates and verification (Phase 4)

- **Issued offline, signed online.** Passing an assessment gives the worker a _provisional_
  certificate on the phone straight away (id `P-XXXXXXXX`). When the phone syncs, the API
  re-checks the result with the pass mark in force, assigns `CERT-0001`-style ids and signs it.
- **Tamper-proof.** The certificate details are hashed (SHA-256 over canonical JSON) and the hash
  is signed with the API's **Ed25519** key (`services/api/keys/cert_signing_ed25519.key`, created on
  first start, gitignored — back it up). A certificate stays valid for 1 year (portal setting).
- **QR code = link + proof.** The QR on a certificate encodes
  `https://ar-mining-training.vercel.app/#c=…` with the details, hash, key id and signature.
  Scanning it with any phone camera opens the worker app's verify screen; the app (and the admin
  portal) check the signature **offline** with the public key, then confirm revocation with the
  server when online. Typing an ID (`CERT-0017`) checks it online.
- **Sync engine.** Results and step events are queued in IndexedDB and uploaded whenever the phone
  is online (on start, after each attempt, when the network returns, every few minutes), with
  exponential backoff. The home screen chip shows _Synced_ / _N results to upload_ and syncs on tap.
- **Blockchain (optional).** Certificate hashes can be anchored on **Polygon Amoy** (testnet):
  set `ARMT_POLYGON_PRIVATE_KEY` on the API to a test wallet funded from the Amoy faucet and
  restart it; the Blockchain Log page then anchors certificates and links each transaction on
  PolygonScan. Without a key the stub adapter reports "not anchored yet" (nothing is faked).

## Admin portal (Phase 5)

```sh
npm run dev:api     # API on :8000 (seeds a demo admin, 48 workers and a year of training history)
npm run dev:admin   # portal on http://localhost:5174
```

**Demo admin: `admin@test.com` / `admin1234`** (change with `ARMT_ADMIN_EMAIL` /
`ARMT_ADMIN_PASSWORD` before the first start, or add admins under Settings).

Pages: Dashboard (KPIs, sites map, module results, insights, recent assessments, verify, common
mistakes, critical errors, 3D module preview), Workers (filters, add/edit, PIN reset, history,
per-step mastery, certificates), Modules (pass rates, hardest steps, quiz accuracy, trend),
Assessments (every attempt with step breakdown), Certificates (revoke, PDF with QR), Verify
Certificate (ID, QR camera scan or image, offline signature check), Blockchain Log, Reports (PDF
and CSV compliance exports by period, sector and site) and Settings (pass mark, certificate
validity, sites, admins, phones). English and हिन्दी.

The generated demo history (results, retraining, signed certificates) is marked as demo data in
the database; real uploads from phones appear alongside it. Start from an empty history with
`ARMT_SEED_HISTORY=0`, or reset everything with `python -m app.seed --reset` (from
`services/api`, inside its virtualenv).

### Admin app on the phone (its own APK, not Chrome)

```sh
npm run dev:api        # the app talks to the API on this laptop
npm run android:admin  # build portal → Capacitor → signed APK → adb install → launch
```

"AR Training Admin" appears in the app drawer next to "AR Mining Training". It is a Capacitor
app: the portal is packaged inside the APK and runs in a native WebView, so it opens with no
browser at all and its screens load without the laptop's web server. Data comes from the API at
`http://localhost:8000` through `adb reverse` (the script sets it up; re-run
`npm run phone:reverse` after reconnecting the cable). The server address can be changed on the
login screen or under Settings. Exports open the Android share sheet (save to Files, Drive,
WhatsApp…). Both apps are signed with the same key in `apps/android/keys/`.

> The worker app stays a Trusted Web Activity (Chrome's engine) because WebXR AR is only
> available in Chrome; a WebView app cannot run the AR scenes.

## Languages

English, हिन्दी and ᱥᱟᱱᱛᱟᱲᱤ (Santali, Ol Chiki). Fonts are bundled for all three scripts.

- Santali strings are never invented. The few machine-drafted ones are marked
  `needsReview: true` (tests enforce this); everything else falls back to Hindi until a
  native speaker translates it. The app shows a notice while Santali is selected.
- `npm run i18n:export` writes every UI and module string (en / hi / sat + review flags and
  safety notes) to `translations/strings.csv` for translators.
- Recorded narration can replace text-to-speech: see `apps/mobile/src/assets/audio/README.md`.

## Scripts

| Script                  | Does                                                  |
| ----------------------- | ----------------------------------------------------- |
| `npm run dev`           | Mobile dev server (hot reload, no service worker)     |
| `npm run dev:api`       | FastAPI with auto-reload                              |
| `npm run setup:api`     | Create `services/api/.venv` and install deps          |
| `npm run phone`         | Check adb/device, reverse ports, open the dev app     |
| `npm run phone:reverse` | Same, without opening Chrome                          |
| `npm run app`           | Build and serve the installable app on :4173          |
| `npm run phone:app`     | Point the phone at the installable app                |
| `npm run android`       | Deploy, build the signed APK, install it on the phone |
| `npm run dev:admin`     | Admin portal dev server on :5174                      |
| `npm run admin:app`     | Build the admin portal and serve it on :4174          |
| `npm run android:admin` | Build and install the admin Android app (Capacitor)   |
| `npm run i18n:export`   | Export all strings to `translations/strings.csv`      |
| `npm test`              | Unit tests (mobile, shared) and API tests (pytest)    |
| `npm run typecheck`     | Strict TypeScript across workspaces                   |
| `npm run lint`          | ESLint                                                |
| `npm run format`        | Prettier                                              |
| `npm run build`         | Typecheck and production build of all workspaces      |
