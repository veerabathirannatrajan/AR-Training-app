import type { RenderMode } from '@ar-training/shared';
import { useEffect } from 'react';
import { create } from 'zustand';

export type Route =
  | { name: 'splash' }
  | { name: 'language'; next: 'login' | 'back' }
  | { name: 'login' }
  | { name: 'home' }
  | { name: 'module-intro'; moduleId: string }
  | { name: 'device-check'; moduleId: string }
  | { name: 'training'; moduleId: string; mode: RenderMode };

interface NavigationState {
  stack: Route[];
  navigate: (route: Route) => void;
  /** Replaces the current screen (no new back step). */
  replace: (route: Route) => void;
  /** Starts a fresh history, e.g. after login or logout. */
  reset: (route: Route) => void;
  /** Goes back one screen; returns false at the root. */
  back: () => boolean;
}

export const useNavigation = create<NavigationState>()((set, get) => ({
  stack: [{ name: 'splash' }],
  navigate: (route) => {
    set((state) => ({ stack: [...state.stack, route] }));
    armBackGuard();
  },
  replace: (route) => set((state) => ({ stack: [...state.stack.slice(0, -1), route] })),
  reset: (route) => set({ stack: [route] }),
  back: () => {
    const { stack } = get();
    if (stack.length <= 1) return false;
    set({ stack: stack.slice(0, -1) });
    return true;
  },
}));

export function useCurrentRoute(): Route {
  return useNavigation((state) => state.stack[state.stack.length - 1] ?? { name: 'splash' });
}

// ---------------------------------------------------------------------------
// Android back button / gesture.
// One extra history entry ("guard") sits on top. Pressing back pops it, we handle the back
// inside the app and re-arm the guard. At the root screen we leave it disarmed, so the next
// back press leaves the app as the worker expects.

type BackHandler = () => boolean;
const backHandlers: BackHandler[] = [];
let guardArmed = false;

function armBackGuard() {
  if (guardArmed) return;
  window.history.pushState({ armtGuard: true }, '');
  guardArmed = true;
}

/** Screens can intercept back (e.g. confirm before leaving training). Return true if handled. */
export function useBackHandler(handler: BackHandler): void {
  useEffect(() => {
    backHandlers.push(handler);
    return () => {
      const index = backHandlers.lastIndexOf(handler);
      if (index >= 0) backHandlers.splice(index, 1);
    };
  }, [handler]);
}

export function installBackGuard(): () => void {
  const onPopState = () => {
    guardArmed = false;
    const handler = backHandlers[backHandlers.length - 1];
    const handled = (handler?.() ?? false) || useNavigation.getState().back();
    if (handled) armBackGuard();
  };
  window.addEventListener('popstate', onPopState);
  armBackGuard();
  return () => window.removeEventListener('popstate', onPopState);
}
