import { app } from 'electron';
import { readFile, writeFile, readdir, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  LauncherPaths,
  ensureDir,
  ensureParent,
  sha1File,
  getProject,
  getProjects,
  getProjectVersions,
  getVersion,
  getVersionsByHashes,
  pickBestVersion,
  primaryFile,
  classifyModByFilename,
  buildManifestFromMaster,
  nextPackVersion,
  githubFilePath,
  githubRawUrl,
  putFile,
  putBinaryFile,
  checkRepoWritable,
  type MasterEntry,
  type ModrinthProject,
  type ModrinthProjectType,
  type Side,
} from '@balumba/core';
import { APP_CONFIG, effectiveRepo } from './config.js';
import type { Store } from './store.js';

interface MasterFile {
  version: string | null;
  entries: MasterEntry[];
}

export interface PublishResult {
  version: string;
  fileCount: number;
  addedDeps: number;
}

export interface ImportResult {
  added: number;
  unresolved: string[];
}

/**
 * Admin-only management of the SHARED pack: a list of Modrinth-hosted files that
 * every player receives. Editing + publishing happens entirely in-app; only the
 * small manifest.json is pushed to GitHub (mods stream from Modrinth's CDN).
 */
export class PackAdminService {
  private paths = new LauncherPaths(join(app.getPath('userData'), 'minecraft'));

  constructor(private store: Store) {}

  private get file(): string {
    return join(this.paths.root, 'pack-master.json');
  }

  /** Local store for self-hosted (non-Modrinth) pack files, keyed by sha1. */
  private get filesDir(): string {
    return join(this.paths.root, 'pack-files');
  }

  private async load(): Promise<MasterFile> {
    try {
      return JSON.parse(await readFile(this.file, 'utf8')) as MasterFile;
    } catch {
      return { version: null, entries: [] };
    }
  }

  private async save(master: MasterFile): Promise<void> {
    await ensureParent(this.file);
    await writeFile(this.file, JSON.stringify(master, null, 2), 'utf8');
  }

  async listEntries(): Promise<MasterEntry[]> {
    return (await this.load()).entries;
  }

  /** Add (or update) a project by resolving its best version for 1.21.1. */
  async addProject(projectId: string, type: ModrinthProjectType): Promise<MasterEntry[]> {
    const versions = await getProjectVersions(projectId, {
      loader: type === 'mod' ? APP_CONFIG.loader : undefined,
      gameVersion: APP_CONFIG.minecraftVersion,
    });
    const best = pickBestVersion(versions);
    if (!best) throw new Error('Нет совместимой версии для 1.21.1 / NeoForge.');
    const f = primaryFile(best);
    if (!f) throw new Error('У версии нет файла.');
    const project = await getProject(projectId).catch(() => null);

    const entry: MasterEntry = {
      type,
      source: 'modrinth',
      projectId,
      versionId: best.id,
      title: project?.title || best.name || projectId,
      filename: f.filename,
      url: f.url,
      sha1: f.hashes.sha1,
      size: f.size,
      side: type === 'mod' ? classifyModByFilename(f.filename) : 'client',
      icon: project?.icon_url ?? null,
    };

    const master = await this.load();
    master.entries = master.entries.filter((e) => e.projectId !== projectId);
    master.entries.push(entry);
    await this.save(master);
    return master.entries;
  }

  async removeProject(projectId: string): Promise<MasterEntry[]> {
    const master = await this.load();
    master.entries = master.entries.filter((e) => e.projectId !== projectId);
    await this.save(master);
    return master.entries;
  }

  async setSide(projectId: string, side: Side): Promise<MasterEntry[]> {
    const master = await this.load();
    const e = master.entries.find((x) => x.projectId === projectId);
    if (e && e.type === 'mod') e.side = side;
    await this.save(master);
    return master.entries;
  }

