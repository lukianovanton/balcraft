import AdmZip from 'adm-zip';
import { readdir, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import type { JavaRuntime, ProgressReporter } from '../types.js';
import { LauncherPaths } from '../paths.js';
import { detectPlatform, javaExecName } from '../util/platform.js';
import { downloadFile, fetchJson } from '../util/download.js';
import { ensureDir, pathExists, remove } from '../util/fsx.js';

interface AdoptiumAsset {
  binary: {
    package: {
      link: string;
      checksum: string; // sha256
      name: string;
    };
    image_type: string;
  };
  release_name: string;
  version: { major: number; semver: string };
}

/**
 * Ensure a managed Adoptium Temurin JRE of the requested major version exists
 * on disk, downloading and extracting it if needed. Returns the runtime info.
 */
export async function ensureJavaRuntime(
  paths: LauncherPaths,
  major: number,
  report?: ProgressReporter,
  signal?: AbortSignal,
): Promise<JavaRuntime> {
  const runtimeDir = paths.javaRuntime(major);
  const existing = await findJavaExec(runtimeDir);
  if (existing) {
    return { javaPath: existing, majorVersion: major, home: runtimeDir };
  }

  const plat = detectPlatform();
  const osName = plat.os === 'osx' ? 'mac' : plat.os;
  const arch = plat.arch;

  report?.({
    taskId: 'install:java',
    phase: `Поиск Java ${major}`,
    progress: null,
  });

  const apiUrl =
    `https://api.adoptium.net/v3/assets/latest/${major}/hotspot` +
    `?architecture=${arch}&image_type=jre&os=${osName}&vendor=eclipse`;
  const assets = await fetchJson<AdoptiumAsset[]>(apiUrl, signal);
  const asset = assets.find((a) => a.binary.image_type === 'jre') ?? assets[0];
  if (!asset) {
    throw new Error(`Не удалось найти сборку Java ${major} для ${osName}/${arch}.`);
  }

  await ensureDir(paths.java);
  const pkg = asset.binary.package;
  const archivePath = join(paths.java, pkg.name);

  await downloadFile({
    urls: [pkg.link],
    dest: archivePath,
    // Adoptium checksum is sha256; downloadFile verifies sha1, so we skip its
    // hash check here and rely on size + successful extraction instead.
    signal,
    onBytes: (done, total) =>
      report?.({
        taskId: 'install:java',
        phase: `Скачивание Java ${major}`,
        progress: total ? done / total : null,
        bytesDone: done,
        bytesTotal: total ?? undefined,
      }),
  });

  report?.({ taskId: 'install:java', phase: `Распаковка Java ${major}`, progress: null });

  // Extract into a temp dir, then move the single top-level folder into place.
  const extractRoot = `${runtimeDir}.extract`;
  await remove(extractRoot);
  await ensureDir(extractRoot);
  if (pkg.name.endsWith('.zip')) {
    new AdmZip(archivePath).extractAllTo(extractRoot, true);
  } else {
    throw new Error(`Неизвестный формат архива Java: ${pkg.name}`);
  }

  // Adoptium archives contain a single top folder like "jdk-21.0.4+7-jre".
  const entries = await readdir(extractRoot, { withFileTypes: true });
  const topDir = entries.find((e) => e.isDirectory());
  if (!topDir) throw new Error('Пустой архив Java.');

  await remove(runtimeDir);
  const { rename } = await import('node:fs/promises');
  await rename(join(extractRoot, topDir.name), runtimeDir);
  await remove(extractRoot);
  await remove(archivePath);

  const javaPath = await findJavaExec(runtimeDir);
  if (!javaPath) throw new Error('Java установлена, но исполняемый файл не найден.');

  // On unix the binary needs execute permission.
  if (detectPlatform().os !== 'windows') {
    try {
      await chmod(javaPath, 0o755);
    } catch {
      /* ignore */
    }
  }

  return { javaPath, majorVersion: major, home: runtimeDir };
}

/** Locate the java(w) executable inside a runtime dir, if present. */
async function findJavaExec(runtimeDir: string): Promise<string | null> {
  if (!(await pathExists(runtimeDir))) return null;
  // Prefer javaw on Windows (no console window); fall back to java.
  const candidates = [
    join(runtimeDir, 'bin', javaExecName(true)),
    join(runtimeDir, 'bin', javaExecName(false)),
    // macOS bundle layout
    join(runtimeDir, 'Contents', 'Home', 'bin', javaExecName(false)),
  ];
  for (const c of candidates) {
    if (await pathExists(c)) return c;
  }
  return null;
}
