# AR Mining Training App

AR safety training for Jharkhand's mining, steel and mica workers (SIH 2026, PS SIH26041).
See [PROJECT_BRIEF.md](PROJECT_BRIEF.md) for the full scope and phase plan.

> Status: **Phase 0**. Monorepo, tooling, phone dev loop and the "Hello AR" device test.
> The full setup and demo guide comes in Phase 7.

## Layout

| Path              | What                                                                   |
| ----------------- | ---------------------------------------------------------------------- |
| `apps/mobile`     | Worker app: React 18 + TS + Vite, React Three Fiber, `@react-three/xr` |
| `apps/admin`      | Admin compliance portal (Phase 5)                                      |
| `services/api`    | FastAPI service (Python, `.venv` inside)                               |
| `packages/shared` | Shared TypeScript types, content schemas, scoring types                |
| `scripts`         | Dev helpers: phone/adb setup, API venv setup and runner                |

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

## Daily dev loop (phone over USB)

Run each in its own terminal:

```sh
npm run dev        # mobile app on http://127.0.0.1:5173 (hot reload)
npm run dev:api    # API on http://127.0.0.1:8000
npm run phone      # adb reverse 5173 + 8000, then opens http://localhost:5173 in Chrome on the phone
```

`localhost` on the phone is tunnelled to the laptop by `adb reverse`, which makes it a secure
context (WebXR requires one) and keeps hot reload working. Re-run `npm run phone` after
reconnecting the cable.

**Phone console logs:** open `chrome://inspect/#devices` in Chrome on the laptop and click
**inspect** under `localhost:5173`.

**Force the 3D fallback** on an AR-capable phone: open `http://localhost:5173/?mode=3d`.

## Scripts

| Script                  | Does                                             |
| ----------------------- | ------------------------------------------------ |
| `npm run dev`           | Mobile dev server                                |
| `npm run dev:api`       | FastAPI with auto-reload                         |
| `npm run setup:api`     | Create `services/api/.venv` and install deps     |
| `npm run phone`         | Check adb/device, reverse ports, open Chrome     |
| `npm run phone:reverse` | Same, without opening Chrome                     |
| `npm run typecheck`     | Strict TypeScript across workspaces              |
| `npm run lint`          | ESLint                                           |
| `npm run format`        | Prettier                                         |
| `npm run build`         | Typecheck and production build of all workspaces |
