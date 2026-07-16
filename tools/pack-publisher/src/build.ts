import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import {
  classifyModByFilename,
  listFilesRelative,
  sha1File,
  writeManifest,
  type ManifestFile,
  type PackManifest,
} from '@balumba/core';
import { assetUrl, loadPackMeta, packDir, type PackMeta } from './config.js';

/**
 * Scan pack/ and produce a PackManifest. Mods (pack/mods/*.jar) are hashed and
 * classified client/both; the manifest points each file at a content-addressed
 * GitHub release asset (named by its sha1).
 *
 * Returns the manifest plus the physical file map (path -> absolute source) so
 * `publish` can upload the exact bytes.
 */
export async function buildManifest(): Promise<{
  manifest: PackManifest;
  meta: PackMeta;
  sources: Map<string, string>; // sha1 -> absolute source path
}> {
  const meta = await loadPackMeta();
  const root = packDir();
  const sources = new Map<string, string>();
  const files: ManifestFile[] = [];

  const modsDir = join(root, 'mods');
  const modFiles = (await listFilesRelative(modsDir)).filter((f) => f.toLowerCase().endsWith('.jar'));

  for (const rel of modFiles) {
    const abs = join(modsDir, rel);
    const sha1 = await sha1File(abs);
    const size = (await stat(abs)).size;
    sources.set(sha1, abs);
    files.push({
      path: `mods/${rel}`,
      sha1,
      size,
      url: [assetUrl(meta, sha1)],
      side: classifyModByFilename(rel),
    });
  }

  files.sort((a, b) => a.path.localeCompare(b.path));

  const manifest: PackManifest = {
    formatVersion: 1,
    name: meta.name,
    version: meta.version,
    minecraft: meta.minecraft,
    loader: meta.loader,
    loaderVersion: meta.loaderVersion,
    recommendedRamMb: meta.recommendedRamMb,
    files,
    managedRoots: meta.managedRoots,
    generatedAt: new Date().toISOString(),
  };

  return { manifest, meta, sources };
}

/** Build the manifest and write it to pack/manifest.json. */
export async function runBuild(): Promise<void> {
  const { manifest } = await buildManifest();
  const out = join(packDir(), 'manifest.json');
  await writeManifest(out, manifest);

  const client = manifest.files.filter((f) => f.side !== 'server').length;
  const server = manifest.files.filter((f) => f.side !== 'client').length;
  console.log(`[build] ${manifest.files.length} мод(ов) · клиент: ${client} · сервер: ${server}`);
  console.log(`[build] версия сборки: ${manifest.version}`);
  console.log(`[build] манифест: ${out}`);
}
