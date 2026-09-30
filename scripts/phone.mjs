#!/usr/bin/env node
/**
 * Connects the USB-attached Android phone to the laptop's dev servers with `adb reverse`,
 * so Chrome on the phone can open http://localhost:5173. localhost is a secure context,
 * which WebXR requires, and Vite hot reload keeps working through the tunnel.
 *
 *   npm run phone          reverse ports and open the app in Chrome on the phone
 *   npm run phone:reverse  reverse ports only
 *
 * Env: ADB=<path to adb>  ANDROID_SERIAL=<device serial when several are attached>
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import path from 'node:path';

const APP_PORT = 5173;
const API_PORT = 8000;
const APP_URL = `http://localhost:${APP_PORT}`;
const shouldOpen = process.argv.includes('--open');

function fail(title, steps) {
  console.error(`\n✖ ${title}\n`);
  steps.forEach((step, index) => console.error(`  ${index + 1}. ${step}`));
  console.error('');
  process.exit(1);
}

function adbCandidates() {
  const exe = platform() === 'win32' ? 'adb.exe' : 'adb';
  const candidates = [];
  if (process.env.ADB) candidates.push(process.env.ADB);
  candidates.push('adb'); // on PATH
  for (const sdkRoot of [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT]) {
    if (sdkRoot) candidates.push(path.join(sdkRoot, 'platform-tools', exe));
  }
  if (platform() === 'win32' && process.env.LOCALAPPDATA) {
    candidates.push(path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', exe));
  }
  if (platform() === 'darwin') {
    candidates.push(path.join(homedir(), 'Library', 'Android', 'sdk', 'platform-tools', exe));
  }
  candidates.push(path.join(homedir(), 'Android', 'Sdk', 'platform-tools', exe));
  return candidates;
}

function findAdb() {
  for (const candidate of adbCandidates()) {
    if (candidate !== 'adb' && !existsSync(candidate)) continue;
    const result = spawnSync(candidate, ['version'], { encoding: 'utf8' });
    if (result.status === 0) return candidate;
  }
  return null;
}

function run(adbPath, args) {
  const result = spawnSync(adbPath, args, { encoding: 'utf8' });
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim(),
  };
}

function listDevices(adbPath) {
  const { ok, output } = run(adbPath, ['devices']);
  if (!ok) fail('`adb devices` failed', [output || 'Run `adb kill-server` and try again.']);
  return output
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith('List of devices') && !line.startsWith('*'))
    .map((line) => {
      const [serial, state] = line.trim().split(/\s+/);
      return { serial, state };
    });
}

async function isListening(port) {
  try {
    await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1500) });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------

const adbPath = findAdb();
if (adbPath == null) {
  fail('adb (Android platform-tools) was not found.', [
    'Install "SDK Platform-Tools" from https://developer.android.com/tools/releases/platform-tools (or via Android Studio > SDK Manager).',
    'Either add its folder (e.g. %LOCALAPPDATA%\\Android\\Sdk\\platform-tools) to PATH, or set ADB to the full path of adb.exe.',
    'Open a new terminal and run `npm run phone` again.',
  ]);
}
console.log(`• adb: ${adbPath}`);

const devices = listDevices(adbPath);
const wanted = process.env.ANDROID_SERIAL;
const candidates = wanted ? devices.filter((d) => d.serial === wanted) : devices;

if (candidates.length === 0) {
  fail(
    wanted
      ? `Device ${wanted} (ANDROID_SERIAL) is not connected.`
      : 'No Android device is connected.',
    [
      'Connect the phone with a USB cable that supports data (not a charge-only cable).',
      'On the phone: Settings > About phone > tap "MIUI/OS version" or "Build number" 7 times to enable Developer options.',
      'Settings > Additional settings > Developer options: turn on "USB debugging".',
      'Pull down the notification shade and set the USB mode to "File transfer".',
      'Unlock the phone and accept the "Allow USB debugging?" prompt (tick "Always allow").',
      'Run `adb kill-server` and then `npm run phone` again.',
    ],
  );
}

const unauthorized = candidates.find((d) => d.state === 'unauthorized');
const ready = candidates.filter((d) => d.state === 'device');
if (ready.length === 0) {
  if (unauthorized) {
    fail(`Device ${unauthorized.serial} is connected but not authorised.`, [
      'Unlock the phone and accept the "Allow USB debugging?" prompt (tick "Always allow from this computer").',
      'If no prompt appears: Developer options > "Revoke USB debugging authorisations", then unplug and replug the cable.',
      'Run `npm run phone` again.',
    ]);
  }
  fail(`Device state is "${candidates[0].state}", not "device".`, [
    'Unplug and replug the USB cable, then run `adb kill-server`.',
    'Make sure USB debugging is still enabled in Developer options.',
    'Run `npm run phone` again.',
  ]);
}
if (ready.length > 1 && !wanted) {
  console.log(
    `• ${ready.length} devices attached; using ${ready[0].serial}. Set ANDROID_SERIAL to pick another.`,
  );
}

const serial = ready[0].serial;
const model = run(adbPath, ['-s', serial, 'shell', 'getprop', 'ro.product.model']).output;
const android = run(adbPath, ['-s', serial, 'shell', 'getprop', 'ro.build.version.release']).output;
console.log(`• Device: ${model} (Android ${android}) [${serial}]`);

for (const port of [APP_PORT, API_PORT]) {
  const { ok, output } = run(adbPath, ['-s', serial, 'reverse', `tcp:${port}`, `tcp:${port}`]);
  if (!ok) fail(`adb reverse for port ${port} failed`, [output]);
  console.log(`• Reversed phone localhost:${port} → laptop localhost:${port}`);
}

const [appUp, apiUp] = await Promise.all([isListening(APP_PORT), isListening(API_PORT)]);
if (!appUp) {
  console.warn(
    `! Mobile dev server is not running on :${APP_PORT}. Start it with \`npm run dev\`.`,
  );
}
if (!apiUp) {
  console.warn(
    `! API is not running on :${API_PORT}. Start it with \`npm run dev:api\` (optional for AR tests).`,
  );
}

if (shouldOpen) {
  const { ok, output } = run(adbPath, [
    '-s',
    serial,
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
  Re-run \`npm run phone\` whenever the cable is reconnected.
`);
