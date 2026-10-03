/**
 * Android build helpers shared by `npm run android` (worker app, TWA) and
 * `npm run android:admin` (admin app, Capacitor): toolchain lookup, signing key, APK signing.
 *
 * Env: ARMT_JDK=<JDK 17–23 home> (default: Android Studio's bundled JDK)  ANDROID_HOME=<SDK>
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { platform } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fail, sdkCandidates } from './adb.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
/** One signing key for both apps, created on first use (gitignored; back it up). */
export const KEYS = path.join(ROOT, 'apps', 'android', 'keys');
export const KEYSTORE = path.join(KEYS, 'release.keystore');
const SIGNING = path.join(KEYS, 'signing.json');

export const isWindows = platform() === 'win32';
export const exe = (name) => (isWindows ? `${name}.exe` : name);

export function step(title) {
  console.log(`\n▶ ${title}`);
}

/** Runs a command with live output; exits on failure. `shell` is needed for npm/npx on Windows. */
export function exec(
  command,
  args,
  { cwd = ROOT, env = process.env, shell = false, capture = false } = {},
) {
  const options = {
    cwd,
    env,
    stdio: capture ? ['inherit', 'pipe', 'inherit'] : 'inherit',
    encoding: 'utf8',
  };
  const result = shell
    ? spawnSync([command, ...args].join(' '), { ...options, shell: true })
    : spawnSync(command, args, options);
  if (result.error) fail(`Could not run ${command}: ${result.error.message}`);
  if (result.status !== 0)
    fail(`\`${[command, ...args].join(' ')}\` failed (exit ${result.status}).`);
  return result.stdout ?? '';
}

