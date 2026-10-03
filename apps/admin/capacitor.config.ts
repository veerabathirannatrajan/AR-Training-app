import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Admin Android app: the portal build (dist/) is packaged inside the APK and shown in a native
 * WebView, so it runs as its own app (not in Chrome) and opens without the laptop's web server.
 * It talks to the API at http://localhost:8000 (adb reverse to the laptop, or another address
 * set on the login screen), so the app is served from http://localhost and allows cleartext.
 */
const config: CapacitorConfig = {
  appId: 'com.armining.admin',
  appName: 'AR Training Admin',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
    hostname: 'localhost',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#f6f7f9',
  },
};

export default config;
