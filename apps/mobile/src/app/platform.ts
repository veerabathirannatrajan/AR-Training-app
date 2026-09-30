import { useRegisterSW } from 'virtual:pwa-register/react';
import { useSyncExternalStore } from 'react';
import { create } from 'zustand';

// ---- Online status ----

function subscribeOnline(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine);
}

// ---- Install as an app ----

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallState {
  promptEvent: BeforeInstallPromptEvent | null;
  installed: boolean;
}

const standaloneQuery = window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)');

export const useInstallStore = create<InstallState>()(() => ({
  promptEvent: null,
  installed: standaloneQuery.matches,
}));

// Chrome fires this early (often before React mounts), so listen at module load.
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  useInstallStore.setState({ promptEvent: event as BeforeInstallPromptEvent });
});
window.addEventListener('appinstalled', () => {
  useInstallStore.setState({ promptEvent: null, installed: true });
});

/** Returns a function that shows Chrome's install dialog, or null when not installable. */
export function useInstallPrompt(): (() => Promise<void>) | null {
  const promptEvent = useInstallStore((state) => state.promptEvent);
  if (promptEvent == null) return null;
  return async () => {
    await promptEvent.prompt();
    await promptEvent.userChoice;
    useInstallStore.setState({ promptEvent: null });
  };
}

export function useIsStandalone(): boolean {
  return useInstallStore((state) => state.installed);
}

// ---- Service worker (offline shell) ----

export interface ServiceWorkerStatus {
  offlineReady: boolean;
  updateReady: boolean;
  applyUpdate: () => void;
}

export function useServiceWorker(): ServiceWorkerStatus {
  const {
    offlineReady: [offlineReady],
    needRefresh: [updateReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: (error: unknown) =>
      console.error('[pwa] service worker registration failed', error),
  });
  // offlineReady only fires on the first install; afterwards a controlling worker means cached.
  const controlled = 'serviceWorker' in navigator && navigator.serviceWorker.controller != null;
  return {
    offlineReady: offlineReady || controlled,
    updateReady,
    applyUpdate: () => void updateServiceWorker(true),
  };
}
