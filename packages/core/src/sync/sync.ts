import { join } from 'node:path';
import type { PackManifest, ProgressReporter } from '../types.js';
import { downloadFile, runPool } from '../util/download.js';
import { listFilesRelative, pathExists, remove } from '../util/fsx.js';
import { verifyFile } from '../util/hash.js';
import { filesForSide } from './manifest.js';

export interface SyncOptions {
  manifest: PackManifest;
  /** Root of the instance to sync (e.g. the client instance or server dir). */
  instanceDir: string;
  side: 'client' | 'server';
  report?: ProgressReporter;
  signal?: AbortSignal;
  concurrency?: number;
}

export interface SyncResult {
  downloaded: number;
  removed: number;
  upToDate: number;
}

/**
 * Bring an instance's managed files in line with the manifest for a side:
 *  - download missing / changed files (verified by sha1),
 *  - remove managed files that are no longer in the manifest,
 *  - leave everything outside `managedRoots` untouched (saves, options, etc.).
 */
export async function syncPack(opts: SyncOptions): Promise<SyncResult> {
  const { manifest, instanceDir, side, report, signal } = opts;
  const desired = filesForSide(manifest, side);
  const desiredPaths = new Set(desired.map((f) => normalize(f.path)));

  // 1) Prune managed roots first so removed mods don't linger during launch.
  let removed = 0;
  for (const root of manifest.managedRoots) {
    const rootDir = join(instanceDir, root);
    if (!(await pathExists(rootDir))) continue;
    const existing = await listFilesRelative(rootDir);
    for (const rel of existing) {
      const full = normalize(`${root}/${rel}`);
      if (!desiredPaths.has(full)) {
        await remove(join(rootDir, rel));
        removed++;
      }
    }
  }

  // 2) Download / verify desired files.
  let downloaded = 0;
  let upToDate = 0;
  let done = 0;
  await runPool(desired, opts.concurrency ?? 8, async (file) => {
    const dest = join(instanceDir, file.path);
    if (await verifyFile(dest, file.sha1, file.size)) {
      upToDate++;
    } else {
      await downloadFile({
        urls: file.url,
        dest,
        sha1: file.sha1,
        size: file.size,
        signal,
      });
      downloaded++;
    }
    done++;
    report?.({
      taskId: 'sync:pack',
      phase: 'Синхронизация сборки',
      progress: done / desired.length,
      detail: file.path,
    });
  });

  return { downloaded, removed, upToDate };
}

function normalize(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\/+/, '');
}
