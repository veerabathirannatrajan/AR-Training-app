#!/usr/bin/env node
/** Creates services/api/.venv and installs the API's Python dependencies. */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import {
  API_DIR,
  MIN_PYTHON,
  VENV_DIR,
  VENV_PYTHON,
  findSystemPython,
  venvExists,
} from './python-env.mjs';

function step(command, args) {
  console.log(`> ${[command, ...args].join(' ')}`);
  const result = spawnSync(command, args, { cwd: API_DIR, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!venvExists()) {
  const python = findSystemPython();
  if (python == null) {
    console.error(
      `✖ Python ${MIN_PYTHON.join('.')}+ was not found. Install it from https://www.python.org/downloads/ and re-run.`,
    );
    process.exit(1);
  }
  const [command, ...args] = python;
  step(command, [...args, '-m', 'venv', VENV_DIR]);
}

step(VENV_PYTHON, [
  '-m',
  'pip',
  'install',
  '--disable-pip-version-check',
  '-r',
  // Runtime + test dependencies (the hosted API installs only requirements.txt).
  path.join(API_DIR, 'requirements-dev.txt'),
]);
console.log('\n✔ API environment ready. Start it with `npm run dev:api`.');
