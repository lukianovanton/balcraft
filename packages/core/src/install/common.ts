import type { PlatformInfo } from '../types.js';
import type { Library, OsRule } from './mojang-types.js';

/** Mojang OS name for the current platform. */
export function mojangOsName(plat: PlatformInfo): string {
  return plat.os; // 'windows' | 'osx' | 'linux'
}

/** Evaluate a list of allow/disallow OS rules for the current platform. */
export function rulesAllow(
  rules: OsRule[] | undefined,
  plat: PlatformInfo,
  features: Record<string, boolean> = {},
): boolean {
  if (!rules || rules.length === 0) return true;
  let allowed = false;
  for (const rule of rules) {
    let matches = true;
    if (rule.os) {
      if (rule.os.name && rule.os.name !== mojangOsName(plat)) matches = false;
      if (rule.os.arch && rule.os.arch !== plat.arch) matches = false;
    }
    if (rule.features) {
      for (const [k, v] of Object.entries(rule.features)) {
        if (Boolean(features[k]) !== v) matches = false;
      }
    }
    if (matches) allowed = rule.action === 'allow';
  }
  return allowed;
}

/** True if a library applies to the current platform. */
export function libraryAllowed(lib: Library, plat: PlatformInfo): boolean {
  return rulesAllow(lib.rules, plat);
}

/** The native classifier key for the current OS, e.g. "natives-windows". */
export function nativeClassifier(lib: Library, plat: PlatformInfo): string | null {
  if (lib.natives) {
    const key = lib.natives[mojangOsName(plat)];
    if (key) return key.replace('${arch}', plat.arch === 'x86' ? '32' : '64');
  }
  return null;
}

/** OS token used in modern LWJGL native classifiers (macos, not osx). */
function classifierOs(plat: PlatformInfo): string {
  return plat.os === 'osx' ? 'macos' : plat.os;
}

/**
 * The exact modern native classifier for this platform, e.g.:
 *   windows x64 -> "natives-windows", windows x86 -> "natives-windows-x86",
 *   windows arm64 -> "natives-windows-arm64", macos arm64 -> "natives-macos-arm64".
 */
export function expectedNativeClassifier(plat: PlatformInfo): string {
  const base = `natives-${classifierOs(plat)}`;
  if (plat.arch === 'arm64') return `${base}-arm64`;
  if (plat.arch === 'x86') return `${base}-x86`;
  return base; // x64
}

/** The classifier segment of a maven name (4th `:` field), or null. */
export function libClassifier(lib: Library): string | null {
  const parts = lib.name.split(':');
  return parts.length >= 4 ? parts[3] : null;
}

/** True if the library is a native-classifier artifact for ANY platform. */
export function isNativeLib(lib: Library): boolean {
  const c = libClassifier(lib);
  return c != null && c.startsWith('natives-');
}

/**
 * True if the library is the modern (1.19+) natives artifact matching THIS
 * platform+arch exactly. Rules in modern version jsons only gate by OS name, so
 * we must compare the arch-specific classifier to avoid extracting a 32-bit dll
 * over the 64-bit one.
 */
export function isModernNativeLib(lib: Library, plat: PlatformInfo): boolean {
  return libClassifier(lib) === expectedNativeClassifier(plat);
}

/**
 * True if a library should be excluded entirely for this platform because it is
 * a native artifact for a different arch (e.g. natives-windows-x86 on x64).
 */
export function isWrongArchNativeLib(lib: Library, plat: PlatformInfo): boolean {
  return isNativeLib(lib) && libClassifier(lib) !== expectedNativeClassifier(plat);
}

/**
 * Convert a Maven coordinate ("group:artifact:version[:classifier][@ext]")
 * into a repository-relative path using forward slashes.
 */
export function mavenToPath(name: string): string {
  let ext = 'jar';
  let coord = name;
  const atIdx = coord.indexOf('@');
  if (atIdx >= 0) {
    ext = coord.slice(atIdx + 1);
    coord = coord.slice(0, atIdx);
  }
  const parts = coord.split(':');
  const [group, artifact, version] = parts;
  const classifier = parts[3];
  const groupPath = group.replace(/\./g, '/');
  const fileName = classifier
    ? `${artifact}-${version}-${classifier}.${ext}`
    : `${artifact}-${version}.${ext}`;
  return `${groupPath}/${artifact}/${version}/${fileName}`;
}
