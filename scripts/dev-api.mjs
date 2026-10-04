#!/usr/bin/env node
/**
 * Runs the FastAPI service with auto-reload on http://127.0.0.1:8000, and keeps any
 * USB-connected phone's localhost:8000 tunnelled to it (`adb reverse`), so the phone apps reach
 * it even after the cable is moved or replugged.
 */
import { spawn } from 'node:child_process';
import { keepReversed } from './lib/adb.mjs';
import { API_DIR, VENV_PYTHON, venvExists } from './python-env.mjs';

const API_PORT = 8000;

if (!venvExists()) {
  console.error('✖ API virtualenv not found. Run `npm run setup:api` first.');
  process.exit(1);
}

// --timeout-graceful-shutdown: without it a reload on Windows can hang forever waiting for the
// phone's keep-alive connections, leaving the old code serving.
const child = spawn(
  VENV_PYTHON,
  [
    '-m',
    'uvicorn',
    'app.main:app',
    '--reload',
    '--timeout-graceful-shutdown',
    '2',
    '--host',
    '127.0.0.1',
    '--port',
    String(API_PORT),
  ],
  { cwd: API_DIR, stdio: 'inherit' },
);
const stopReverse = keepReversed([API_PORT]);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
child.on('exit', (code) => {
  stopReverse();
  process.exit(code ?? 0);
});
