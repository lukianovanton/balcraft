/**
 * Minimal GitHub Contents API client for committing a single small file (the
 * pack manifest) to a repo's main branch. Mods live on Modrinth's CDN, so this
 * is all the publishing GitHub needs to host.
 */
const API = 'https://api.github.com';

interface GhOpts {
  owner: string;
  repo: string;
  token: string;
  branch?: string;
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'BalumbaCraft-Launcher',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

/** Current sha of a file at `path`, or null if it doesn't exist yet. */
export async function getFileSha(opts: GhOpts, path: string): Promise<string | null> {
  const branch = opts.branch ?? 'main';
  const res = await fetch(
    `${API}/repos/${opts.owner}/${opts.repo}/contents/${path}?ref=${branch}`,
    { headers: headers(opts.token) },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status}: не удалось прочитать ${path}`);
  const json = (await res.json()) as { sha?: string };
  return json.sha ?? null;
}

/**
 * Create or update a text file in the repo (commits to `branch`). Returns the
 * new commit sha. Requires a token with `contents:write` (repo) scope.
 */
export async function putFile(
  opts: GhOpts,
  path: string,
  content: string,
  message: string,
): Promise<string> {
  const branch = opts.branch ?? 'main';
  const existingSha = await getFileSha(opts, path);
  const body: Record<string, unknown> = {
    message,
    content: Buffer.from(content, 'utf8').toString('base64'),
    branch,
  };
  if (existingSha) body.sha = existingSha;

  const res = await fetch(`${API}/repos/${opts.owner}/${opts.repo}/contents/${path}`, {
    method: 'PUT',
    headers: { ...headers(opts.token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`GitHub ${res.status}: не удалось записать ${path}. ${txt.slice(0, 200)}`);
  }
  const json = (await res.json()) as { commit?: { sha?: string } };
  return json.commit?.sha ?? '';
}

/** True if a file already exists in the repo (content-addressed uploads skip). */
export async function fileExists(opts: GhOpts, path: string): Promise<boolean> {
  return (await getFileSha(opts, path)) !== null;
}

/**
 * Upload a binary file (e.g. a mod jar not on Modrinth) to the repo. Idempotent:
 * skips the upload if the path already exists (paths are content-addressed).
 */
export async function putBinaryFile(
  opts: GhOpts,
  path: string,
  data: Buffer,
  message: string,
): Promise<void> {
  const branch = opts.branch ?? 'main';
  if (await fileExists(opts, path)) return;
  const res = await fetch(`${API}/repos/${opts.owner}/${opts.repo}/contents/${path}`, {
    method: 'PUT',
    headers: { ...headers(opts.token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content: data.toString('base64'), branch }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`GitHub ${res.status}: не удалось загрузить ${path}. ${txt.slice(0, 200)}`);
  }
}

/** Verify a token can write to the repo (used to validate admin setup). */
export async function checkRepoWritable(opts: GhOpts): Promise<boolean> {
  const res = await fetch(`${API}/repos/${opts.owner}/${opts.repo}`, {
    headers: headers(opts.token),
  });
  if (!res.ok) return false;
  const json = (await res.json()) as { permissions?: { push?: boolean } };
  return !!json.permissions?.push;
}
