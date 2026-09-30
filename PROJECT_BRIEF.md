# PROJECT BRIEF – AR Mining Training App (SIH 2026, PS SIH26041)

## Your role
Act as a senior WebXR/AR game developer and full-stack engineer. Build a production-quality, interactive AR safety training platform for Jharkhand's mining, steel and mica workers. Work in phases, verify each phase on my real Android phone before moving on, and keep the code clean, typed and modular.

## Problem statement requirements (all must be met)
1. Mobile AR training app for mid-range Android phones (Android 10+), no headset.
2. At least two complete, interactive AR training modules:
   - Fire & Explosion Response (exit identification, extinguisher use, evacuation sequencing)
   - Gas Leak & Confined Space Protocol (hazard zone recognition, PPE selection, buddy system)
3. Assessment engine that verifies comprehension, not just attendance.
4. QR-based certificate generation and verification.
5. Hindi and Santali localisation (plus English).
6. Offline functionality.
7. Web admin compliance dashboard.
Bonus: extra modules (Machinery Safety & Assembly / LOTO, Card Scan Safety Tips).
Blockchain (Polygon) comes LATER: build a clean adapter interface with a stub now, no web3 code yet.

## Dev environment
- Windows 11 laptop. Android phone connected via USB with USB debugging on.
- Run the mobile app with Vite dev server on port 5173, then run `adb reverse tcp:5173 tcp:5173` (and `adb reverse tcp:8000 tcp:8000` for the API) so the phone opens http://localhost:5173 in Chrome. This gives hot reload on the phone and a secure context for WebXR.
- Tell me to use chrome://inspect on the laptop for phone console logs.
- If adb is not found or the device is not listed, stop and tell me exactly what to fix.

## Tech stack
- Monorepo with npm workspaces: `apps/mobile`, `apps/admin`, `services/api`, `packages/shared`.
- Mobile: React 18 + TypeScript + Vite, React Three Fiber, @react-three/drei, @react-three/xr (WebXR immersive-ar with hit-test and dom-overlay), Zustand for state, i18next, Dexie (IndexedDB), vite-plugin-pwa (Workbox), qrcode (generate), jsQR or BarcodeDetector (scan).
- Admin: React + TypeScript + Vite + Tailwind + shadcn/ui, Recharts, React-Leaflet, TanStack Query.
- API: Python FastAPI, SQLAlchemy, SQLite for development (Postgres-ready), Pydantic, PyNaCl (Ed25519 signing).
- Shared: TypeScript types, module content schemas, scoring rubric types.

## Mobile app flow
Splash → Language select (English / हिन्दी / ᱥᱟᱱᱛᱟᱲᱤ) → Worker login (worker ID + 4-digit PIN, works offline after first sync) → Home (module cards with progress and certificate status) → Module intro (short narrated briefing) → Device check (WebXR AR supported? else 3D fallback mode) → AR scene placement → Interactive training steps → Assessment result → Certificate (with QR) → Home.

## AR engine core (build once, reuse in every module)
- WebXR immersive-ar session with hit-test reticle on the floor, tap to place the scene, pinch/drag to rotate, and a "reposition" button.
- DOM overlay for all UI panels on top of the camera.
- Device height tracking relative to the detected floor (used for "crouch under smoke").
- Interaction system: tap to select, drag onto targets, hold-to-act (e.g., squeeze extinguisher), aim using the phone's forward direction (raycast from the camera center with a crosshair).
- 3D fallback mode for phones without AR: the same scene rendered in a simple 3D room with touch orbit and gyroscope look; all steps and scoring identical.
- Every step emits events to an event logger (step id, action, correct/incorrect, timestamp, time taken).
- Performance: target 60 fps on mid-range phones, < 60k triangles per scene, instanced meshes, no real-time shadows, pixel ratio capped at 1.5.

