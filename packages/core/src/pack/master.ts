import type { ManifestFile, PackManifest, Side } from '../types.js';
import { contentDir } from '../modrinth/content.js';
import type { ModrinthProjectType } from '../modrinth/api.js';

/** One entry of the admin-managed shared pack. */
export interface MasterEntry {
  type: ModrinthProjectType;
  /** Where the file is hosted: Modrinth's CDN, or self-hosted in the pack repo. */
  source: 'modrinth' | 'github';
  /** Modrinth project id, or a synthetic id (`local:<sha1>`) for github source. */
  projectId: string;
  versionId: string;
  title: string;
  filename: string;
  /** Download URL. For github source it's filled in at publish time. */
  url: string;
  sha1: string;
  size: number;
  side: Side;
  /** Modrinth icon URL for display (optional). */
  icon?: string | null;
}

/** Repo path a self-hosted pack file is uploaded to (content-addressed). */
export function githubFilePath(sha1: string, filename: string): string {
  const ext = filename.split('.').pop() ?? 'jar';
  return `files/${sha1}.${ext}`;
}

/** Public raw URL for a self-hosted pack file. */
export function githubRawUrl(owner: string, repo: string, path: string): string {
  return `https://raw.githubusercontent.com/${owner}/${repo}/main/${path}`;
}

export interface MasterPackMeta {
  name: string;
  version: string;
  minecraft: string;
  loaderVersion: string;
  recommendedRamMb: number;
  serverAddress?: string;
}

/** Build a publishable PackManifest from the master entries. */
export function buildManifestFromMaster(
  meta: MasterPackMeta,
  entries: MasterEntry[],
  generatedAt: string,
): PackManifest {
  const files: ManifestFile[] = entries.map((e) => ({
    path: `${contentDir(e.type)}/${e.filename}`,
    sha1: e.sha1,
    size: e.size,
    url: [e.url],
    // Resourcepacks/shaders never go to the server.
    side: e.type === 'mod' ? e.side : ('client' as Side),
  }));
  files.sort((a, b) => a.path.localeCompare(b.path));

  const roots = Array.from(new Set(entries.map((e) => contentDir(e.type))));

  return {
    formatVersion: 1,
    name: meta.name,
    version: meta.version,
    minecraft: meta.minecraft,
    loader: 'neoforge',
    loaderVersion: meta.loaderVersion,
    recommendedRamMb: meta.recommendedRamMb,
    files,
    managedRoots: roots,
    serverAddress: meta.serverAddress || undefined,
    generatedAt,
  };
}

/** Suggest the next pack version string from a date + incrementing suffix. */
export function nextPackVersion(prev: string | null, dateStamp: string): string {
  // dateStamp like "2026.07.16". Append -N, bumping N if same day.
  if (prev && prev.startsWith(dateStamp)) {
    const m = prev.match(/-(\d+)$/);
    const n = m ? parseInt(m[1], 10) + 1 : 2;
    return `${dateStamp}-${n}`;
  }
  return `${dateStamp}-1`;
}
