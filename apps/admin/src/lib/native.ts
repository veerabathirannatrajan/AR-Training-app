import { App as NativeApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

/**
 * Admin Android app (Capacitor): the Android back button goes back in the portal's history
 * and leaves the app from the first screen, like any native app.
 */
export function setupNativeApp(): void {
  if (!Capacitor.isNativePlatform()) return;
  document.documentElement.classList.add('native-app');
  void NativeApp.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else void NativeApp.exitApp();
  });
}
