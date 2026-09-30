import { Canvas } from '@react-three/fiber';
import { XR } from '@react-three/xr';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { installBackGuard, useCurrentRoute, type Route } from './app/navigation';
import { TrainingWorld } from './engine/TrainingWorld';
import { useRunnerStore } from './engine/runner/runnerStore';
import { useBlockXRSelectOnUI } from './engine/xr/xrUi';
import { useXRSession } from './engine/xr/useXRSession';
import { xrStore } from './engine/xr/xrStore';
import { overlayRoot } from './lib/overlayRoot';
import { findModule } from './modules/registry';
import { DeviceCheckScreen } from './screens/DeviceCheckScreen';
import { DrillScreen } from './screens/DrillScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LanguageScreen } from './screens/LanguageScreen';
import { LoginScreen } from './screens/LoginScreen';
import { ModuleIntroScreen } from './screens/ModuleIntroScreen';
import { SplashScreen } from './screens/SplashScreen';
import { TrainingScreen } from './screens/TrainingScreen';

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case 'splash':
      return <SplashScreen />;
    case 'language':
      return <LanguageScreen next={route.next} />;
    case 'login':
      return <LoginScreen />;
    case 'home':
      return <HomeScreen />;
    case 'module-intro':
      return <ModuleIntroScreen moduleId={route.moduleId} />;
    case 'device-check':
      return <DeviceCheckScreen moduleId={route.moduleId} />;
    case 'training':
      return <TrainingScreen moduleId={route.moduleId} mode={route.mode} />;
    case 'drill':
      return <DrillScreen drillId={route.drillId} />;
  }
}

/**
 * One canvas for the whole app, always mounted, so an AR session can be started straight
 * from a button tap. It only renders while a training module is open.
 */
function Stage({ route }: { route: Route }) {
  const sessionId = useRunnerStore((state) => state.sessionId);
  const training = route.name === 'training' ? route : null;
  const definition = training != null ? findModule(training.moduleId) : undefined;

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
            <definition.Scene />
          </TrainingWorld>
        )}
      </XR>
    </Canvas>
  );
}

export function App() {
  const route = useCurrentRoute();
  const xrSession = useXRSession();

  useBlockXRSelectOnUI(overlayRoot);
  useEffect(() => installBackGuard(), []);
  useEffect(() => {
    overlayRoot.classList.toggle('in-ar', xrSession != null);
  }, [xrSession]);

  return (
    <>
      <Stage route={route} />
      {createPortal(<Screen route={route} />, overlayRoot)}
    </>
  );
}
