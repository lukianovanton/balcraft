import { join } from 'node:path';
import type { Account, LaunchOptions, PlatformInfo } from '../types.js';
import { LauncherPaths } from '../paths.js';
import { classpathSeparator } from '../util/platform.js';
import { undashUuid } from '../auth/offline.js';
import { isWrongArchNativeLib, libraryAllowed, rulesAllow } from '../install/common.js';
import { libraryPath, versionNativesDir } from '../install/minecraft.js';
import type { ArgumentValue, VersionJson } from '../install/mojang-types.js';

export interface BuildArgsInput {
  paths: LauncherPaths;
  plat: PlatformInfo;
  /** Fully-resolved (inheritance-merged) version json. */
  version: VersionJson;
  /** Version id whose natives dir to use (the base MC id). */
  nativesVersionId: string;
  instanceDir: string;
  options: LaunchOptions;
}

/** Build the ordered classpath (library artifacts + client jar). */
export function buildClasspath(input: BuildArgsInput): string[] {
  const { paths, plat, version } = input;
  const seen = new Set<string>();
  const cp: string[] = [];
  for (const lib of version.libraries) {
    if (!libraryAllowed(lib, plat)) continue;
    // Skip pure legacy-native jars (they only carry dll/so, not classes).
    if (lib.natives && !lib.downloads?.artifact) continue;
    // Skip native artifacts for other CPU arches (they'd shadow the right one).
    if (isWrongArchNativeLib(lib, plat)) continue;
    const p = libraryPath(paths, lib);
    if (!seen.has(p)) {
      seen.add(p);
      cp.push(p);
    }
  }
  // The base client jar goes last.
  cp.push(paths.versionJar(input.nativesVersionId));
  return cp;
}

function substitute(value: string, vars: Record<string, string>): string {
  return value.replace(/\$\{([^}]+)\}/g, (_m, key) => vars[key] ?? `\${${key}}`);
}

function collectArgs(
  args: ArgumentValue[] | undefined,
  plat: PlatformInfo,
  features: Record<string, boolean>,
  vars: Record<string, string>,
): string[] {
  if (!args) return [];
  const out: string[] = [];
  for (const arg of args) {
    if (typeof arg === 'string') {
      out.push(substitute(arg, vars));
    } else if (rulesAllow(arg.rules, plat, features)) {
      const vals = Array.isArray(arg.value) ? arg.value : [arg.value];
      for (const v of vals) out.push(substitute(v, vars));
    }
  }
  return out;
}

/** Build the full JVM + game argument vector for launching the client. */
export function buildLaunchArgs(input: BuildArgsInput): string[] {
  const { paths, plat, version, instanceDir, options } = input;
  const account: Account = options.account;
  const sep = classpathSeparator();
  const classpath = buildClasspath(input).join(sep);
  const nativesDir = versionNativesDir(paths, input.nativesVersionId);

  const features: Record<string, boolean> = {
    is_demo_user: false,
    has_custom_resolution: Boolean(options.resolution),
  };

  const vars: Record<string, string> = {
    natives_directory: nativesDir,
    launcher_name: 'BalumbaCraft',
    launcher_version: '1.0.0',
    classpath,
    classpath_separator: sep,
    library_directory: paths.libraries,
    // Must match the client jar's filename on the classpath (<base>.jar) so
    // NeoForge's `-DignoreList=client-extra,${version_name}.jar` excludes it
    // from module resolution; otherwise the vanilla jar becomes an automatic
    // module that clashes with the patched `minecraft` module.
    version_name: input.nativesVersionId,
    game_directory: instanceDir,
    assets_root: paths.assets,
    assets_index_name: version.assets,
    auth_player_name: account.username,
    auth_uuid: undashUuid(account.uuid),
    auth_access_token: account.accessToken ?? '0',
    auth_xuid: '',
    clientid: '',
    user_type: account.type === 'microsoft' ? 'msa' : 'legacy',
    version_type: version.type,
    resolution_width: String(options.resolution?.width ?? 854),
    resolution_height: String(options.resolution?.height ?? 480),
  };

  const jvm: string[] = [];
  jvm.push(`-Xmx${options.maxRamMb}M`);
  if (options.minRamMb) jvm.push(`-Xms${options.minRamMb}M`);

  if (version.arguments?.jvm) {
    jvm.push(...collectArgs(version.arguments.jvm, plat, features, vars));
  } else {
    // Legacy fallback (<1.13): no jvm args block.
    jvm.push(`-Djava.library.path=${nativesDir}`, '-cp', classpath);
  }

  // Sensible extra defaults + user args.
  jvm.push(`-Dminecraft.launcher.brand=BalumbaCraft`);
  // LWJGL's own library-path property. Its java.library.path lookup expects a
  // nested layout, so point LWJGL directly at our flat extracted natives dir.
  jvm.push(`-Dorg.lwjgl.librarypath=${nativesDir}`);
  if (options.extraJvmArgs?.length) jvm.push(...options.extraJvmArgs);

  const mainClass = version.mainClass;

  let game: string[] = [];
  if (version.arguments?.game) {
    game = collectArgs(version.arguments.game, plat, features, vars);
  } else if (version.minecraftArguments) {
    game = version.minecraftArguments.split(' ').map((a) => substitute(a, vars));
  }

  if (options.quickConnect) {
    game.push('--quickPlayMultiplayer', `${options.quickConnect.host}:${options.quickConnect.port}`);
  }

  return [...jvm, mainClass, ...game];
}

void join;