export function quiet(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  return { ok: result.status === 0, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

/** A JDK that runs the Gradle versions used by Bubblewrap (8.11) and Capacitor (8.14): 17–23. */
export function findJdk() {
  const candidates = [
    process.env.ARMT_JDK,
    isWindows && 'C:\\Program Files\\Android\\Android Studio\\jbr',
    platform() === 'darwin' && '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
    '/opt/android-studio/jbr',
    process.env.JAVA_HOME,
  ].filter(Boolean);
  for (const home of candidates) {
    const java = path.join(home, 'bin', exe('java'));
    if (!existsSync(java)) continue;
    const { output } = quiet(java, ['-version']);
    const major = Number(/version "(\d+)/.exec(output)?.[1]);
    if (major >= 17 && major <= 23) return home;
    console.log(`• Skipping JDK ${major} at ${home} (Gradle needs 17–23)`);
  }
  fail('No suitable JDK (17–23) was found for the Android build.', [
    'Install Android Studio (it bundles JDK 21), or install JDK 21 (e.g. Eclipse Temurin 21).',
    'If it is somewhere else, set ARMT_JDK to its folder (the one containing bin/java).',
  ]);
}

export function findSdk() {
  const home = sdkCandidates().find((dir) => existsSync(path.join(dir, 'build-tools')));
  if (home == null) {
    fail('The Android SDK was not found.', [
      'Install Android Studio and open it once (it installs the SDK), or install the command-line tools.',
      'Set ANDROID_HOME to the SDK folder if it is not in the default place.',
    ]);
  }
  // Newest build-tools that has apksigner.
  const buildTools = readdirSync(path.join(home, 'build-tools'))
    .filter((version) =>
      existsSync(path.join(home, 'build-tools', version, 'lib', 'apksigner.jar')),
    )
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0];
  if (buildTools == null) {
    fail('No Android build-tools found in the SDK.', [
      'Android Studio > Settings > Android SDK > SDK Tools: install "Android SDK Build-Tools".',
    ]);
  }
  return { home, buildTools: path.join(home, 'build-tools', buildTools) };
}

export function ensureSigningKey(jdk, alias) {
  if (existsSync(KEYSTORE) && existsSync(SIGNING)) {
    return JSON.parse(readFileSync(SIGNING, 'utf8'));
  }
  if (existsSync(KEYSTORE)) {
    fail(`${KEYSTORE} exists but ${SIGNING} (its password) is missing.`, [
      'Restore signing.json from your backup, or delete the keystore to create a new key (installed apps must then be uninstalled once).',
    ]);
  }
  step('Creating the app signing key (first run)');
  mkdirSync(KEYS, { recursive: true });
  // PKCS12 keystores use one password for the store and the key.
  const password = randomBytes(24).toString('base64url');
  exec(
    path.join(jdk, 'bin', exe('keytool')),
    [
      '-genkeypair',
      '-keystore',
      KEYSTORE,
      '-storetype',
      'PKCS12',
      '-alias',
      alias,
      '-keyalg',
      'RSA',
      '-keysize',
      '2048',
      '-validity',
      '10000',
      '-storepass:env',
      'ARMT_KEYSTORE_PASSWORD',
      '-dname',
      'CN=AR Mining Training, O=SIH 2026, C=IN',
    ],
    { env: { ...process.env, ARMT_KEYSTORE_PASSWORD: password } },
  );
  const signing = { alias, password };
  writeFileSync(SIGNING, `${JSON.stringify(signing, null, 2)}\n`);
  console.log(
    `• Key saved in ${KEYS} (gitignored). Back this folder up: app updates must be signed with it.`,
  );
  return signing;
}

/** zipalign + apksigner with the release key. */
export function signApk({ jdk, sdk, signing, unsigned, out }) {
  const aligned = unsigned.replace(/\.apk$/, '-aligned.apk');
  exec(path.join(sdk.buildTools, exe('zipalign')), ['-f', '-p', '4', unsigned, aligned]);
  mkdirSync(path.dirname(out), { recursive: true });
  exec(
    path.join(jdk, 'bin', exe('java')),
    [
      '-jar',
      path.join(sdk.buildTools, 'lib', 'apksigner.jar'),
      'sign',
      '--ks',
      KEYSTORE,
      '--ks-key-alias',
      signing.alias,
      '--ks-pass',
      'env:ARMT_KEYSTORE_PASSWORD',
      '--key-pass',
      'env:ARMT_KEYSTORE_PASSWORD',
      '--out',
      out,
      aligned,
    ],
    { env: { ...process.env, ARMT_KEYSTORE_PASSWORD: signing.password } },
  );
}

/** Runs a Gradle task in an Android project with the right JDK and SDK. */
export function gradle(projectDir, task, { jdk, sdk, args = [] }) {
  const env = {
    ...process.env,
    JAVA_HOME: jdk,
    ANDROID_HOME: sdk.home,
    ANDROID_SDK_ROOT: sdk.home,
  };
  // --no-daemon: don't leave a ~1 GB Gradle process running after the build.
  // Absolute path: Windows may be set not to run programs from the current folder.
  exec(
    isWindows ? `"${path.join(projectDir, 'gradlew.bat')}"` : path.join(projectDir, 'gradlew'),
    [task, ...args, '--no-daemon', '--console=plain', '--warning-mode=none'],
    { cwd: projectDir, env, shell: isWindows },
  );
}

/** Always increasing, so `adb install -r` accepts every new build (minutes since 2026-01-01). */
export function versionCode() {
  return Math.floor((Date.now() - Date.UTC(2026, 0, 1)) / 60_000);
}

/** adb install -r, replacing a copy signed with another key if needed. */
export function installApk(adb, apk, packageId) {
  let result = adb(['install', '-r', apk]);
  if (!result.ok && /INSTALL_FAILED_UPDATE_INCOMPATIBLE/.test(result.output)) {
    console.log('• Installed app has a different signing key; uninstalling it first');
    adb(['uninstall', packageId]);
    result = adb(['install', '-r', apk]);
  }
  if (!result.ok) fail('adb install failed.', [result.output]);
  console.log(`• Installed ${path.relative(ROOT, apk)}`);
}
