/**
 * Vercel CLI helpers shared by `npm run android` (worker web app) and `npm run deploy:api`
 * (hosted API), plus where the hosted API's address is recorded.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fail } from './adb.mjs';
import { ROOT } from './android-build.mjs';

const VERCEL = 'vercel@62';
// Keep the CLI's update check (and its noisy worker-timeout errors) out of script output.
const ENV = { ...process.env, NO_UPDATE_NOTIFIER: '1', VERCEL_TELEMETRY_DISABLED: '1' };

/**
 * The hosted API's production address, written by `npm run deploy:api` (commit it). The worker
 * and admin app builds for the phone point at it.
 */
export const HOSTED_API_FILE = path.join(ROOT, 'services', 'api', 'vercel', 'deployment.json');

export function hostedApiUrl() {
  if (!existsSync(HOSTED_API_FILE)) return null;
  const { url } = JSON.parse(readFileSync(HOSTED_API_FILE, 'utf8'));
  return typeof url === 'string' && url.startsWith('https://') ? url : null;
}

export function writeHostedApiUrl(url) {
  writeFileSync(HOSTED_API_FILE, `${JSON.stringify({ url }, null, 2)}\n`);
}

/**
 * Runs the Vercel CLI in `cwd`. Output streams live unless `capture` (stdout returned) or
 * `allowFail` (returns { ok, output } instead of exiting). `input` is sent on stdin (secrets
 * go there, never on the command line).
 */
export function vercel(args, { cwd, capture = false, allowFail = false, input } = {}) {
  const result = spawnSync(`npx --yes ${VERCEL} ${args.join(' ')}`, {
    cwd,
    env: ENV,
    shell: true,
    encoding: 'utf8',
    input,
    stdio: [
      input == null ? 'inherit' : 'pipe',
      capture || allowFail ? 'pipe' : 'inherit',
      allowFail ? 'pipe' : 'inherit',
    ],
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (allowFail) return { ok: result.status === 0, output };
  if (result.status !== 0) {
    fail(`\`vercel ${args.join(' ')}\` failed (exit ${result.status}).`, [output.trim()]);
  }
  return result.stdout ?? '';
}

export function ensureVercelLogin(cwd, command) {
  if (!vercel(['whoami'], { cwd, allowFail: true }).ok) {
    fail('Not logged in to Vercel.', [
      'Run `npx vercel login` and approve the login in your browser.',
      `Run \`${command}\` again.`,
    ]);
  }
}

/** `vercel deploy --prod` with JSON output; returns the parsed deployment. */
export function deployProduction(cwd, extraArgs = []) {
  const stdout = vercel(['deploy', '--prod', '--yes', '--format', 'json', ...extraArgs], {
    cwd,
    capture: true,
  });
  try {
    return JSON.parse(stdout.slice(stdout.indexOf('{')));
  } catch {
    return fail('Could not read the Vercel deploy result.', [stdout.trim()]);
  }
}

/** The stable production domain of a deployment (apps are tied to it, not to one deploy). */
export function productionHost(deployment, project) {
  const aliases = [deployment.alias, deployment.aliases, deployment.deployment?.alias]
    .flat()
    .filter((alias) => typeof alias === 'string')
    .map((alias) => alias.replace(/^https?:\/\//, ''));
  return (
    aliases.find((alias) => alias === `${project}.vercel.app`) ??
    aliases.find((alias) => alias.startsWith(`${project}-`) && alias.endsWith('.vercel.app')) ??
    aliases.find((alias) => alias.endsWith('.vercel.app')) ??
    `${project}.vercel.app`
  );
}
