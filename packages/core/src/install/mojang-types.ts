/** Subset of Mojang piston-meta JSON shapes we consume. */

export interface VersionManifest {
  latest: { release: string; snapshot: string };
  versions: VersionManifestEntry[];
}

export interface VersionManifestEntry {
  id: string;
  type: string;
  url: string;
  sha1: string;
}

export interface DownloadInfo {
  path?: string;
  sha1: string;
  size: number;
  url: string;
}

export interface OsRule {
  action: 'allow' | 'disallow';
  os?: { name?: string; arch?: string; version?: string };
  features?: Record<string, boolean>;
}

export interface Library {
  name: string;
  downloads?: {
    artifact?: DownloadInfo;
    classifiers?: Record<string, DownloadInfo>;
  };
  rules?: OsRule[];
  natives?: Record<string, string>;
  extract?: { exclude?: string[] };
  // Legacy Forge-style direct url + no downloads
  url?: string;
}

export interface AssetIndexRef {
  id: string;
  sha1: string;
  size: number;
  totalSize: number;
  url: string;
}

export interface AssetObject {
  hash: string;
  size: number;
}

export interface AssetIndex {
  objects: Record<string, AssetObject>;
  map_to_resources?: boolean;
  virtual?: boolean;
}

/** An argument that may be a plain string or a conditional rule object. */
export type ArgumentValue = string | { rules: OsRule[]; value: string | string[] };

export interface VersionJson {
  id: string;
  mainClass: string;
  type: string;
  assets: string;
  assetIndex: AssetIndexRef;
  javaVersion?: { component: string; majorVersion: number };
  downloads: {
    client: DownloadInfo;
    server?: DownloadInfo;
  };
  libraries: Library[];
  minecraftArguments?: string; // legacy (<1.13)
  arguments?: {
    game: ArgumentValue[];
    jvm: ArgumentValue[];
  };
  /** Present on modded (NeoForge) child version jsons. */
  inheritsFrom?: string;
  logging?: unknown;
}
