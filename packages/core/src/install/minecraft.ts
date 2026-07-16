import AdmZip from 'adm-zip';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ProgressReporter } from '../types.js';
import { LauncherPaths } from '../paths.js';
import { detectPlatform } from '../util/platform.js';
import { downloadFile, fetchJson, runPool } from '../util/download.js';
import { ensureDir, ensureParent, pathExists, remove } from '../util/fsx.js';
import {
  isModernNativeLib,
  isWrongArchNativeLib,
  libraryAllowed,
  mavenToPath,
  nativeClassifier,
} from './common.js';
import type {
  AssetIndex,
  Library,
  VersionJson,
  VersionManifest,
} from './mojang-types.js';

const VERSION_MANIFEST_URL =
  'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
const RESOURCES_BASE = 'https://resources.download.minecraft.net';

/** Directory where a version's extracted native libs live. */
export function versionNativesDir(paths: LauncherPaths, versionId: string): string {
  return join(paths.versionDir(versionId), 'natives');
}

/**
 * Resolve a vanilla version JSON, downloading and caching it under versions/.
 */
export async function resolveVanillaVersionJson(
  paths: LauncherPaths,
  versionId: string,
  signal?: AbortSignal,
): Promise<VersionJson> {
  const jsonPath = paths.versionJson(versionId);
  if (await pathExists(jsonPath)) {
    return JSON.parse(await readFile(jsonPath, 'utf8')) as VersionJson;
  }
  const manifest = await fetchJson<VersionManifest>(VERSION_MANIFEST_URL, signal);
  const entry = manifest.versions.find((v) => v.id === versionId);
  if (!entry) throw new Error(`Версия Minecraft ${versionId} не найдена в манифесте.`);
  const version = await fetchJson<VersionJson>(entry.url, signal);
  await ensureParent(jsonPath);
  await writeFile(jsonPath, JSON.stringify(version), 'utf8');
  return version;
}

/** Absolute path to a library artifact in the shared library store. */
export function libraryPath(paths: LauncherPaths, lib: Library): string {
  const rel = lib.downloads?.artifact?.path ?? mavenToPath(lib.name);
  return join(paths.libraries, rel);
}

/**
 * Install everything vanilla 1.21.1 needs: client jar, libraries, natives, assets.
 * Idempotent — existing valid files are skipped.
 */
export async function installVanilla(
  paths: LauncherPaths,
  versionId: string,
  report?: ProgressReporter,
  signal?: AbortSignal,
): Promise<VersionJson> {
  const plat = detectPlatform();
  const version = await resolveVanillaVersionJson(paths, versionId, signal);

  // 1) client jar
  report?.({ taskId: 'install:mc', phase: 'Клиент Minecraft', progress: null });
  const clientJar = paths.versionJar(versionId);
  await downloadFile({
    urls: [version.downloads.client.url],
    dest: clientJar,
    sha1: version.downloads.client.sha1,
    size: version.downloads.client.size,
    signal,
  });

  // 2) libraries + natives (drop native artifacts for other CPU arches)
  const libs = version.libraries.filter(
    (l) => libraryAllowed(l, plat) && !isWrongArchNativeLib(l, plat),
  );
  let libDone = 0;
  await runPool(libs, 8, async (lib) => {
    // main artifact
    if (lib.downloads?.artifact?.url) {
      await downloadFile({
        urls: [lib.downloads.artifact.url],
        dest: libraryPath(paths, lib),
        sha1: lib.downloads.artifact.sha1,
        size: lib.downloads.artifact.size,
        signal,
      });
    }
    // legacy native classifier
    const nativeKey = nativeClassifier(lib, plat);
    if (nativeKey && lib.downloads?.classifiers?.[nativeKey]) {
      const nd = lib.downloads.classifiers[nativeKey];
      const dest = join(paths.libraries, nd.path ?? mavenToPath(`${lib.name}:${nativeKey}`));
      await downloadFile({ urls: [nd.url], dest, sha1: nd.sha1, size: nd.size, signal });
    }
    libDone++;
    report?.({
      taskId: 'install:mc',
      phase: 'Библиотеки',
      progress: libDone / libs.length,
      detail: lib.name,
    });
  });

  // extract natives into the version natives dir
  await extractNatives(paths, version, versionId, plat);

  // 3) assets
  await installAssets(paths, version, report, signal);

  return version;
}

/** Download the asset index and all asset objects. */
export async function installAssets(
  paths: LauncherPaths,
  version: VersionJson,
  report?: ProgressReporter,
  signal?: AbortSignal,
): Promise<void> {
  const indexPath = join(paths.assets, 'indexes', `${version.assetIndex.id}.json`);
  await downloadFile({
    urls: [version.assetIndex.url],
    dest: indexPath,
    sha1: version.assetIndex.sha1,
    size: version.assetIndex.size,
    signal,
  });

  const index = JSON.parse(await readFile(indexPath, 'utf8')) as AssetIndex;
  const objects = Object.values(index.objects);
  const objectsDir = join(paths.assets, 'objects');

  let done = 0;
  await runPool(objects, 12, async (obj) => {
    const sub = obj.hash.slice(0, 2);
    const dest = join(objectsDir, sub, obj.hash);
    await downloadFile({
      urls: [`${RESOURCES_BASE}/${sub}/${obj.hash}`],
      dest,
      sha1: obj.hash,
      size: obj.size,
      signal,
    });
    done++;
    if (done % 25 === 0 || done === objects.length) {
      report?.({
        taskId: 'install:mc',
        phase: 'Ассеты',
        progress: done / objects.length,
        detail: `${done}/${objects.length}`,
      });
    }
  });
}

/** Extract native libraries (dll/so/dylib) for the current OS into the natives dir. */
async function extractNatives(
  paths: LauncherPaths,
  version: VersionJson,
  versionId: string,
  plat: ReturnType<typeof detectPlatform>,
): Promise<void> {
  const destDir = versionNativesDir(paths, versionId);
  // Clear stale natives so a previous wrong-arch extraction can't linger.
  await remove(destDir);
  await ensureDir(destDir);
  const nativeExt = plat.os === 'windows' ? '.dll' : plat.os === 'osx' ? '.dylib' : '.so';

  for (const lib of version.libraries) {
    if (!libraryAllowed(lib, plat)) continue;

    let jarPath: string | null = null;
    const nativeKey = nativeClassifier(lib, plat);
    if (nativeKey && lib.downloads?.classifiers?.[nativeKey]) {
      const nd = lib.downloads.classifiers[nativeKey];
      jarPath = join(paths.libraries, nd.path ?? mavenToPath(`${lib.name}:${nativeKey}`));
    } else if (isModernNativeLib(lib, plat) && lib.downloads?.artifact) {
      jarPath = libraryPath(paths, lib);
    }
    if (!jarPath || !(await pathExists(jarPath))) continue;

    const excludes = lib.extract?.exclude ?? ['META-INF/'];
    const zip = new AdmZip(jarPath);
    for (const entry of zip.getEntries()) {
      if (entry.isDirectory) continue;
      const name = entry.entryName;
      if (excludes.some((ex) => name.startsWith(ex))) continue;
      // Only extract actual native binaries.
      if (!name.toLowerCase().endsWith(nativeExt)) continue;
      const base = name.split('/').pop()!;
      const out = join(destDir, base);
      await ensureParent(out);
      await writeFile(out, entry.getData());
    }
  }
}
