import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const python = resolve(root, process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');
if (!existsSync(python)) {
  console.error('Primero crea .venv e instala server/requirements.txt. Consulta README.md.');
  process.exit(1);
}
const children = [
  spawn(python, ['-m', 'uvicorn', 'server.app:app', '--host', '127.0.0.1', '--port', '8000', '--ws-max-size', '2048'], { cwd: root, stdio: 'inherit' }),
  spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--config', 'client/vite.config.js', 'client'], { cwd: root, stdio: 'inherit' }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.pid || child.exitCode !== null) continue;
    if (process.platform === 'win32') {
      // The venv launcher owns a second Python process on Windows.
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    } else child.kill();
  }
  process.exitCode = code;
}
for (const child of children) {
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => { if (!stopping) stop(code || 0); });
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