## Visual style
- 3D: very low-poly, flat-shaded, faceted geometry (flatShading: true), flat solid colours, no textures. Build all models procedurally in code from primitives so the app works offline with no downloaded assets.
- Fire: low-poly faceted flame shapes stacked and animated (scale/flicker), triangular ember particles. No realistic smoke; use simple low-poly grey puffs.
- UI: Apple visionOS-style frosted-glass panels (backdrop-filter blur), soft claymorphic bottom trays, rounded corners, safety-orange accent, green for correct, red for critical, amber for warnings. Consistent 8px spacing. Large touch targets (≥ 48px). Icons plus short text; every instruction also has voice narration.
- Top bar in every module: voice guidance button, timer, module title pill with step progress, language chip, offline badge, score chip.

## Modules (content in JSON under packages/shared/content so it can be reviewed and edited)
Follow standard, widely accepted industrial safety practice. Do not invent procedures. Keep all safety text in content JSON with a "source/notes" field so a safety expert can review it.

### Module 1 – Fire & Explosion Response (required)
Scene: electrical fire at a workstation, extinguisher station, two exits (one becomes blocked by fire).
Steps:
1. Raise the alarm (tap the alarm point).
2. Identify the fire type (electrical, Class C in Indian classification context) from a short visual question.
3. Choose the correct extinguisher from a tray (Water, Foam, CO₂, Dry Powder). Water on an electrical fire = critical error.
4. PASS technique with gestures: tap to Pull the pin, point the crosshair to Aim at the base of the fire, press and hold to Squeeze, swipe left-right to Sweep. The fire shrinks only with correct aim and sweep.
5. Smoke rises: the worker must physically crouch (device height drops) while moving to the exit, otherwise lose points.
6. Evacuation: AR arrows show the route; the first exit gets blocked; the worker must choose the alternate exit and reach the assembly point.
Critical errors: water on electrical fire, using an elevator/blocked route, re-entering.

### Module 2 – Gas Leak & Confined Space Protocol (required)
Scene: leaking pipe near a confined space entry (manhole/tunnel gate), low-poly gas cloud with hazard zones (red inner, amber outer).
Steps:
1. Recognise the leak: identify hazard zones by tapping them.
2. Alert and evacuate the immediate area; do not operate electrical switches.
3. Atmospheric testing before entry with a virtual gas monitor, in the correct order: oxygen, then flammable gas (% LEL), then toxic gases (H₂S, CO). Readings react to where the phone points.
4. Permit and ventilation: confirm a confined space entry permit and start ventilation; readings must return to safe ranges before entry.
5. PPE selection: drag correct items onto a low-poly worker avatar (helmet, breathing apparatus/respirator as appropriate, harness with lifeline, personal gas detector). Wrong or missing items flagged.
6. Buddy system: assign an attendant who stays outside; set up communication check. Entering without an attendant = critical error.
7. Emergency: a worker collapses inside; the correct action is to raise the alarm and use rescue retrieval, never enter without breathing apparatus. Entering to rescue unprotected = critical error.

### Module 3 – Machinery Safety & Assembly / LOTO (bonus)
Scene: very low-poly mining excavator split into parts (track base, main body, boom arm, dipper arm, bucket).
Steps: wear PPE, place track base, mount main body, attach boom and dipper arm, attach bucket (drag-and-snap with alignment tolerance), safety check, then Lockout/Tagout: inform supervisor, switch off, isolate energy, apply lock and tag, verify zero energy. Standing under a raised bucket or skipping lockout = critical error.

### Module 4 – Card Scan Safety Tips (bonus)
Scan a printed worker safety card's QR with the camera (use QR detection, since WebXR image tracking is not reliably available), then show a low-poly helmet with floating tip cards (4 tips per card), with "Next tip", "Listen" and "Start training" buttons.

## Assessment engine
- Score = 60% practical (AR actions: correct steps, correct order, time) + 40% scenario quiz (5 image + audio questions per module).
- Pass mark 70%. Any critical error = fail for that attempt, with a clear explanation of why.
- Show a result screen with per-step breakdown (what was right, what was wrong, the correct action).
- Personalised retraining: on failure, replay only the failed steps first.
- Track per-worker skill mastery per step; expose it to the admin dashboard.
- Refresher micro-drills scheduled 1, 3 and 7 days after certification (local reminders when the app opens).

