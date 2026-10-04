import { lazy, Suspense, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { installBackGuard, useCurrentRoute, type Route } from './app/navigation';
import { useOrientationLock, type OrientationNeed } from './app/orientation';
import { startSyncEngine } from './data/sync';
import { preloadEngine } from './engine/stageStatus';
import { useBlockXRSelectOnUI } from './engine/xr/xrUi';
import { overlayRoot } from './lib/overlayRoot';
import { findModule } from './modules/registry';
import { CertificateScreen } from './screens/CertificateScreen';
import { CertificatesScreen } from './screens/CertificatesScreen';
import { DrillScreen } from './screens/DrillScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LanguageScreen } from './screens/LanguageScreen';
import { LoginScreen } from './screens/LoginScreen';
import { ModuleIntroScreen } from './screens/ModuleIntroScreen';
import { SplashScreen } from './screens/SplashScreen';
import { VerifyScreen } from './screens/VerifyScreen';

// The training engine (three.js, WebXR, module scenes: most of the app's code) is split out so
// the first screen opens fast; it loads in the background straight after (preloadEngine).
const Stage = lazy(() => import('./engine/Stage'));
const DeviceCheckScreen = lazy(() =>
  import('./screens/DeviceCheckScreen').then((module) => ({ default: module.DeviceCheckScreen })),
);
const TrainingScreen = lazy(() =>
  import('./screens/TrainingScreen').then((module) => ({ default: module.TrainingScreen })),
);

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
    case 'certificates':
      return <CertificatesScreen />;
    case 'certificate':
      return <CertificateScreen certificateId={route.certificateId} />;
    case 'verify':
      return <VerifyScreen {...(route.payload != null ? { payload: route.payload } : {})} />;
  }
}

/** App screens are portrait; a module chooses its orientation from the device check on. */
function orientationFor(route: Route): OrientationNeed {
  if (route.name !== 'device-check' && route.name !== 'training') return 'portrait';
  return findModule(route.moduleId)?.orientation ?? 'portrait';
}

export function App() {
  const route = useCurrentRoute();

  useOrientationLock(orientationFor(route));
  useBlockXRSelectOnUI(overlayRoot);
  useEffect(() => installBackGuard(), []);
  useEffect(() => startSyncEngine(), []);
  useEffect(() => preloadEngine(), []);

  return (
    <>
      <Suspense fallback={null}>
        <Stage route={route} />
      </Suspense>
      {createPortal(
        <Suspense fallback={<main className="screen" aria-busy="true" />}>
          <Screen route={route} />
        </Suspense>,
        overlayRoot,
      )}
    </>
  );
}
