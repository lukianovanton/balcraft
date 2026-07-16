import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface PackMeta {
  name: string;
  version: string;
  minecraft: string;
  loader: 'neoforge';
  loaderVersion: string;
  recommendedRamMb: number;
  github: { owner: string; repo: string; tag: string };
  managedRoots: string[];
}

/** Absolute path to the repo's `pack/` directory. */
export function packDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // tools/pack-publisher/dist -> repo root -> pack
  return resolve(here, '..', '..', '..', 'pack');
}

export async function loadPackMeta(): Promise<PackMeta> {
  const file = join(packDir(), 'pack.meta.json');
  return JSON.parse(await readFile(file, 'utf8')) as PackMeta;
}

/** URL for a content-addressed release asset. */
export function assetUrl(meta: PackMeta, sha1: string): string {
  const { owner, repo, tag } = meta.github;
  return `https://github.com/${owner}/${repo}/releases/download/${tag}/${sha1}`;
}
