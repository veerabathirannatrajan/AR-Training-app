# Graph Report - AR_Training  (2026-10-01)

## Corpus Check
- 191 files · ~83,248 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1303 nodes · 3183 edges · 63 communities (57 shown, 3 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 52 edges (avg confidence: 0.87)
- Token cost: 98,874 input · 0 output

## Community Hubs (Navigation)
- FastAPI Backend & Auth
- Worker Login & Session
- Scene Interaction & Stage
- Gas Module HUD & Tests
- Gas Scene Crew & Story
- Gas Props & Layout
- Root Tooling & Lint
- Android TWA Build
- PWA Install & Platform
- Project Brief & Concepts
- HUD Feedback & Buttons
- Splash & Backdrop
- Fire Scene & Avatar Pose
- Gesture Math & Input
- Avatar Geometry Builder
- HUD Controls
- AR Placement & Reticle
- App Shell & Orientation
- Height & Input Routing
- Crosshair Aim System
- 3D Fallback & Engine Tests
- Base TS Config
- Low-Poly Fire Effect
- Floor Arrows & Particles
- i18n Resources & Santali
- Mobile Runtime Deps
- Navigation & Back Guard
- Voice Narration
- Fire Props & Layout
- Mobile Package Manifest
- Gas Cloud Effects
- Module Content Types
- Assessment Scoring
- Translation CSV Export
- Offline DB & Progress
- Content JSON Schema
- API Python Env Scripts
- Crouch Detection
- Gas Quiz Illustrations
- Avatar Rig & Leg IK
- Step Runner Store
- World Labels & XR Store
- Fire Quiz Illustrations
- Procedural Sound FX
- Retraining Story State
- Shared Package Manifest
- Android Package Manifest
- Mobile Dev Deps
- Mobile npm Scripts
- App Icons
- Extinguisher Types & Icon
- Mobile TS Config
- Node TS Config
- Render Mode Types
- Vite & PWA Config
- Prettier Config
- Shared TS Config
- API CORS Tests
- Vite Env Types
- PWA Icon Set Concept

## God Nodes (most connected - your core abstractions)
1. `react` - 51 edges
2. `flatMaterial()` - 49 edges
3. `runner()` - 44 edges
4. `cx()` - 40 edges
5. `engine()` - 37 edges
6. `useEngineStore` - 31 edges
7. `three` - 29 edges
8. `useLocalized()` - 28 edges
9. `useStepActive()` - 26 edges
10. `useRunnerStore` - 24 edges

## Surprising Connections (you probably didn't know these)
- `xr-overlay div (UI and WebXR dom-overlay root)` --implements--> `AR engine core (hit-test, dom-overlay, crouch tracking, interaction, 3D fallback, event logger)`  [INFERRED]
  apps/mobile/index.html → PROJECT_BRIEF.md
- `Demo seed data and login (48 workers, 4 sites, PIN 1234)` --shares_data_with--> `FastAPI backend (auth, results, certificates, verify, analytics)`  [INFERRED]
  README.md → PROJECT_BRIEF.md
- `API Python requirements (fastapi, uvicorn, sqlalchemy, pyjwt, pytest, httpx2)` --implements--> `FastAPI backend (auth, results, certificates, verify, analytics)`  [INFERRED]
  services/api/requirements.txt → PROJECT_BRIEF.md
- `TrainingDatabase` --references--> `ModuleResult`  [EXTRACTED]
  apps/mobile/src/data/db.ts → packages/shared/src/results.ts
- `EngineState` --references--> `RenderMode`  [EXTRACTED]
  apps/mobile/src/engine/engineStore.ts → packages/shared/src/render.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Required assessed training modules built on shared AR engine** — project_brief_fire_explosion_module, project_brief_gas_confined_space_module, project_brief_ar_engine_core, project_brief_assessment_engine [EXTRACTED 1.00]
- **Offline-capable delivery: PWA, Android TWA, and Vercel-hosted app** — readme_pwa_install, readme_android_twa, readme_vercel_deployment [INFERRED 0.85]
- **Localised narration pipeline (TTS, recorded audio, Santali fallback)** — project_brief_voice_narration, apps_mobile_src_assets_audio_readme_narration_ids, apps_mobile_src_assets_audio_readme_santali_fallback, project_brief_localisation [INFERRED 0.85]
- **PWA icon rasters derived from icon.svg** — apps_mobile_public_icon, apps_mobile_public_pwa_64x64, apps_mobile_public_pwa_192x192, apps_mobile_public_pwa_512x512, apps_mobile_public_maskable_icon_512x512, apps_mobile_public_apple_touch_icon_180x180 [INFERRED 0.85]

## Communities (63 total, 3 thin omitted)

### Community 0 - "FastAPI Backend & Auth"
Cohesion: 0.05
Nodes (65): BaseModel, DeclarativeBase, Engine, exception_handler, FastAPI, fixture, get, HealthResponse (+57 more)

### Community 1 - "Worker Login & Session"
Cohesion: 0.05
Nodes (55): SessionState, LOCAL_LOCKOUT_MS, LOCAL_MAX_FAILED_ATTEMPTS, lockedOutcome(), login(), LoginError, LoginOutcome, logout() (+47 more)

### Community 2 - "Scene Interaction & Stage"
Cohesion: 0.07
Nodes (59): Stage(), engine(), useInteractable(), HighlightRing(), answerQuiz(), doCurrentStep(), completeCurrent(), startTutorial() (+51 more)

### Community 3 - "Gas Module HUD & Tests"
Cohesion: 0.07
Nodes (54): atmosphere(), doCurrentStep(), runTo(), CardDrag, CELL_ORDER, CellState, ChannelReading(), GasTray() (+46 more)

### Community 4 - "Gas Scene Crew & Story"
Cohesion: 0.06
Nodes (52): blowerOutlet, Crew(), ease(), EXIT_ROUTE, HoseState, isWalkPhase(), MONITOR_STEPS, NONE (+44 more)

### Community 5 - "Gas Props & Layout"
Cohesion: 0.06
Nodes (48): flatMaterial(), AREA, COLLAR_HEIGHT, FLANGES, MANHOLE_COLLAR, MANHOLE_OPENING, PIPE_FROM_X, PIPE_SUPPORTS (+40 more)

### Community 6 - "Root Tooling & Lint"
Cohesion: 0.04
Nodes (47): description, devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, prettier (+39 more)

### Community 7 - "Android TWA Build"
Cohesion: 0.08
Nodes (40): ANDROID, APK, ASSET_LINKS, bubblewrap, buildApk(), checkAssetLinks(), deployToVercel(), ensureSigningKey() (+32 more)

### Community 8 - "PWA Install & Platform"
Cohesion: 0.10
Nodes (34): BeforeInstallPromptEvent, InstallState, ServiceWorkerStatus, standaloneQuery, subscribeOnline(), useInstallStore, useIsStandalone(), useOnline() (+26 more)

### Community 9 - "Project Brief & Concepts"
Cohesion: 0.08
Nodes (36): Mobile app HTML shell (root and xr-overlay divs, main.tsx entry), xr-overlay div (UI and WebXR dom-overlay root), Recorded narration README, Narration file id scheme (audio/{lang}/{id}.mp3), Santali narration fallback (Hindi recording, then Hindi TTS), PROJECT_BRIEF (AR Mining Training App, SIH 2026 PS SIH26041), 3D fallback mode (no-AR phones), Admin web portal (apps/admin) (+28 more)

### Community 10 - "HUD Feedback & Buttons"
Cohesion: 0.12
Nodes (27): Button(), haptic, sfx, FEEDBACK_ICONS, FeedbackToast(), InstructionCard(), INTERACTION_ICONS, CriticalModal() (+19 more)

### Community 11 - "Splash & Backdrop"
Cohesion: 0.12
Nodes (25): useInstallPrompt(), currentWorker(), buildTriangles(), LowPolyBackdrop(), mulberry32(), Triangle, TRIANGLES, formatElapsed() (+17 more)

### Community 12 - "Fire Scene & Avatar Pose"
Cohesion: 0.10
Nodes (27): CameraAttached(), AvatarPose, usePlacementClock(), cameraForward, cameraPosition, desiredPosition, desiredTarget, FireScene() (+19 more)

### Community 13 - "Gesture Math & Input"
Cohesion: 0.11
Nodes (16): signals, angleBetween(), DRAG_ROTATE_GAIN, dragRotateDelta(), headingOf(), intersectHorizontalPlane(), TAP_MAX_ANGLE_RAD, TAP_MAX_MS (+8 more)

### Community 14 - "Avatar Geometry Builder"
Cohesion: 0.16
Nodes (28): AvatarBuild, avatarGeometry, AvatarLook, avatarMaterial, bake(), boot(), box(), cache (+20 more)

### Community 15 - "HUD Controls"
Cohesion: 0.19
Nodes (22): cx(), useEngineStore, Crosshair(), CrouchButton(), CrouchMeter(), HOLD_ICONS, HoldButton(), MoveButton() (+14 more)

### Community 16 - "AR Placement & Reticle"
Cohesion: 0.12
Nodes (18): cameraPosition, hitMatrix, hitPosition, hitRotation, hitScale, MIN_UP_DOT, normal, cache (+10 more)

### Community 17 - "App Shell & Orientation"
Cohesion: 0.16
Nodes (17): App(), useCurrentRoute(), LockableOrientation, OrientationNeed, useOrientationLock(), orientationFor(), FallbackView, HoldLabel (+9 more)

### Community 18 - "Height & Input Routing"
Cohesion: 0.17
Nodes (16): ARPlacement(), nextCrouchState(), cameraPosition, HeightTracker(), rootPosition, InputRouter(), ndc, quaternion (+8 more)

### Community 19 - "Crosshair Aim System"
Cohesion: 0.11
Nodes (17): AimSystem(), cameraPosition, center, forward, toTarget, visibleInWorld(), takeSwipe(), AimTargetConfig (+9 more)

### Community 20 - "3D Fallback & Engine Tests"
Cohesion: 0.14
Nodes (15): FallbackEnvironment(), latestDevice, lookDirection, relative, backCamera, deviceQuaternion(), euler, screenAngle() (+7 more)

### Community 21 - "Base TS Config"
Cohesion: 0.09
Nodes (21): compilerOptions, allowImportingTsExtensions, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules, lib, module, moduleDetection (+13 more)

### Community 22 - "Low-Poly Fire Effect"
Cohesion: 0.13
Nodes (17): createShardGeometry(), dummy, emberGeometry, emberMaterial, glowGeometry, glowMaterial, LAYERS, LowPolyFire() (+9 more)

### Community 23 - "Floor Arrows & Particles"
Cohesion: 0.11
Nodes (17): arrowColor, arrowGeometry, arrowMaterial, bright, dim, direction, dummy, FloorArrows() (+9 more)

### Community 24 - "i18n Resources & Santali"
Cohesion: 0.19
Nodes (14): CustomTypeOptions, i18next, englishResources, Namespace, NAMESPACES, resources, santaliReviewed, isReviewedString() (+6 more)

### Community 25 - "Mobile Runtime Deps"
Cohesion: 0.11
Nodes (18): dependencies, @ar-training/shared, dexie, dexie-react-hooks, @fontsource/noto-sans, @fontsource/noto-sans-devanagari, @fontsource/noto-sans-ol-chiki, i18next (+10 more)

### Community 26 - "Navigation & Back Guard"
Cohesion: 0.19
Nodes (14): armBackGuard(), BackHandler, backHandlers, installBackGuard(), NavigationState, Route, useBackHandler(), useNavigation (+6 more)

### Community 27 - "Voice Narration"
Cohesion: 0.24
Nodes (16): readLocal(), writeLocal(), finished(), NarratorState, pickVoice(), play(), playRecording(), queue (+8 more)

### Community 28 - "Fire Props & Layout"
Cohesion: 0.11
Nodes (16): AREA, DESK_HEIGHT, AreaFloor(), AssemblyPointSign(), CallPoint, EXIT_SEGMENTS, ExitDoor, ExtinguisherModel() (+8 more)

### Community 29 - "Mobile Package Manifest"
Cohesion: 0.12
Nodes (16): name, private, type, version, @ar-training/shared, fake-indexeddb, @fontsource/noto-sans, @fontsource/noto-sans-devanagari (+8 more)

### Community 30 - "Gas Cloud Effects"
Cohesion: 0.14
Nodes (15): along(), direction, DRAIN_PATH, dummy, GasCloud(), PitGas(), placeBetween(), Point (+7 more)

### Community 31 - "Module Content Types"
Cohesion: 0.14
Nodes (12): ContentReview, CriticalError, ModuleKind, QuizOption, QuizQuestion, SantaliText, trainingModuleSchema, StepOption (+4 more)

### Community 32 - "Assessment Scoring"
Cohesion: 0.24
Nodes (11): RunnerState, ASSESSMENT_RULES, AttemptScore, percent(), scoreAttempt(), stepMastery, AttemptType, ModuleResult (+3 more)

### Community 33 - "Translation CSV Export"
Cohesion: 0.14
Nodes (13): BOM, columns, csv, escape(), flagged, flatten(), isReviewed(), LOCALES (+5 more)

### Community 34 - "Offline DB & Progress"
Cohesion: 0.17
Nodes (10): TrainingDatabase, ModuleProgress, ModuleStatus, NO_PROGRESS, summarizeProgress(), useModuleProgress(), TrainingEvent, resultPercent() (+2 more)

### Community 35 - "Content JSON Schema"
Cohesion: 0.15
Nodes (12): criticalErrorSchema, kebab, localizedTextSchema, moduleStepSchema, nonEmpty, quizQuestionSchema, santaliTextSchema, SchemaOutput (+4 more)

### Community 36 - "API Python Env Scripts"
Cohesion: 0.31
Nodes (8): child, API_DIR, findSystemPython(), MIN_PYTHON, VENV_DIR, VENV_PYTHON, venvExists(), result

### Community 37 - "Crouch Detection"
Cohesion: 0.20
Nodes (10): clampStandingHeight(), CROUCH_DROP_RATIO, CROUCH_HYSTERESIS_M, crouchDepth(), crouchThreshold(), MIN_CROUCH_DROP_M, STANDING_RANGE_M, GestureMode (+2 more)

### Community 38 - "Gas Quiz Illustrations"
Cohesion: 0.24
Nodes (6): GAS_ILLUSTRATIONS, AttendantIllustration(), HeavyGasIllustration(), NoSwitchIllustration(), RescueIllustration(), TestOrderIllustration()

### Community 39 - "Avatar Rig & Leg IK"
Cohesion: 0.33
Nodes (9): clamp(), HIP_HEIGHT, legAngles, RIG, LIMBS, mix(), seedFrom(), sideOf() (+1 more)

### Community 40 - "Step Runner Store"
Cohesion: 0.20
Nodes (8): CriticalAlert, Feedback, FeedbackTone, idle, RunnerSnapshot, RunnerStatus, SLOW_PENALTY_RATIO, LocalizedText

### Community 41 - "World Labels & XR Store"
Cohesion: 0.24
Nodes (7): labelLayer(), projected, WorldLabel(), WorldLabelVariant, xrStore, overlayRoot, @react-three/xr

### Community 42 - "Fire Quiz Illustrations"
Cohesion: 0.27
Nodes (6): FIRE_ILLUSTRATIONS, AimIllustration(), EscapeIllustration(), LiftIllustration(), PassIllustration(), SmokeIllustration()

### Community 43 - "Procedural Sound FX"
Cohesion: 0.42
Nodes (8): audio(), beepLoop(), Loop, noise(), noiseLoop(), radioBurst(), sirenLoop(), tone()

### Community 44 - "Retraining Story State"
Cohesion: 0.20
Nodes (10): stepPassed(), useStepPassed(), GasOverlay(), clamp(), doneAtMount(), EntryKit(), GasScene(), hoseGeometry() (+2 more)

### Community 45 - "Shared Package Manifest"
Cohesion: 0.20
Nodes (9): description, exports, name, private, scripts, test, typecheck, type (+1 more)

### Community 46 - "Android Package Manifest"
Cohesion: 0.22
Nodes (8): description, devDependencies, @bubblewrap/core, name, private, type, version, @bubblewrap/core

### Community 47 - "Mobile Dev Deps"
Cohesion: 0.22
Nodes (9): devDependencies, fake-indexeddb, @types/react, @types/react-dom, @types/three, vite, vite-plugin-pwa, @vite-pwa/assets-generator (+1 more)

### Community 48 - "Mobile npm Scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, icons, preview, test, typecheck

### Community 50 - "Extinguisher Types & Icon"
Cohesion: 0.38
Nodes (5): ExtinguisherIcon(), EXTINGUISHER_STYLE, EXTINGUISHER_TYPES, ExtinguisherType, isExtinguisherType()

### Community 51 - "Mobile TS Config"
Cohesion: 0.29
Nodes (6): compilerOptions, jsx, types, extends, include, ../../tsconfig.base.json

### Community 52 - "Node TS Config"
Cohesion: 0.29
Nodes (6): compilerOptions, lib, types, extends, include, ../../tsconfig.base.json

### Community 53 - "Render Mode Types"
Cohesion: 0.40
Nodes (4): EngineState, StartArgs, RenderMode, XRUnsupportedReason

### Community 54 - "Vite & PWA Config"
Cohesion: 0.40
Nodes (3): vite, vite-plugin-pwa, @vitejs/plugin-react

### Community 55 - "Prettier Config"
Cohesion: 0.40
Nodes (4): printWidth, semi, singleQuote, trailingComma

### Community 56 - "Shared TS Config"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 57 - "API CORS Tests"
Cohesion: 0.67
Nodes (3): TestClient, test_deployed_app_may_call_the_local_api(), test_other_sites_are_not_allowed()

## Knowledge Gaps
- **399 isolated node(s):** `singleQuote`, `semi`, `trailingComma`, `printWidth`, `name` (+394 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 479 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Height & Input Routing` to `Scene Interaction & Stage`, `Gas Module HUD & Tests`, `Gas Scene Crew & Story`, `Gas Props & Layout`, `PWA Install & Platform`, `HUD Feedback & Buttons`, `Splash & Backdrop`, `Fire Scene & Avatar Pose`, `HUD Controls`, `AR Placement & Reticle`, `App Shell & Orientation`, `Crosshair Aim System`, `3D Fallback & Engine Tests`, `Low-Poly Fire Effect`, `Floor Arrows & Particles`, `Navigation & Back Guard`, `Fire Props & Layout`, `Mobile Package Manifest`, `Gas Cloud Effects`, `Gas Quiz Illustrations`, `Avatar Rig & Leg IK`, `World Labels & XR Store`, `Fire Quiz Illustrations`?**
  _High betweenness centrality (0.105) - this node is a cross-community bridge._
- **Why does `vitest` connect `Scene Interaction & Stage` to `Assessment Scoring`, `Worker Login & Session`, `Offline DB & Progress`, `Gas Module HUD & Tests`, `Root Tooling & Lint`, `3D Fallback & Engine Tests`, `i18n Resources & Santali`, `Module Content Types`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Why does `three` connect `AR Placement & Reticle` to `Scene Interaction & Stage`, `Gas Scene Crew & Story`, `Gas Props & Layout`, `Avatar Rig & Leg IK`, `World Labels & XR Store`, `Fire Scene & Avatar Pose`, `Gesture Math & Input`, `Avatar Geometry Builder`, `Height & Input Routing`, `Crosshair Aim System`, `3D Fallback & Engine Tests`, `Low-Poly Fire Effect`, `Floor Arrows & Particles`, `Fire Props & Layout`, `Mobile Package Manifest`, `Gas Cloud Effects`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **What connects `singleQuote`, `semi`, `trailingComma` to the rest of the system?**
  _399 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `FastAPI Backend & Auth` be split into smaller, more focused modules?**
  _Cohesion score 0.05126452494873548 - nodes in this community are weakly interconnected._
- **Should `Worker Login & Session` be split into smaller, more focused modules?**
  _Cohesion score 0.05115089514066496 - nodes in this community are weakly interconnected._
- **Should `Scene Interaction & Stage` be split into smaller, more focused modules?**
  _Cohesion score 0.06547619047619048 - nodes in this community are weakly interconnected._