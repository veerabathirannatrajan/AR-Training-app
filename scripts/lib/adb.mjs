/**
 * Finding adb and the USB-attached phone, shared by `npm run phone` and `npm run android`.
 *
 * Env: ADB=<path to adb>  ANDROID_SERIAL=<device serial when several are attached>
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import path from 'node:path';

export function fail(title, steps = []) {
  console.error(`\n✖ ${title}\n`);
  steps.forEach((step, index) => console.error(`  ${index + 1}. ${step}`));
  console.error('');
  process.exit(1);
}

/** Android SDK folders to look in, most specific first. */
export function sdkCandidates() {
  const candidates = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT].filter(Boolean);
  if (platform() === 'win32' && process.env.LOCALAPPDATA) {
    candidates.push(path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk'));
  }
  if (platform() === 'darwin') candidates.push(path.join(homedir(), 'Library', 'Android', 'sdk'));
  candidates.push(path.join(homedir(), 'Android', 'Sdk'));
  return candidates;
}

function adbCandidates() {
  const exe = platform() === 'win32' ? 'adb.exe' : 'adb';
  const candidates = [];
  if (process.env.ADB) candidates.push(process.env.ADB);
  candidates.push('adb'); // on PATH
  for (const sdkRoot of sdkCandidates()) candidates.push(path.join(sdkRoot, 'platform-tools', exe));
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

export function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
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

/**
 * Finds adb and the one phone to use, or exits with step-by-step fixes.
 * `command` is the npm command to suggest re-running (e.g. "npm run phone").
 * Returns `{ adb(args) → { ok, output }, serial, model, android }`.
 */
export function connectPhone(command) {
  const adbPath = findAdb();
  if (adbPath == null) {
    fail('adb (Android platform-tools) was not found.', [
      'Install "SDK Platform-Tools" from https://developer.android.com/tools/releases/platform-tools (or via Android Studio > SDK Manager).',
      'Either add its folder (e.g. %LOCALAPPDATA%\\Android\\Sdk\\platform-tools) to PATH, or set ADB to the full path of adb.exe.',
      `Open a new terminal and run \`${command}\` again.`,
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
        `Run \`adb kill-server\` and then \`${command}\` again.`,
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
        `Run \`${command}\` again.`,
      ]);
    }
    fail(`Device state is "${candidates[0].state}", not "device".`, [
      'Unplug and replug the USB cable, then run `adb kill-server`.',
      'Make sure USB debugging is still enabled in Developer options.',
      `Run \`${command}\` again.`,
    ]);
  }
  if (ready.length > 1 && !wanted) {
    console.log(
      `• ${ready.length} devices attached; using ${ready[0].serial}. Set ANDROID_SERIAL to pick another.`,
    );
  }

  const serial = ready[0].serial;
  const adb = (args) => run(adbPath, ['-s', serial, ...args]);
  const model = adb(['shell', 'getprop', 'ro.product.model']).output;
  const android = adb(['shell', 'getprop', 'ro.build.version.release']).output;
  console.log(`• Device: ${model} (Android ${android}) [${serial}]`);
  return { adb, serial, model, android };
}

/** `adb reverse` so the phone's localhost:<port> reaches the laptop's. */
export function reversePorts(adb, ports) {
  for (const port of ports) {
    const { ok, output } = adb(['reverse', `tcp:${port}`, `tcp:${port}`]);
    if (!ok) fail(`adb reverse for port ${port} failed`, [output]);
    console.log(`• Reversed phone localhost:${port} → laptop localhost:${port}`);
  }
}

export async function isListening(port) {
  try {
    await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1500) });
    return true;
  } catch {
    return false;
  }
}