## Certificates and QR verification
- On pass, create a certificate: id (e.g. CERT-0001 format from server, provisional id offline), worker id, module, score, issued date, expiry date (1 year).
- Compute SHA-256 over the canonical JSON of the certificate.
- Offline: mark as "provisional". On sync, the API signs the hash with Ed25519 and returns the signature.
- QR code encodes: certificate id + hash + signature (compact).
- Verification: a page in both the mobile app and the admin portal that scans or accepts an ID, checks the signature with the public key, checks expiry and revocation, and shows VALID / INVALID with details. Signature verification must work offline.
- Blockchain adapter: create an interface `ChainAnchor` with `anchor(hash)` and `verify(hash)` and a stub implementation returning "not anchored yet". Leave clear TODOs for Polygon Amoy later.

## Offline
- PWA with Workbox: precache the app shell, all JS, fonts, audio and content JSON.
- Dexie tables: workers, sessions, events, results, certificates, syncQueue.
- Sync engine: when online, push queued results, pull signatures/certificates, retry with backoff. Show sync status in the UI.
- The whole training and assessment flow must work in airplane mode after the first launch.

## Localisation
- i18next with en, hi, sat namespaces. Bundle Noto Sans Devanagari and Noto Sans Ol Chiki fonts locally.
- Voice narration: use the Web Speech API where a voice exists; structure it so pre-recorded audio files can be dropped in later (audio/{lang}/{stepId}.mp3) and used first if present.
- IMPORTANT: do not invent Santali translations. Use machine-assisted drafts only if clearly marked, and flag every Santali string with "needsReview: true" so a native speaker can check it. Provide a script that exports all strings to a CSV for translators.

## API (FastAPI)
Endpoints: auth (admin JWT; worker ID+PIN), workers, sites, modules, results (bulk sync), certificates (issue/sign, get, revoke), verify, analytics (KPIs, module performance, common mistakes, district/site compliance, worker history), exports (PDF and CSV).
Seed data: small and realistic (about 48 workers, 4 sites: Dhanbad, Bokaro, Ranchi, Koderma; coal, steel, mica sectors).

## Admin web portal (apps/admin)
Style: clean grey and white, React + Tailwind + shadcn/ui, Inter font, white cards with thin borders, minimal shadows, small coloured status dots only. Name: "AR Mining Training App – Admin".
Pages:
- Dashboard: 4 KPI cards (Workers Registered, Certified, Avg. Score, Expiring Soon), sites map (React-Leaflet), module results bar chart, common mistakes list, insights (rule-based for now: e.g. "5 of 14 workers failed PPE selection"), recent assessments table.
- Workers: list with filters, worker detail with full training history, attempts, per-step mastery and certificates.
- Modules: pass rates, average scores, hardest steps.
- Certificates: list, status, expiry, revoke, download PDF with QR.
- Verify Certificate: scan QR (webcam) or enter ID.
- Reports: export PDF/CSV compliance reports by site/sector/date range.
- Settings: sites, admins, pass mark.
Include a small interactive 3D card (React Three Fiber) on the dashboard showing a rotating low-poly module preview.

## Phases (stop after each phase, run it, and tell me exactly what to test on my phone)
- Phase 0: Monorepo setup, tooling, run mobile app on phone via adb reverse with hot reload, "Hello AR" test: hit-test reticle and tap to place a low-poly cube. Confirm AR works on my phone or fallback triggers.
- Phase 1: AR engine core, design system, top bar, language select, login, home, offline shell.
- Phase 2: Fire & Explosion module complete with assessment.
- Phase 3: Gas Leak & Confined Space module complete with assessment.
- Phase 4: Certificates, QR generation, verification, sync engine, API.
- Phase 5: Admin portal.
- Phase 6: Machinery and Card Scan bonus modules.
- Phase 7: Localisation polish, performance tuning, APK packaging with Bubblewrap (TWA), README with setup and demo steps.

## Working rules
- Keep TypeScript strict. No placeholder "TODO" UI in finished phases.
- Commit after each working step with clear messages.
- After each phase, list what was built, how to run it, and what to test on the phone.
- If something is not possible on this device or stack, tell me clearly and propose the best alternative instead of faking it.