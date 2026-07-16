import { spawn, type ChildProcess } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { LaunchOptions } from '../types.js';
import { LauncherPaths } from '../paths.js';
import { detectPlatform } from '../util/platform.js';
import { ensureDir } from '../util/fsx.js';
import { buildLaunchArgs } from './args.js';
import type { VersionJson } from '../install/mojang-types.js';

/**
 * Encode args for a Java @argfile. The NeoForge command line (module path +
 * classpath) easily exceeds the Windows ~32k command-line limit, so we pass a
 * single @argfile instead.
 *
 * Java argfile quoting rules (verified against the JVM): in UNquoted tokens a
 * backslash is literal, so Windows paths without spaces are written as-is. Only
 * inside quotes is a backslash an escape char — so tokens containing whitespace
 * are quoted with their backslashes and quotes doubled/escaped.
 */
function encodeArgfile(args: string[]): string {
  return args
    .map((a) => {
      if (/\s/.test(a)) {
        const escaped = a.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        return `"${escaped}"`;
      }
      return a; // unquoted: written literally (no backslash escaping)
    })
    .join('\n');
}

export interface SpawnGameInput {
  paths: LauncherPaths;
  /** Resolved (merged) version json — vanilla or NeoForge. */
  version: VersionJson;
  /** Base MC version id whose client jar + natives are used. */
  baseVersionId: string;
  instanceId: string;
  javaPath: string;
  options: LaunchOptions;
}

export interface RunningGame {
  process: ChildProcess;
  /** Resolves with the exit code when the game closes. */
  waitForExit(): Promise<number | null>;
}

/**
 * Spawn the Minecraft client process. Assumes install + sync already ran.
 */
export async function spawnGame(input: SpawnGameInput): Promise<RunningGame> {
  const { paths, version, baseVersionId, instanceId, javaPath, options } = input;
  const plat = detectPlatform();
  const instanceDir = paths.instanceDir(instanceId);
  await ensureDir(instanceDir);
  await ensureDir(join(instanceDir, 'mods'));

  const args = buildLaunchArgs({
    paths,
    plat,
    version,
    nativesVersionId: baseVersionId,
    instanceDir,
    options,
  });

  // Pass everything via a Java @argfile to stay under the OS command-line limit.
  const argfilePath = join(instanceDir, '.balumba-launch.args');
  await writeFile(argfilePath, encodeArgfile(args), 'utf8');

  const child = spawn(javaPath, [`@${argfilePath}`], {
    cwd: instanceDir,
    detached: false,
    windowsHide: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return {
    process: child,
    waitForExit: () =>
      new Promise<number | null>((resolve) => {
        child.on('close', (code) => resolve(code));
      }),
  };
}
