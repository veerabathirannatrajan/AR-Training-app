import { useSyncExternalStore } from 'react';
import { xrStore } from './xrStore';

const getSession = () => xrStore.getState().session;

/** Current WebXR session (or undefined), usable outside the <Canvas>. */
export function useXRSession(): XRSession | undefined {
  return useSyncExternalStore(xrStore.subscribe, getSession);
}
