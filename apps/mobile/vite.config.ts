import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const APP_VERSION = '0.4.0';
const CERT_PUBLIC_KEY_FILE = fileURLToPath(
  new URL('../../services/api/keys/cert_signing_ed25519.pub', import.meta.url),
);

/**
 * The API's certificate public key, baked into the build when the API has created it (on its
 * first start), so a fresh install can verify certificate QR codes offline before its first sync.
 */
function builtInCertKeys() {
  if (!existsSync(CERT_PUBLIC_KEY_FILE)) return [];
  const publicKey = readFileSync(CERT_PUBLIC_KEY_FILE, 'utf8').trim();
  if (!/^[0-9a-f]{64}$/.test(publicKey)) return [];
  const keyId = createHash('sha256')
    .update(Buffer.from(publicKey, 'hex'))
    .digest('hex')
    .slice(0, 8);
  return [{ keyId, algorithm: 'Ed25519', publicKey }];
}

const XR_EMULATOR_STUB = '\0xr-emulator-stub';

/**
 * @pmndrs/xr lazy-imports a Meta Quest emulator (iwer + sample rooms, ~6 MB) for desktop
 * testing. We run with `emulate: false`, so swap the module for a stub: it would otherwise
 * be emitted as chunks and end up in the offline precache.
 */
function stripXREmulator(): Plugin {
  return {
    name: 'strip-xr-emulator',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source === './emulate.js' && importer?.replaceAll('\\', '/').includes('/@pmndrs/xr/')) {
        return XR_EMULATOR_STUB;
      }
      return null;
    },
    load(id) {
      if (id === XR_EMULATOR_STUB) {
        return 'export function emulate() { throw new Error("The WebXR emulator is not bundled in this app."); }';
      }
      return null;
    },
  };
}

// The phone reaches the dev server through `adb reverse tcp:5173 tcp:5173`, which connects
// to 127.0.0.1 on the laptop. Binding to 127.0.0.1 explicitly avoids Node resolving
// "localhost" to ::1 only, which adb reverse cannot reach.
export default defineConfig({
  define: {
    __ARMT_CERT_KEYS__: JSON.stringify(builtInCertKeys()),
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  plugins: [
    stripXREmulator(),
    react(),
    VitePWA({
      // Updates are applied when the worker taps "Update" on the home screen, never mid-training.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      manifest: {
        id: '/',
        name: 'AR Mining Training',
        short_name: 'AR Training',
        description: 'AR safety training for mining, steel and mica workers in Jharkhand.',
        lang: 'en-IN',
        start_url: '/',
        scope: '/',
        // Full screen like a native app (the Android app hides the status and navigation bars too).
        display: 'fullscreen',
        orientation: 'portrait',
        background_color: '#11151c',
        theme_color: '#11151c',
        categories: ['education', 'productivity'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App shell, all JS/CSS, fonts, icons, audio and content JSON: everything needed to
        // train and assess in airplane mode after the first launch.
        globPatterns: ['**/*.{js,css,html,woff2,svg,png,ico,webmanifest,json,mp3}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        // Keep the service worker out of `npm run dev` so hot reload never serves stale files.
        enabled: false,
      },
    }),
  ],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
