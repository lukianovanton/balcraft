import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { LauncherPaths, ensureParent, fetchManifest, type PackManifest } from '@balumba/core';
import { APP_CONFIG, effectiveRepo, isGithubConfigured, manifestUrl } from './config.js';
import type { LauncherSettings } from '../shared/ipc.js';

/**
 * Read the latest pack manifest, avoiding the raw.githubusercontent CDN cache
 * (which can serve a stale manifest for minutes after a publish). Uses the
 * GitHub API contents endpoint for a fresh read; falls back to raw + cache-bust.
 */
export async function fetchLatestManifest(
  settings: LauncherSettings,
  signal?: AbortSignal,
): Promise<PackManifest> {
  const { owner, repo } = effectiveRepo(settings);
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${APP_CONFIG.manifestFile}?ref=main`;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.raw',
    'User-Agent': 'BalumbaCraft-Launcher',
  };
  if (settings.githubToken) headers.Authorization = `Bearer ${settings.githubToken}`;
  try {
    const res = await fetch(apiUrl, { headers, signal });
    if (res.ok) return JSON.parse(await res.text()) as PackManifest;
  } catch {
    /* fall through to raw */
  }
  return fetchManifest(`${manifestUrl(settings)}?t=${Date.now()}`, signal);
}

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
export async function getPackStatus(
  paths: LauncherPaths,
  settings: LauncherSettings,
): Promise<PackStatus> {
  const installedVersion = await readInstalledPackVersion(paths);
  if (!isGithubConfigured(settings)) {
    return { configured: false, installedVersion, latestVersion: null, updateAvailable: false };
  }
  let latestVersion: string | null = null;
  try {
    latestVersion = (await fetchLatestManifest(settings)).version;
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
