/**
 * Shared types for the BalumbaCraft launcher core.
 */

/** Which side a file/mod belongs to. */
export type Side = 'client' | 'server' | 'both';

/** A single managed file in a modpack manifest. */
export interface ManifestFile {
  /** Path relative to the game instance root, using forward slashes (e.g. "mods/create-1.21.1.jar"). */
  path: string;
  /** SHA-1 hex digest of the file contents. */
  sha1: string;
  /** File size in bytes. */
  size: number;
  /** Download URLs to try in order (first that works wins). */
  url: string[];
  /** Which side needs this file. */
  side: Side;
}

/** The modpack manifest published to GitHub Releases and consumed by the launcher. */
export interface PackManifest {
  /** Manifest schema version. */
  formatVersion: 1;
  /** Human name of the pack. */
  name: string;
  /** Pack content version (bump on every publish), e.g. "2026.07.16-1". */
  version: string;
  /** Minecraft version, e.g. "1.21.1". */
  minecraft: string;
  /** Mod loader. */
  loader: 'neoforge';
  /** Loader version, e.g. "21.1.172". */
  loaderVersion: string;
  /** Recommended minimum RAM in MB. */
  recommendedRamMb: number;
  /** All managed files (mods + overrides/configs). */
  files: ManifestFile[];
  /**
   * Managed directories the sync engine is allowed to prune. Any file inside one
   * of these dirs that is NOT in `files` (for the current side) gets removed.
   * Everything outside these dirs is left untouched (user configs, saves, etc.).
   */
  managedRoots: string[];
  /** ISO timestamp the manifest was generated (set by publisher, not in-launcher). */
  generatedAt: string;
}

/** Progress event emitted during long-running operations. */
export interface ProgressEvent {
  /** Stable id of the task, e.g. "install:neoforge". */
  taskId: string;
  /** Human-readable phase, e.g. "Downloading libraries". */
  phase: string;
  /** 0..1 overall fraction, or null if indeterminate. */
  progress: number | null;
  /** Optional current file / detail line. */
  detail?: string;
  /** Bytes downloaded so far in this task (optional). */
  bytesDone?: number;
  /** Total bytes for this task (optional). */
  bytesTotal?: number;
}

export type ProgressReporter = (e: ProgressEvent) => void;

/** OS/arch descriptor used for Java + native selection. */
export interface PlatformInfo {
  os: 'windows' | 'osx' | 'linux';
  arch: 'x64' | 'arm64' | 'x86';
}

/** A resolved Java runtime on disk. */
export interface JavaRuntime {
  /** Absolute path to the java(w) executable. */
  javaPath: string;
  /** Major version, e.g. 21. */
  majorVersion: number;
  /** Root directory of the runtime. */
  home: string;
}

/** Account used to launch the game. */
export interface Account {
  id: string;
  type: 'offline' | 'microsoft';
  username: string;
  uuid: string;
  /** Present only for microsoft accounts (kept encrypted at rest). */
  accessToken?: string;
  /** Epoch ms when the access token expires. */
  expiresAt?: number;
  /** Microsoft refresh token (encrypted at rest). */
  refreshToken?: string;
}

/** Options controlling a game launch. */
export interface LaunchOptions {
  account: Account;
  /** Max heap in MB. */
  maxRamMb: number;
  /** Min heap in MB. */
  minRamMb?: number;
  /** Extra JVM args appended after defaults. */
  extraJvmArgs?: string[];
  /** Server address to auto-connect on launch (optional). */
  quickConnect?: { host: string; port: number };
  /** Window size, if not fullscreen. */
  resolution?: { width: number; height: number };
}
