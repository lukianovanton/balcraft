/**
 * Minimal Modrinth API v2 client (https://docs.modrinth.com). No auth needed for
 * search and downloads. Modrinth asks for a descriptive User-Agent.
 */
const BASE = 'https://api.modrinth.com/v2';
const UA = 'BalumbaCraft/1.0 (private launcher)';

export type ModrinthProjectType = 'mod' | 'resourcepack' | 'shader';

export interface ModrinthHit {
  project_id: string;
  slug: string;
  title: string;
  description: string;
  author: string;
  downloads: number;
  follows: number;
  icon_url: string | null;
  categories: string[];
  project_type: string;
  versions: string[];
}

export interface ModrinthSearchResult {
  hits: ModrinthHit[];
  offset: number;
  limit: number;
  total_hits: number;
}

export interface ModrinthFile {
  url: string;
  filename: string;
  primary: boolean;
  size: number;
  hashes: { sha1: string; sha512?: string };
}

export interface ModrinthDependency {
  project_id: string | null;
  version_id: string | null;
  dependency_type: 'required' | 'optional' | 'incompatible' | 'embedded';
}

export interface ModrinthVersion {
  id: string;
  project_id: string;
  name: string;
  version_number: string;
  game_versions: string[];
  loaders: string[];
  version_type: 'release' | 'beta' | 'alpha';
  date_published: string;
  files: ModrinthFile[];
  dependencies: ModrinthDependency[];
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal,
  });
  if (!res.ok) throw new Error(`Modrinth ${res.status}: ${path}`);
  return (await res.json()) as T;
}

export interface SearchParams {
  query: string;
  type: ModrinthProjectType;
  /** Mod loader facet (mods only). */
  loader?: string;
  gameVersion?: string;
  limit?: number;
  offset?: number;
}

/** Search projects with facets for type/loader/game-version. */
export async function searchModrinth(
  params: SearchParams,
  signal?: AbortSignal,
): Promise<ModrinthSearchResult> {
  const facets: string[][] = [[`project_type:${params.type}`]];
  // Loaders only apply to mods; resourcepacks/shaders aren't loader-bound.
  if (params.type === 'mod' && params.loader) facets.push([`categories:${params.loader}`]);
  if (params.gameVersion) facets.push([`versions:${params.gameVersion}`]);

  const q = new URLSearchParams({
    query: params.query,
    limit: String(params.limit ?? 20),
    offset: String(params.offset ?? 0),
    index: 'relevance',
    facets: JSON.stringify(facets),
  });
  return get<ModrinthSearchResult>(`/search?${q.toString()}`, signal);
}

/** List versions of a project, optionally filtered by loader + game version. */
export async function getProjectVersions(
  projectId: string,
  opts: { loader?: string; gameVersion?: string } = {},
  signal?: AbortSignal,
): Promise<ModrinthVersion[]> {
  const q = new URLSearchParams();
  if (opts.loader) q.set('loaders', JSON.stringify([opts.loader]));
  if (opts.gameVersion) q.set('game_versions', JSON.stringify([opts.gameVersion]));
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return get<ModrinthVersion[]>(`/project/${projectId}/version${suffix}`, signal);
}

/** Fetch a single version by id. */
export function getVersion(versionId: string, signal?: AbortSignal): Promise<ModrinthVersion> {
  return get<ModrinthVersion>(`/version/${versionId}`, signal);
}

/**
 * Resolve many local files to their Modrinth versions by sha1 hash in one call.
 * Returns a map of sha1 -> version (only for files found on Modrinth).
 */
export async function getVersionsByHashes(
  sha1Hashes: string[],
  signal?: AbortSignal,
): Promise<Record<string, ModrinthVersion>> {
  if (sha1Hashes.length === 0) return {};
  const res = await fetch(`${BASE}/version_files`, {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ hashes: sha1Hashes, algorithm: 'sha1' }),
    signal,
  });
  if (!res.ok) throw new Error(`Modrinth ${res.status}: version_files`);
  return (await res.json()) as Record<string, ModrinthVersion>;
}

/** The primary (or first) downloadable file of a version. */
export function primaryFile(version: ModrinthVersion): ModrinthFile | null {
  return version.files.find((f) => f.primary) ?? version.files[0] ?? null;
}

/**
 * Pick the best version of a project for the given loader/game version:
 * newest release first, falling back to beta/alpha.
 */
export function pickBestVersion(versions: ModrinthVersion[]): ModrinthVersion | null {
  if (versions.length === 0) return null;
  const byType = (v: ModrinthVersion) =>
    v.version_type === 'release' ? 0 : v.version_type === 'beta' ? 1 : 2;
  return [...versions].sort((a, b) => {
    const t = byType(a) - byType(b);
    if (t !== 0) return t;
    return b.date_published.localeCompare(a.date_published);
  })[0];
}
