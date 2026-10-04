#!/usr/bin/env node
/**
 * Builds the admin portal as its own Android app and puts it on the USB-attached phone:
 *
 *   npm run android:admin                 build portal → Capacitor sync → signed APK → install
 *   npm run android:admin -- --no-install build apps/android/dist/ar-training-admin.apk only
 *
 * Unlike the worker app (a Trusted Web Activity that runs in Chrome because WebXR needs it), the
 * admin app is a Capacitor app: the portal is packaged inside the APK and runs in a native
 * WebView, so it opens as "AR Training Admin" with no browser at all. It talks to the hosted API
 * (services/api/vercel/deployment.json, from `npm run deploy:api`), or without one to this
 * laptop's API at http://localhost:8000 through `adb reverse`. The address can be changed on its
 * login screen. It is signed with the same release key as the worker app.
 *
 * Env: ARMT_JDK, ANDROID_HOME, ADB, ANDROID_SERIAL (see scripts/lib/*.mjs)
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { connectPhone, fail, isListening, reversePorts } from './lib/adb.mjs';
import {
  ensureSigningKey,
  exec,
  findJdk,
  findSdk,
  gradle,
  installApk,
  ROOT,
  signApk,
  step,
  versionCode,
} from './lib/android-build.mjs';
import { hostedApiUrl } from './lib/vercel.mjs';

const ADMIN = path.join(ROOT, 'apps', 'admin');
const PROJECT = path.join(ADMIN, 'android');
const APK = path.join(ROOT, 'apps', 'android', 'dist', 'ar-training-admin.apk');
const PACKAGE_ID = 'com.armining.admin';
const KEY_ALIAS = 'armt';
const API_PORT = 8000;
const LOCAL_API = `http://localhost:${API_PORT}`;
const HOSTED_SECRETS = path.join(ROOT, 'services', 'api', 'keys', 'hosted.json');

const install = !process.argv.includes('--no-install');
const version = JSON.parse(readFileSync(path.join(ADMIN, 'package.json'), 'utf8')).version;

const jdk = findJdk();
const sdk = findSdk();
console.log(
  `• JDK: ${jdk}\n• Android SDK: ${sdk.home} (build-tools ${path.basename(sdk.buildTools)})`,
);
const signing = ensureSigningKey(jdk, KEY_ALIAS);

const apiUrl = hostedApiUrl() ?? LOCAL_API;
step(`Building the admin portal (API: ${apiUrl})`);
exec('npm', ['run', 'build', '-w', '@ar-training/admin'], {
  shell: true,
  env: { ...process.env, VITE_API_BASE_URL: apiUrl },
});

step('Copying it into the Android project (Capacitor sync)');
exec('npx', ['cap', 'sync', 'android'], { cwd: ADMIN, shell: true });

const code = versionCode();
step(`Building and signing the APK (version ${version}, code ${code})`);
gradle(PROJECT, 'assembleRelease', {
  jdk,
  sdk,
  args: [`-PversionCode=${code}`, `-PversionName=${version}`],
});
signApk({
  jdk,
  sdk,
  signing,
  unsigned: path.join(
    PROJECT,
    'app',
    'build',
    'outputs',
    'apk',
    'release',
    'app-release-unsigned.apk',
  ),
  out: APK,
});
console.log(`• Signed APK: ${path.relative(ROOT, APK)}`);

if (install) {
  step('Installing on the phone');
  const { adb } = connectPhone('npm run android:admin');
  installApk(adb, APK, PACKAGE_ID);
  // Without a hosted API the portal's API runs on this laptop, reached as http://localhost:8000.
  if (apiUrl === LOCAL_API) reversePorts(adb, [API_PORT]);
  adb(['shell', 'am', 'force-stop', PACKAGE_ID]);
  const launch = adb(['shell', 'am', 'start', '-n', `${PACKAGE_ID}/.MainActivity`]);
  if (!launch.ok || /Error/.test(launch.output)) fail('Could not start the app.', [launch.output]);
  console.log('• Started "AR Training Admin" on the phone');
  if (apiUrl === LOCAL_API && !(await isListening(API_PORT))) {
    console.warn('! The API is not running: start it with `npm run dev:api` on this laptop.');
  }
}

function adminSignIn() {
  if (apiUrl === LOCAL_API) {
    return 'admin@test.com / admin1234 while `npm run dev:api` runs on this laptop';
  }
  if (!existsSync(HOSTED_SECRETS)) return `the admin account of ${apiUrl}`;
  const { adminEmail, adminPassword } = JSON.parse(readFileSync(HOSTED_SECRETS, 'utf8'));
  return `${adminEmail} / ${adminPassword}`;
}

console.log(
  install
    ? `
✔ Done. "AR Training Admin" is in the phone's app drawer (its own app, no browser).
  Sign in with ${adminSignIn()}.
`
    : `
✔ Done. Install it with: adb install -r ${path.relative(ROOT, APK)}
`,
);
