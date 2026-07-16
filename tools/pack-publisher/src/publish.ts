import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { copyFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeManifest } from '@balumba/core';
import { buildManifest } from './build.js';
import { packDir } from './config.js';

const pexec = promisify(execFile);

async function gh(args: string[]): Promise<string> {
  try {
    const { stdout } = await pexec('gh', args, { maxBuffer: 32 * 1024 * 1024 });
    return stdout;
  } catch (err) {
    const e = err as { stderr?: string; message: string };
    throw new Error(`gh ${args.join(' ')}\n${e.stderr || e.message}`);
  }
}

/**
 * Publish the pack to GitHub Releases:
 *  - build the manifest,
 *  - upload every content-addressed file (named by sha1) that isn't there yet,
 *  - upload manifest.json (clobbered).
 * Requires the `gh` CLI authenticated with write access to the repo.
 */
export async function runPublish(): Promise<void> {
  const { manifest, meta, sources } = await buildManifest();
  const { owner, repo, tag } = meta.github;
  const slug = `${owner}/${repo}`;
  if (owner === 'CHANGE_ME') {
    throw new Error('Укажи github.owner/repo в pack/pack.meta.json перед публикацией.');
  }

  // Ensure the release exists (create if missing).
  const exists = await gh(['release', 'view', tag, '--repo', slug, '--json', 'assets'])
    .then((s) => JSON.parse(s) as { assets: { name: string }[] })
    .catch(() => null);

  if (!exists) {
    await gh([
      'release', 'create', tag, '--repo', slug,
      '--title', `${meta.name} pack`,
      '--notes', 'BalumbaCraft pack files (content-addressed).',
      '--latest',
    ]);
    console.log(`[publish] создан релиз ${tag}`);
  }
  const existingAssets = new Set((exists?.assets ?? []).map((a) => a.name));

  // Stage content files named by sha1 and upload the missing ones.
  const stage = join(tmpdir(), `balumba-publish-${manifest.version}`);
  await rm(stage, { recursive: true, force: true });
  await mkdir(stage, { recursive: true });

  const toUpload: string[] = [];
  for (const [sha1, abs] of sources) {
    if (existingAssets.has(sha1)) continue;
    const staged = join(stage, sha1);
    await copyFile(abs, staged);
    toUpload.push(staged);
  }

  console.log(`[publish] новых файлов к загрузке: ${toUpload.length} / ${sources.size}`);
  // Upload in batches to keep the command line sane.
  for (let i = 0; i < toUpload.length; i += 20) {
    const batch = toUpload.slice(i, i + 20);
    await gh(['release', 'upload', tag, ...batch, '--repo', slug, '--clobber']);
    console.log(`[publish]   загружено ${Math.min(i + 20, toUpload.length)}/${toUpload.length}`);
  }

  // Write + upload the manifest (always clobber so `latest` points at it).
  const manifestPath = join(packDir(), 'manifest.json');
  await writeManifest(manifestPath, manifest);
  await gh(['release', 'upload', tag, manifestPath, '--repo', slug, '--clobber']);

  await rm(stage, { recursive: true, force: true });
  console.log(`[publish] готово. Манифест версии ${manifest.version} опубликован в ${slug}@${tag}.`);
}

/** Write a small helper file mapping for debugging. */
export async function writeDebugMap(): Promise<void> {
  const { sources } = await buildManifest();
  await writeFile(
    join(packDir(), '.cache-sources.json'),
    JSON.stringify(Object.fromEntries(sources), null, 2),
    'utf8',
  );
}
