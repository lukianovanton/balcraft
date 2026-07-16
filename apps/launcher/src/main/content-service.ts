import { join } from 'node:path';
import { app } from 'electron';
import {
  LauncherPaths,
  searchModrinth,
  getProjectVersions,
  getVersion,
  pickBestVersion,
  primaryFile,
  installContent,
  removeContent,
  readUserContent,
  type ModrinthHit,
  type ModrinthProjectType,
  type UserContentEntry,
} from '@balumba/core';
import { APP_CONFIG } from './config.js';

/**
 * In-launcher content manager: search Modrinth and install/remove mods,
 * resourcepacks and shaders into the player's client instance. Installed items
 * live in the instance's managed roots but are tracked separately so the pack
 * sync never deletes a player's own additions.
 */
export class ContentService {
  private paths = new LauncherPaths(join(app.getPath('userData'), 'minecraft'));

  private get instanceDir(): string {
    return this.paths.instanceDir(APP_CONFIG.instanceId);
  }

  async search(query: string, type: ModrinthProjectType): Promise<ModrinthHit[]> {
    const res = await searchModrinth({
      query,
      type,
      loader: type === 'mod' ? APP_CONFIG.loader : undefined,
      gameVersion: APP_CONFIG.minecraftVersion,
      limit: 30,
    });
    return res.hits;
  }

  listInstalled(): Promise<UserContentEntry[]> {
    return readUserContent(this.instanceDir);
  }

  /** Install a project (best matching version) plus its required dependencies. */
  async install(projectId: string, type: ModrinthProjectType): Promise<UserContentEntry[]> {
    const visited = new Set<string>();
    await this.installRecursive(projectId, type, visited);
    return this.listInstalled();
  }

  private async installRecursive(
    projectId: string,
    type: ModrinthProjectType,
    visited: Set<string>,
  ): Promise<void> {
    if (visited.has(projectId)) return;
    visited.add(projectId);

    const versions = await getProjectVersions(projectId, {
      loader: type === 'mod' ? APP_CONFIG.loader : undefined,
      gameVersion: APP_CONFIG.minecraftVersion,
    });
    const best = pickBestVersion(versions);
    if (!best) throw new Error('Нет совместимой версии для 1.21.1 / NeoForge.');
    const file = primaryFile(best);
    if (!file) throw new Error('У версии нет файла для скачивания.');

    await installContent(this.instanceDir, {
      type,
      projectId,
      versionId: best.id,
      title: best.name || projectId,
      file: { url: file.url, filename: file.filename, sha1: file.hashes.sha1, size: file.size },
    });

    // Resolve required dependencies (mods only).
    if (type === 'mod') {
      for (const dep of best.dependencies) {
        if (dep.dependency_type !== 'required') continue;
        let depProject = dep.project_id;
        if (!depProject && dep.version_id) {
          depProject = (await getVersion(dep.version_id)).project_id;
        }
        if (depProject) await this.installRecursive(depProject, 'mod', visited);
      }
    }
  }

  remove(projectId: string): Promise<UserContentEntry[]> {
    return removeContent(this.instanceDir, projectId);
  }
}
