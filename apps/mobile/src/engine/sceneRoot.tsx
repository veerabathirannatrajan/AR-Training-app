import { useRef, type ReactNode } from 'react';
import type { Group } from 'three';
import { SceneRootContext, useSceneRoot } from './sceneRootContext';

/**
 * The training area's root group. In AR the placement system moves it onto the detected
 * floor (and turns it); in 3D mode it stays at the origin. Module content lives inside it,
 * so modules only ever deal with local coordinates where y = 0 is the floor.
 */
export function SceneRootProvider({ children }: { children: ReactNode }) {
  const ref = useRef<Group>(null);
  return <SceneRootContext.Provider value={ref}>{children}</SceneRootContext.Provider>;
}

export function SceneRootGroup({ children, visible }: { children: ReactNode; visible: boolean }) {
  const rootRef = useSceneRoot();
  return (
    <group ref={rootRef} visible={visible}>
      {children}
    </group>
  );
}
