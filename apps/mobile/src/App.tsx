import type { XRCapabilities, XRUnsupportedReason } from '@ar-training/shared';
import { Canvas } from '@react-three/fiber';
import { XR } from '@react-three/xr';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { HelloARScene } from './features/hello-ar/HelloARScene';
import { HelloFallbackScene } from './features/hello-ar/HelloFallbackScene';
import { HelloPreviewScene } from './features/hello-ar/HelloPreviewScene';
import { ARHud, FallbackHud } from './features/hello-ar/Hud';
import { UNSUPPORTED_REASON_TEXT } from './features/hello-ar/messages';
import { StartScreen } from './features/hello-ar/StartScreen';
import { overlayRoot } from './lib/overlayRoot';
import { useApiHealth } from './lib/useApiHealth';
import { describeARStartError, detectXRCapabilities, isFallbackForced } from './xr/capabilities';
import { useBlockXRSelectOnUI } from './xr/useBlockXRSelectOnUI';
import { useXRSession } from './xr/useXRSession';
import { xrStore } from './xr/xrStore';

/** Why the 3D fallback is showing; `null` means the user chose it on an AR-capable phone. */
type FallbackState = { reason: XRUnsupportedReason | null } | null;

export function App() {
  const session = useXRSession();
  const api = useApiHealth();
  const [capabilities, setCapabilities] = useState<XRCapabilities | null>(null);
  const [fallback, setFallback] = useState<FallbackState>(null);
  const [arError, setArError] = useState<string | null>(null);
  const [startingAR, setStartingAR] = useState(false);

  useBlockXRSelectOnUI(overlayRoot);

  useEffect(() => {
    let cancelled = false;
    void detectXRCapabilities().then((detected) => {
      if (cancelled) return;
      console.info('[xr] capabilities', detected);
      setCapabilities(detected);
      // No AR on this device (or forced for testing): go straight to the 3D fallback.
      if (isFallbackForced()) {
        setFallback({ reason: 'forced-fallback' });
      } else if (!detected.immersiveAr) {
        setFallback({ reason: detected.unsupportedReason });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const startAR = useCallback(async () => {
    setArError(null);
    setStartingAR(true);
    try {
      await xrStore.enterAR();
    } catch (error) {
      console.error('[xr] enterAR failed', error);
      setArError(describeARStartError(error));
    } finally {
      setStartingAR(false);
    }
  }, []);

  const exitAR = useCallback(() => {
    void xrStore.getState().session?.end();
  }, []);

  const stage = session != null ? 'ar' : fallback != null ? 'fallback3d' : 'start';

  return (
    <>
      <Canvas
        dpr={[1, 1.5]}
        flat
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ fov: 60, near: 0.01, far: 50, position: [0, 1.6, 2.4] }}
      >
        <XR store={xrStore}>
          {stage === 'ar' && <HelloARScene />}
          {stage === 'fallback3d' && <HelloFallbackScene />}
          {stage === 'start' && <HelloPreviewScene />}
        </XR>
      </Canvas>

      {createPortal(
        <>
          {stage === 'ar' && <ARHud onExit={exitAR} />}
          {stage === 'fallback3d' && (
            <FallbackHud
              reason={fallback?.reason != null ? UNSUPPORTED_REASON_TEXT[fallback.reason] : null}
              onExit={() => setFallback(null)}
            />
          )}
          {stage === 'start' && (
            <StartScreen
              capabilities={capabilities}
              api={api}
              arError={arError}
              startingAR={startingAR}
              onStartAR={() => void startAR()}
              onStart3D={() => setFallback({ reason: null })}
            />
          )}
        </>,
        overlayRoot,
      )}
    </>
  );
}
