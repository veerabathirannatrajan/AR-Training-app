#!/usr/bin/env node
/** Runs the API's pytest suite inside services/api/.venv. */
import { spawnSync } from 'node:child_process';
import { API_DIR, VENV_PYTHON, venvExists } from './python-env.mjs';

if (!venvExists()) {
  console.error('✖ API virtualenv not found. Run `npm run setup:api` first.');
  process.exit(1);
}
const result = spawnSync(VENV_PYTHON, ['-m', 'pytest', ...process.argv.slice(2)], {
  cwd: API_DIR,
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
