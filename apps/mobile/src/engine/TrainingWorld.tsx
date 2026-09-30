import type { RenderMode } from '@ar-training/shared';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, type ReactNode } from 'react';
import { AimSystem } from './AimSystem';
import { ARPlacement } from './ARPlacement';
import { useEngineStore } from './engineStore';
import { useRunnerStore } from './runner/runnerStore';
import { FallbackEnvironment } from './fallback/FallbackEnvironment';
import type { FallbackView } from './fallback/view';
import { HeightTracker } from './HeightTracker';
import { InputRouter } from './InputRouter';
import { InteractionProvider } from './InteractionProvider';
import { SceneLights } from './primitives/SceneLights';
import { SceneRootGroup, SceneRootProvider } from './sceneRoot';

const DEBUG = new URLSearchParams(window.location.search).has('debug');

/**
 * `?debug`: logs frame rate, draw calls and triangles (budget: < 60k triangles), and exposes
 * the R3F state plus engine/runner stores on `window.__armtDebug` for on-device inspection
 * (chrome://inspect) and automated flow tests.
 */
function DebugProbe() {
  const get = useThree((state) => state.get);
  const frames = useRef(0);
  const elapsed = useRef(0);

  useEffect(() => {
    const target = window as unknown as Record<string, unknown>;
    target.__armtDebug = { get, engine: useEngineStore, runner: useRunnerStore };
    return () => {
      delete target.__armtDebug;
    };
  }, [get]);

  useFrame(({ gl }, delta) => {
    frames.current += 1;
    elapsed.current += delta;
    if (elapsed.current < 2) return;
    const { calls, triangles } = gl.info.render;
    console.info(
      `[perf] ${Math.round(frames.current / elapsed.current)} fps · ${calls} draw calls · ${triangles} triangles`,
    );
    frames.current = 0;
    elapsed.current = 0;
  });
  return null;
}

/**
 * The AR engine inside the Canvas: placement (AR) or the 3D room (fallback), the training
 * area root, input, aiming and height tracking. Module content goes in as children and is
 * identical in both modes.
 */
export function TrainingWorld({
  mode,
  fallbackView,
  children,
}: {
  mode: RenderMode;
  fallbackView?: FallbackView | undefined;
  children: ReactNode;
}) {
  const placed = useEngineStore((state) => state.placement === 'placed');
  return (
    <InteractionProvider>
      <SceneRootProvider>
        <SceneLights />
        {mode === 'ar' ? (
          <ARPlacement />
        ) : (
          <FallbackEnvironment {...(fallbackView != null ? { view: fallbackView } : {})} />
        )}
        <SceneRootGroup visible={placed}>{children}</SceneRootGroup>
        <InputRouter />
        <AimSystem />
        <HeightTracker />
        {DEBUG && <DebugProbe />}
      </SceneRootProvider>
    </InteractionProvider>
  );
}
