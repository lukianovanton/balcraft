import { readFile, writeFile } from 'node:fs/promises';
import { fetchJson } from '../util/download.js';
import { ensureParent } from '../util/fsx.js';
import type { PackManifest, Side } from '../types.js';

/** Load a manifest from a local file path. */
export async function loadManifestFile(filePath: string): Promise<PackManifest> {
  return JSON.parse(await readFile(filePath, 'utf8')) as PackManifest;
}

/** Fetch a manifest from a URL (e.g. GitHub Releases). */
export async function fetchManifest(url: string, signal?: AbortSignal): Promise<PackManifest> {
  return fetchJson<PackManifest>(url, signal);
}

/** Write a manifest to disk (pretty-printed). */
export async function writeManifest(filePath: string, manifest: PackManifest): Promise<void> {
  await ensureParent(filePath);
  await writeFile(filePath, JSON.stringify(manifest, null, 2), 'utf8');
}

/** True if a file with the given side should be present on the target side. */
export function fileAppliesToSide(fileSide: Side, target: 'client' | 'server'): boolean {
  return fileSide === 'both' || fileSide === target;
}

/** Filter a manifest's files down to those needed on a given side. */
export function filesForSide(manifest: PackManifest, target: 'client' | 'server') {
  return manifest.files.filter((f) => fileAppliesToSide(f.side, target));
}
