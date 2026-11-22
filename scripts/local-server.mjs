import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, realpath, rename, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

// The launcher gives permission to start only after this process joins its job.
let command = '';
for await (const chunk of process.stdin) command += chunk;
command = command.trim();
if (command !== 'start' && command !== 'reset-demo') process.exit(0);

const env = {
  ...process.env,
  NO_PROXY: [process.env.NO_PROXY, 'localhost', '127.0.0.1', '[::1]'].filter(Boolean).join(','),
  NODE_ENV: 'development',
  DATABASE_URL: '',
  OLIMPIK_DATA_DIR: resolve('data/local-lms'),
  OLIMPIK_DEMO_LOGIN: 'true',
  OLIMPIK_SECURE_COOKIES: 'false',
  OLIMPIK_SITE_URL: 'http://127.0.0.1:3000',
  NEXT_TELEMETRY_DISABLED: '1',
};

function run(executable, args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(executable, args, { env, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolveRun();
      else reject(new Error(`${args.join(' ')} (${signal ?? code})`));
    });
  });
}

try {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Требуется Node.js 22 или новее.');
  const next = resolve('node_modules/next/dist/bin/next');
  const stamp = 'node_modules/.olimpik-lock';
  const hash = createHash('sha256').update(await readFile('package-lock.json')).digest('hex');
  const installedHash = existsSync(stamp) ? await readFile(stamp, 'utf8') : '';
  if (!existsSync(next) || installedHash !== hash) {
    console.log('Устанавливаю зависимости из package-lock.json…');
    await run('cmd.exe', ['/d', '/c', 'npm ci --prefer-offline --no-audit --no-fund']);
    await writeFile(stamp, hash);
  }

  if (command === 'reset-demo' && existsSync(env.OLIMPIK_DATA_DIR)) {
    const root = await realpath('.');
    const dataDir = resolve(root, 'data/local-lms');
    if (await realpath(env.OLIMPIK_DATA_DIR) !== dataDir) {
      throw new Error('Для сброса нужна локальная демо-база в data/local-lms без перенаправления.');
    }
    const backup = resolve(dirname(dataDir), 'local-lms-backup-' + randomUUID());
    await rename(dataDir, backup);
    console.log('Предыдущая демо-база сохранена в ' + relative(root, backup));
  }

  console.log('Готовлю локальную базу PGlite в data/local-lms…');
  await run(process.execPath, [resolve('scripts/manage.mjs'), 'local-demo']);
  await run(process.execPath, [next, 'dev', '--hostname', '127.0.0.1', '--port', '3000']);
} catch (error) {
  console.error(`Ошибка локального запуска. ${error.message}`);
  process.exitCode = 1;
}
