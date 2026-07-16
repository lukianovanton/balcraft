import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PackManifest, ProgressReporter } from '../types.js';
import { downloadFile, runPool } from '../util/download.js';
import { ensureParent, pathExists, remove } from '../util/fsx.js';
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

/** Where the list of pack-managed files is recorded, per instance dir. */
function managedStatePath(instanceDir: string): string {
  return join(instanceDir, '.balumba', 'managed.json');
}

async function readManagedState(instanceDir: string): Promise<string[]> {
  try {
    const raw = await readFile(managedStatePath(instanceDir), 'utf8');
    const parsed = JSON.parse(raw) as { files?: string[] };
    return parsed.files ?? [];
  } catch {
    return [];
  }
}

async function writeManagedState(instanceDir: string, files: string[]): Promise<void> {
  const p = managedStatePath(instanceDir);
  await ensureParent(p);
  await writeFile(p, JSON.stringify({ files }, null, 2), 'utf8');
}

/**
 * Bring an instance's pack files in line with the manifest for a side:
 *  - download missing / changed files (verified by sha1),
 *  - remove ONLY files this launcher previously installed from the pack and that
 *    are no longer in the manifest (so a player's own mods/resourcepacks/shaders
 *    are never deleted),
 *  - leave everything outside `managedRoots` untouched (saves, options, etc.).
 */
export async function syncPack(opts: SyncOptions): Promise<SyncResult> {
  const { manifest, instanceDir, side, report, signal } = opts;
  const desired = filesForSide(manifest, side);
  const desiredPaths = new Set(desired.map((f) => normalize(f.path)));
  const previouslyManaged = await readManagedState(instanceDir);

  // 1) Prune only previously-managed files that dropped out of the pack.
  let removed = 0;
  for (const rel of previouslyManaged) {
    const norm = normalize(rel);
    if (!desiredPaths.has(norm) && isUnderManagedRoot(norm, manifest.managedRoots)) {
      const full = join(instanceDir, norm);
      if (await pathExists(full)) {
        await remove(full);
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
      await downloadFile({ urls: file.url, dest, sha1: file.sha1, size: file.size, signal });
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

  // 3) Record the now-managed set for next time.
  await writeManagedState(instanceDir, [...desiredPaths]);

  return { downloaded, removed, upToDate };
}

function isUnderManagedRoot(relPath: string, roots: string[]): boolean {
  return roots.some((r) => relPath === r || relPath.startsWith(`${normalize(r)}/`));
}

function normalize(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\/+/, '');
}
