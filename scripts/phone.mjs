#!/usr/bin/env node
/**
 * Connects the USB-attached Android phone to the laptop's dev servers with `adb reverse`,
 * so Chrome on the phone can open http://localhost:5173. localhost is a secure context,
 * which WebXR requires, and Vite hot reload keeps working through the tunnel.
 *
 *   npm run phone          reverse ports and open the dev app (hot reload) in Chrome
 *   npm run phone:reverse  reverse ports only
 *   npm run phone:app      same for the installable production build (`npm run app`, :4173)
 *
 * Env: ADB=<path to adb>  ANDROID_SERIAL=<device serial when several are attached>
 */
import { connectPhone, isListening, reversePorts } from './lib/adb.mjs';

const INSTALLABLE = process.argv.includes('--app');
const APP_PORT = INSTALLABLE ? 4173 : 5173;
const API_PORT = 8000;
const APP_URL = `http://localhost:${APP_PORT}`;
const shouldOpen = process.argv.includes('--open');

const { adb } = connectPhone('npm run phone');
reversePorts(adb, [APP_PORT, API_PORT]);

const [appUp, apiUp] = await Promise.all([isListening(APP_PORT), isListening(API_PORT)]);
if (!appUp) {
  const command = INSTALLABLE ? 'npm run app' : 'npm run dev';
  console.warn(`! The app is not being served on :${APP_PORT}. Start it with \`${command}\`.`);
}
if (!apiUp) {
  console.warn(
    `! API is not running on :${API_PORT}. Start it with \`npm run dev:api\` (optional for AR tests).`,
  );
}

if (shouldOpen) {
  const { ok, output } = adb([
    'shell',
    'am',
    'start',
    '-a',
    'android.intent.action.VIEW',
    '-d',
    APP_URL,
    'com.android.chrome',
  ]);
  if (!ok || /error/i.test(output)) {
    console.warn(
      `! Could not open Chrome automatically (${output}). Open ${APP_URL} in Chrome on the phone.`,
    );
  } else {
    console.log(`• Opened ${APP_URL} in Chrome on the phone`);
  }
}

console.log(`
✔ Phone ready. In Chrome on the phone open: ${APP_URL}
  Console logs: open chrome://inspect/#devices in Chrome on this laptop and click "inspect" under localhost:${APP_PORT}.
  Re-run this command whenever the cable is reconnected.`);
if (INSTALLABLE) {
  console.log(`  Install it as an app: Chrome menu (⋮) → "Install app" (or the in-app "Install app" button).
  After the first login it opens from the home screen and works offline, without the laptop.`);
}
console.log('');
