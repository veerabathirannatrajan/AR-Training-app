import { Canvas } from '@react-three/fiber';
import { XR } from '@react-three/xr';
import { Suspense, useEffect } from 'react';
import type { Route } from '../app/navigation';
import { overlayRoot } from '../lib/overlayRoot';
import { findModule } from '../modules/registry';
import { useRunnerStore } from './runner/runnerStore';
import { useStageStatus } from './stageStatus';
import { TrainingWorld } from './TrainingWorld';
import { useXRSession } from './xr/useXRSession';
import { xrStore } from './xr/xrStore';

/**
 * One canvas for the whole app, always mounted (once this chunk has loaded), so an AR session
 * can be started straight from a button tap. It only renders while a training module is open.
 */
export default function Stage({ route }: { route: Route }) {
  const sessionId = useRunnerStore((state) => state.sessionId);
  const xrSession = useXRSession();
  const training = route.name === 'training' ? route : null;
  const definition = training != null ? findModule(training.moduleId) : undefined;

  useEffect(() => {
    useStageStatus.setState({ ready: true });
    return () => useStageStatus.setState({ ready: false });
  }, []);
  useEffect(() => {
    overlayRoot.classList.toggle('in-ar', xrSession != null);
  }, [xrSession]);

  return (
    <Canvas
      frameloop={training != null ? 'always' : 'never'}
      dpr={[1, 1.5]}
      flat
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ fov: 60, near: 0.01, far: 60, position: [0, 1.6, 2.4] }}
    >
      <XR store={xrStore}>
        {training != null && definition != null && sessionId != null && (
          <TrainingWorld
            key={`${training.mode}:${sessionId}`}
            mode={training.mode}
            fallbackView={definition.fallbackView}
          >
            {/* Scenes are their own chunks, preloaded with the engine (see stageStatus). */}
            <Suspense fallback={null}>
              <definition.Scene />
            </Suspense>
          </TrainingWorld>
        )}
      </XR>
    </Canvas>
  );
}
