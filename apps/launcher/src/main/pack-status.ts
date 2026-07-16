import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { LauncherPaths, ensureParent, fetchManifest } from '@balumba/core';
import { APP_CONFIG, isGithubConfigured, manifestUrl } from './config.js';

export interface PackStatus {
  /** Whether the pack repo is configured (else sync/updates are inert). */
  configured: boolean;
  /** Version currently synced on this machine, if any. */
  installedVersion: string | null;
  /** Latest published version (null if unreachable / not configured). */
  latestVersion: string | null;
  updateAvailable: boolean;
}

function versionFile(paths: LauncherPaths): string {
  return join(paths.instanceDir(APP_CONFIG.instanceId), '.balumba', 'pack.json');
}

/** Record the pack version that was just synced onto this machine. */
export async function recordInstalledPackVersion(
  paths: LauncherPaths,
  version: string,
): Promise<void> {
  const f = versionFile(paths);
  await ensureParent(f);
  await writeFile(f, JSON.stringify({ version }), 'utf8');
}

async function readInstalledPackVersion(paths: LauncherPaths): Promise<string | null> {
  try {
    const raw = await readFile(versionFile(paths), 'utf8');
    return (JSON.parse(raw) as { version?: string }).version ?? null;
  } catch {
    return null;
  }
}

/** Compute the current pack update status (installed vs latest published). */
export async function getPackStatus(paths: LauncherPaths): Promise<PackStatus> {
  const installedVersion = await readInstalledPackVersion(paths);
  if (!isGithubConfigured()) {
    return { configured: false, installedVersion, latestVersion: null, updateAvailable: false };
  }
  let latestVersion: string | null = null;
  try {
    latestVersion = (await fetchManifest(manifestUrl())).version;
  } catch {
    latestVersion = null;
  }
  return {
    configured: true,
    installedVersion,
    latestVersion,
    updateAvailable: !!latestVersion && latestVersion !== installedVersion,
  };
}
