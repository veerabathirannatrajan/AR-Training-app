import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { platform } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const API_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'services',
  'api',
);
export const VENV_DIR = path.join(API_DIR, '.venv');
export const VENV_PYTHON =
  platform() === 'win32'
    ? path.join(VENV_DIR, 'Scripts', 'python.exe')
    : path.join(VENV_DIR, 'bin', 'python');

export const MIN_PYTHON = [3, 11];

/** Finds a system Python >= 3.11 to create the virtualenv with. Returns [command, ...args]. */
export function findSystemPython() {
  const candidates =
    platform() === 'win32' ? [['py', '-3'], ['python'], ['python3']] : [['python3'], ['python']];
  for (const [command, ...args] of candidates) {
    const result = spawnSync(
      command,
      [...args, '-c', 'import sys; print(f"{sys.version_info[0]}.{sys.version_info[1]}")'],
      { encoding: 'utf8' },
    );
    if (result.status !== 0) continue;
    const [major, minor] = result.stdout.trim().split('.').map(Number);
    if (major > MIN_PYTHON[0] || (major === MIN_PYTHON[0] && minor >= MIN_PYTHON[1])) {
      return [command, ...args];
    }
  }
  return null;
}

export function venvExists() {
  return existsSync(VENV_PYTHON);
}
