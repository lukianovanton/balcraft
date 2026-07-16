import { execFile } from 'node:child_process';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { ProgressReporter } from '../types.js';
import { LauncherPaths } from '../paths.js';
import { downloadFile } from '../util/download.js';
import { ensureDir, pathExists } from '../util/fsx.js';
import type { Library, VersionJson } from './mojang-types.js';

const NEOFORGE_MAVEN = 'https://maven.neoforged.net/releases/net/neoforged/neoforge';

/** The version id the NeoForge installer creates under versions/. */
export function neoforgeVersionId(neoforgeVersion: string): string {
  return `neoforge-${neoforgeVersion}`;
}

/**
 * Install NeoForge for a given MC version using the official installer in
 * headless client mode. Vanilla for `mcVersion` must already be installed into
 * the same launcher root (shared .minecraft-style layout).
 *
 * Returns the merged (inheritance-resolved) version json ready to launch.
 */
export async function installNeoForge(
  paths: LauncherPaths,
  javaPath: string,
  mcVersion: string,
  neoforgeVersion: string,
  report?: ProgressReporter,
  signal?: AbortSignal,
): Promise<{ version: VersionJson; versionId: string }> {
  const versionId = neoforgeVersionId(neoforgeVersion);
  const childJsonPath = join(paths.versionDir(versionId), `${versionId}.json`);

  // Already installed? Merge and return.
  if (await pathExists(childJsonPath)) {
    const merged = await resolveMergedVersion(paths, versionId);
    return { version: merged, versionId };
  }

  report?.({ taskId: 'install:neoforge', phase: 'Скачивание установщика NeoForge', progress: null });
  const installerName = `neoforge-${neoforgeVersion}-installer.jar`;
  const installerPath = join(paths.meta, installerName);
  await downloadFile({
    urls: [`${NEOFORGE_MAVEN}/${neoforgeVersion}/${installerName}`],
    dest: installerPath,
    signal,
    onBytes: (done, total) =>
      report?.({
        taskId: 'install:neoforge',
        phase: 'Скачивание установщика NeoForge',
        progress: total ? done / total : null,
      }),
  });

  // The Forge/NeoForge installer requires a launcher_profiles.json to exist.
  await ensureLauncherProfiles(paths);

  report?.({
    taskId: 'install:neoforge',
    phase: 'Установка NeoForge (процессоры)…',
    progress: null,
  });

  await runInstaller(javaPath, installerPath, paths.root, (line) =>
    report?.({ taskId: 'install:neoforge', phase: 'Установка NeoForge', progress: null, detail: line }),
  );

  if (!(await pathExists(childJsonPath))) {
    // Some installer versions name the folder differently — find it.
    const found = await findNeoforgeVersionDir(paths, neoforgeVersion);
    if (!found) {
      throw new Error('Установщик NeoForge завершился, но version json не найден.');
    }
  }

  const merged = await resolveMergedVersion(paths, versionId);
  return { version: merged, versionId };
}

/** Run the installer jar headlessly in client-install mode. */
function runInstaller(
  javaPath: string,
  installerPath: string,
  targetDir: string,
  onLine: (line: string) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      javaPath.replace(/javaw\.exe$/i, 'java.exe'),
      ['-Djava.awt.headless=true', '-jar', installerPath, '--install-client', targetDir],
      { cwd: targetDir, maxBuffer: 64 * 1024 * 1024 },
      (err) => {
        if (err) reject(new Error(`Установщик NeoForge завершился с ошибкой: ${err.message}`));
        else resolve();
      },
    );
    child.stdout?.on('data', (d: Buffer) =>
      d.toString().split('\n').filter(Boolean).forEach((l) => onLine(l.trimEnd())),
    );
    child.stderr?.on('data', (d: Buffer) =>
      d.toString().split('\n').filter(Boolean).forEach((l) => onLine(l.trimEnd())),
    );
  });
}

/** Create a minimal launcher_profiles.json if missing (installer requires it). */
async function ensureLauncherProfiles(paths: LauncherPaths): Promise<void> {
  await ensureDir(paths.root);
  const file = join(paths.root, 'launcher_profiles.json');
  if (!(await pathExists(file))) {
    await writeFile(
      file,
      JSON.stringify({ profiles: {}, settings: {}, version: 3 }, null, 2),
      'utf8',
    );
  }
}

async function findNeoforgeVersionDir(
  paths: LauncherPaths,
  neoforgeVersion: string,
): Promise<string | null> {
  try {
    const dirs = await readdir(paths.versions, { withFileTypes: true });
    const match = dirs.find(
      (d) => d.isDirectory() && d.name.includes(neoforgeVersion) && d.name.includes('neoforge'),
    );
    return match ? match.name : null;
  } catch {
    return null;
  }
}

/**
 * Resolve the merged version json by combining the NeoForge child json with its
 * parent (vanilla), following Mojang inheritance semantics.
 */
export async function resolveMergedVersion(
  paths: LauncherPaths,
  versionId: string,
): Promise<VersionJson> {
  const child = JSON.parse(
    await readFile(paths.versionJson(versionId), 'utf8'),
  ) as VersionJson;
  if (!child.inheritsFrom) return child;

  const parent = JSON.parse(
    await readFile(paths.versionJson(child.inheritsFrom), 'utf8'),
  ) as VersionJson;

  return mergeVersionJson(parent, child);
}

/** Merge a child (loader) version json onto its parent (vanilla). */
export function mergeVersionJson(parent: VersionJson, child: VersionJson): VersionJson {
  // Libraries: child entries win over parent for the same group:artifact.
  const libByKey = new Map<string, Library>();
  const keyOf = (name: string) => name.split(':').slice(0, 2).join(':');
  for (const lib of child.libraries ?? []) libByKey.set(keyOf(lib.name), lib);
  for (const lib of parent.libraries ?? []) {
    const k = keyOf(lib.name);
    if (!libByKey.has(k)) libByKey.set(k, lib);
  }

  const merged: VersionJson = {
    ...parent,
    id: child.id,
    mainClass: child.mainClass ?? parent.mainClass,
    type: child.type ?? parent.type,
    libraries: [...libByKey.values()],
    inheritsFrom: undefined,
  };

  // Arguments: concat parent then child (both jvm and game).
  if (parent.arguments || child.arguments) {
    merged.arguments = {
      jvm: [...(parent.arguments?.jvm ?? []), ...(child.arguments?.jvm ?? [])],
      game: [...(parent.arguments?.game ?? []), ...(child.arguments?.game ?? [])],
    };
  }
  if (child.minecraftArguments) merged.minecraftArguments = child.minecraftArguments;

  return merged;
}
