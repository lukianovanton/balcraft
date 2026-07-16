import { execFile } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { ProgressReporter } from '../types.js';
import { LauncherPaths } from '../paths.js';
import { detectPlatform } from '../util/platform.js';
import { downloadFile } from '../util/download.js';
import { ensureDir, pathExists } from '../util/fsx.js';

const NEOFORGE_MAVEN = 'https://maven.neoforged.net/releases/net/neoforged/neoforge';

export interface ServerInstall {
  /** Absolute path to the NeoForge args file (win_args.txt / unix_args.txt). */
  argsFile: string;
  /** Directory the server runs in. */
  serverDir: string;
}

/**
 * Install a NeoForge dedicated server into `serverDir` via the official
 * installer's `--install-server` mode, and locate the generated args file used
 * to launch it (`java @user_jvm_args.txt @<args file> nogui`).
 */
export async function installNeoForgeServer(
  paths: LauncherPaths,
  javaPath: string,
  neoforgeVersion: string,
  serverDir: string,
  report?: ProgressReporter,
  signal?: AbortSignal,
): Promise<ServerInstall> {
  await ensureDir(serverDir);
  const plat = detectPlatform();
  const argsFileName = plat.os === 'windows' ? 'win_args.txt' : 'unix_args.txt';
  const expectedArgs = join(
    serverDir,
    'libraries',
    'net',
    'neoforged',
    'neoforge',
    neoforgeVersion,
    argsFileName,
  );

  if (await pathExists(expectedArgs)) {
    return { argsFile: expectedArgs, serverDir };
  }

  report?.({ taskId: 'server:install', phase: 'Скачивание установщика NeoForge', progress: null });
  const installerName = `neoforge-${neoforgeVersion}-installer.jar`;
  const installerPath = join(paths.meta, installerName);
  await downloadFile({
    urls: [`${NEOFORGE_MAVEN}/${neoforgeVersion}/${installerName}`],
    dest: installerPath,
    signal,
  });

  report?.({ taskId: 'server:install', phase: 'Установка сервера NeoForge…', progress: null });
  await new Promise<void>((resolve, reject) => {
    const child = execFile(
      javaPath.replace(/javaw\.exe$/i, 'java.exe'),
      ['-Djava.awt.headless=true', '-jar', installerPath, '--install-server', serverDir],
      { cwd: serverDir, maxBuffer: 64 * 1024 * 1024 },
      (err) => (err ? reject(new Error(`Установка сервера не удалась: ${err.message}`)) : resolve()),
    );
    child.stdout?.on('data', (d: Buffer) =>
      d
        .toString()
        .split('\n')
        .filter(Boolean)
        .forEach((l) => report?.({ taskId: 'server:install', phase: 'Установка сервера', progress: null, detail: l.trimEnd() })),
    );
  });

  if (!(await pathExists(expectedArgs))) {
    const found = await findArgsFile(serverDir, argsFileName);
    if (found) return { argsFile: found, serverDir };
    throw new Error('Сервер установлен, но файл аргументов запуска не найден.');
  }
  return { argsFile: expectedArgs, serverDir };
}

async function findArgsFile(serverDir: string, name: string): Promise<string | null> {
  const base = join(serverDir, 'libraries', 'net', 'neoforged', 'neoforge');
  try {
    const vers = await readdir(base, { withFileTypes: true });
    for (const v of vers) {
      if (!v.isDirectory()) continue;
      const candidate = join(base, v.name, name);
      if (await pathExists(candidate)) return candidate;
    }
  } catch {
    /* ignore */
  }
  return null;
}