  /** Bootstrap the master pack from a folder of jars (resolved via Modrinth). */
  async importFromFolder(dir: string): Promise<ImportResult> {
    const names = (await readdir(dir, { withFileTypes: true }))
      .filter((d) => d.isFile() && d.name.toLowerCase().endsWith('.jar'))
      .map((d) => d.name);

    const hashToName = new Map<string, string>();
    for (const name of names) {
      const h = await sha1File(join(dir, name));
      hashToName.set(h, name);
    }
    const resolved = await getVersionsByHashes([...hashToName.keys()]);
    // Bulk-fetch project titles/icons for nicer display.
    const projIds = Array.from(new Set(Object.values(resolved).map((v) => v.project_id)));
    const projects: Record<string, ModrinthProject> = await getProjects(projIds).catch(() => ({}));

    const master = await this.load();
    const existing = new Set(master.entries.map((e) => e.projectId));
    let added = 0;
    const selfHosted: string[] = [];
    await ensureDir(this.filesDir);
    const { statSync } = await import('node:fs');

    for (const [hash, name] of hashToName) {
      const version = resolved[hash];
      if (version) {
        if (existing.has(version.project_id)) continue;
        const f = version.files.find((x) => x.hashes.sha1 === hash) ?? version.files[0];
        const proj = projects[version.project_id];
        master.entries.push({
          type: 'mod',
          source: 'modrinth',
          projectId: version.project_id,
          versionId: version.id,
          title: proj?.title || name.replace(/\.jar$/i, ''),
          filename: f.filename,
          url: f.url,
          sha1: f.hashes.sha1,
          size: f.size,
          side: classifyModByFilename(f.filename),
          icon: proj?.icon_url ?? null,
        });
        existing.add(version.project_id);
        added++;
      } else {
        // Not on Modrinth — self-host it in the pack repo.
        const localId = `local:${hash}`;
        if (existing.has(localId)) continue;
        const ext = name.split('.').pop() ?? 'jar';
        await copyFile(join(dir, name), join(this.filesDir, `${hash}.${ext}`));
        const size = statSync(join(dir, name)).size;
        master.entries.push({
          type: 'mod',
          source: 'github',
          projectId: localId,
          versionId: hash,
          title: name.replace(/\.jar$/i, ''),
          filename: name,
          url: '',
          sha1: hash,
          size,
          side: classifyModByFilename(name),
        });
        existing.add(localId);
        selfHosted.push(name);
        added++;
      }
    }
    await this.save(master);
    return { added, unresolved: selfHosted };
  }

  /**
   * Ensure every mod's required Modrinth dependencies are present in the pack
   * (e.g. AE2 → guideme). Adds missing ones. Returns how many were added.
   */
  async resolveDependencies(): Promise<number> {
    let added = 0;
    for (let pass = 0; pass < 6; pass++) {
      const master = await this.load();
      const present = new Set(master.entries.map((e) => e.projectId));
      const missing = new Set<string>();

      for (const e of master.entries) {
        if (e.type !== 'mod' || e.source !== 'modrinth') continue;
        let version;
        try {
          version = await getVersion(e.versionId);
        } catch {
          continue;
        }
        for (const dep of version.dependencies) {
          if (dep.dependency_type !== 'required') continue;
          let pid = dep.project_id;
          if (!pid && dep.version_id) {
            pid = await getVersion(dep.version_id).then((v) => v.project_id).catch(() => null);
          }
          if (pid && !present.has(pid)) missing.add(pid);
        }
      }

      if (missing.size === 0) break;
      for (const pid of missing) {
        try {
          await this.addProject(pid, 'mod');
          added++;
        } catch {
          /* skip deps with no 1.21.1 build */
        }
      }
    }
    return added;
  }

  /** Build the manifest and publish it to GitHub (admin only). */
  async publish(): Promise<PublishResult> {
    const s = this.store.getSettings();
    if (!s.githubToken) throw new Error('Не задан GitHub-токен (Настройки → Режим админа).');
    const { owner, repo } = effectiveRepo(s);

    // Pull in any missing required dependencies (e.g. AE2 -> guideme).
    const addedDeps = await this.resolveDependencies();

    const master = await this.load();
    if (master.entries.length === 0) throw new Error('Сборка пуста — добавь моды.');

    // Upload any self-hosted (non-Modrinth) files and fill in their URLs.
    const gh = { owner, repo, token: s.githubToken };
    for (const e of master.entries) {
      if (e.source !== 'github') continue;
      const repoPath = githubFilePath(e.sha1, e.filename);
      const ext = e.filename.split('.').pop() ?? 'jar';
      const local = join(this.filesDir, `${e.sha1}.${ext}`);
      const data = await readFile(local);
      await putBinaryFile(gh, repoPath, data, `add ${e.filename}`);
      e.url = githubRawUrl(owner, repo, repoPath);
    }

    const now = new Date();
    const stamp = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(
      now.getDate(),
    ).padStart(2, '0')}`;
    const version = nextPackVersion(master.version, stamp);

    const manifest = buildManifestFromMaster(
      {
        name: 'BalumbaCraft',
        version,
        minecraft: APP_CONFIG.minecraftVersion,
        loaderVersion: APP_CONFIG.neoforgeVersion,
        recommendedRamMb: APP_CONFIG.defaultRamMb,
      },
      master.entries,
      now.toISOString(),
    );

    await putFile(gh, APP_CONFIG.manifestFile, JSON.stringify(manifest, null, 2), `pack ${version}`);

    master.version = version;
    await this.save(master);
    return { version, fileCount: manifest.files.length, addedDeps };
  }

  /** Validate that the configured token can write to the repo. */
  async checkAdminAccess(): Promise<boolean> {
    const s = this.store.getSettings();
    if (!s.githubToken) return false;
    const { owner, repo } = effectiveRepo(s);
    return checkRepoWritable({ owner, repo, token: s.githubToken });
  }
}
