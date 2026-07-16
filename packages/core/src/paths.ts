import { join } from 'node:path';

/**
 * Central directory layout for a launcher data root. Everything the launcher
 * downloads or manages lives under one root so it is easy to relocate/clean.
 *
 * Layout:
 *   <root>/
 *     java/                 downloaded JRE runtimes (per major version)
 *     meta/                 cached Mojang/NeoForge metadata
 *     libraries/            shared Maven-style library store (vanilla + neoforge)
 *     assets/               shared Minecraft asset store
 *     versions/             per-version client jars + json
 *     instances/<id>/       actual game instance (mods, config, saves, ...)
 *     server/               dedicated server working dir
 *     bin/                  helper binaries (playit agent, etc.)
 */
export class LauncherPaths {
  constructor(public readonly root: string) {}

  get java(): string {
    return join(this.root, 'java');
  }
  get meta(): string {
    return join(this.root, 'meta');
  }
  get libraries(): string {
    return join(this.root, 'libraries');
  }
  get assets(): string {
    return join(this.root, 'assets');
  }
  get versions(): string {
    return join(this.root, 'versions');
  }
  get instances(): string {
    return join(this.root, 'instances');
  }
  get bin(): string {
    return join(this.root, 'bin');
  }

  javaRuntime(major: number): string {
    return join(this.java, `jre-${major}`);
  }

  versionDir(versionId: string): string {
    return join(this.versions, versionId);
  }

  versionJar(versionId: string): string {
    return join(this.versionDir(versionId), `${versionId}.jar`);
  }

  versionJson(versionId: string): string {
    return join(this.versionDir(versionId), `${versionId}.json`);
  }

  instanceDir(instanceId: string): string {
    return join(this.instances, instanceId);
  }

  serverDir(): string {
    return join(this.root, 'server');
  }
}
