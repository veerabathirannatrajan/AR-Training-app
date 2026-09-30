import { createContext, useContext, type RefObject } from 'react';
import type { Group } from 'three';

export const SceneRootContext = createContext<RefObject<Group> | null>(null);

/** Ref to the training area's root group (see SceneRootProvider). */
export function useSceneRoot(): RefObject<Group> {
  const ref = useContext(SceneRootContext);
  if (ref == null) throw new Error('useSceneRoot must be used inside <SceneRootProvider>');
  return ref;
}
