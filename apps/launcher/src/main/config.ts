/**
 * Static configuration for the BalumbaCraft launcher.
 * Values marked TODO are filled in during later phases.
 */
export const APP_CONFIG = {
  /** Instance id used on disk. */
  instanceId: 'balumbacraft',
  displayName: 'BalumbaCraft',

  minecraftVersion: '1.21.1',
  loader: 'neoforge' as const,
  /** NeoForge version for MC 1.21.1 (matches the Modrinth "Сборка" profile). */
  neoforgeVersion: '21.1.232',

  /** File name of the manifest committed to the pack repo's main branch. */
  manifestFile: 'manifest.json',

  /**
   * Default pack repo baked into the distributed launcher so every friend knows
   * where to read the manifest. The admin can override in settings; friends use
   * these. Create this PUBLIC repo before publishing.
   */
  defaultGithubOwner: 'lukianovanton',
  defaultGithubRepo: 'balcraft',

  /** Default Azure AD application id (can be overridden in settings). */
  defaultAzureClientId: '',

  /** Defaults. */
  defaultRamMb: 6144,
  minRamFloorMb: 2048,
} as const;

/** Minimal shape of settings this module needs (avoids importing the full type). */
interface GithubSettings {
  githubOwner: string;
  githubRepo: string;
  azureClientId: string;
}

/** Effective pack repo: per-machine settings override the baked-in default. */
export function effectiveRepo(s: GithubSettings): { owner: string; repo: string } {
  return {
    owner: s.githubOwner || APP_CONFIG.defaultGithubOwner,
    repo: s.githubRepo || APP_CONFIG.defaultGithubRepo,
  };
}

/** True once a pack repo is known (default or configured). */
export function isGithubConfigured(s: GithubSettings): boolean {
  const { owner, repo } = effectiveRepo(s);
  return !!owner && !!repo;
}

/**
 * URL the launcher reads the pack manifest from — a plain file on the repo's
 * main branch (mods are hosted on Modrinth's CDN, so only this small file lives
 * in GitHub).
 */
export function manifestUrl(s: GithubSettings): string {
  const { owner, repo } = effectiveRepo(s);
  return `https://raw.githubusercontent.com/${owner}/${repo}/main/${APP_CONFIG.manifestFile}`;
}

/** Effective Azure client id (settings override the built-in default). */
export function azureClientId(s: GithubSettings): string {
  return s.azureClientId || APP_CONFIG.defaultAzureClientId;
}

/** True once an Azure Client ID is available, enabling Microsoft login. */
export function isMicrosoftConfigured(s: GithubSettings): boolean {
  return !!azureClientId(s);
}
