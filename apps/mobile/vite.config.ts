import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

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

// The phone reaches this server through `adb reverse tcp:5173 tcp:5173`, which connects
// to 127.0.0.1 on the laptop. Binding to 127.0.0.1 explicitly avoids Node resolving
// "localhost" to ::1 only, which adb reverse cannot reach.
export default defineConfig({
  plugins: [stripXREmulator(), react()],
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
