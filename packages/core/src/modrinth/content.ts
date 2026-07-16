import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { downloadFile } from '../util/download.js';
import { ensureParent, pathExists, remove } from '../util/fsx.js';
import type { ModrinthProjectType } from './api.js';

/** A user-installed piece of content (mod / resourcepack / shader). */
export interface UserContentEntry {
  /** Path relative to the instance dir (forward slashes). */
  path: string;
  type: ModrinthProjectType;
  projectId: string;
  versionId: string;
  title: string;
  sha1: string;
  size: number;
  /** True once the pack manifest also ships this file (managed centrally). */
  fromPack?: boolean;
}

/** Instance sub-directory for a content type. */
export function contentDir(type: ModrinthProjectType): string {
  switch (type) {
    case 'mod':
      return 'mods';
    case 'resourcepack':
      return 'resourcepacks';
    case 'shader':
      return 'shaderpacks';
  }
}

function registryPath(instanceDir: string): string {
  return join(instanceDir, '.balumba', 'user-content.json');
}

export async function readUserContent(instanceDir: string): Promise<UserContentEntry[]> {
  try {
    const raw = await readFile(registryPath(instanceDir), 'utf8');
    return (JSON.parse(raw) as { items?: UserContentEntry[] }).items ?? [];
  } catch {
    return [];
  }
}

export async function writeUserContent(
  instanceDir: string,
  items: UserContentEntry[],
): Promise<void> {
  const p = registryPath(instanceDir);
  await ensureParent(p);
  await writeFile(p, JSON.stringify({ items }, null, 2), 'utf8');
}

export interface InstallSpec {
  type: ModrinthProjectType;
  projectId: string;
  versionId: string;
  title: string;
  file: { url: string; filename: string; sha1: string; size: number };
}

/**
 * Download one content file into the correct sub-dir and record it in the user
 * registry (idempotent by project id — replaces an older version of the same
 * project). Returns the updated registry.
 */
export async function installContent(
  instanceDir: string,
  spec: InstallSpec,
  signal?: AbortSignal,
): Promise<UserContentEntry[]> {
  const rel = `${contentDir(spec.type)}/${spec.file.filename}`;
  const dest = join(instanceDir, rel);
  await downloadFile({
    urls: [spec.file.url],
    dest,
    sha1: spec.file.sha1,
    size: spec.file.size,
    signal,
  });

  const items = await readUserContent(instanceDir);
  // Remove any previous version of the same project (and its old file).
  const prev = items.filter((i) => i.projectId === spec.projectId);
  for (const old of prev) {
    if (old.path !== rel) await remove(join(instanceDir, old.path));
  }
  const kept = items.filter((i) => i.projectId !== spec.projectId);
  kept.push({
    path: rel,
    type: spec.type,
    projectId: spec.projectId,
    versionId: spec.versionId,
    title: spec.title,
    sha1: spec.file.sha1,
    size: spec.file.size,
  });
  await writeUserContent(instanceDir, kept);
  return kept;
}

/** Remove a user-installed content entry (by project id) and its file. */
export async function removeContent(
  instanceDir: string,
  projectId: string,
): Promise<UserContentEntry[]> {
  const items = await readUserContent(instanceDir);
  const target = items.find((i) => i.projectId === projectId);
  if (target) {
    const full = join(instanceDir, target.path);
    if (await pathExists(full)) await remove(full);
  }
  const kept = items.filter((i) => i.projectId !== projectId);
  await writeUserContent(instanceDir, kept);
  return kept;
}
