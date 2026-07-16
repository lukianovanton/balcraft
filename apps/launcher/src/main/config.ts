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

  /** Public GitHub repo hosting the pack manifest + files (Phase 4). */
  github: {
    owner: 'CHANGE_ME',
    repo: 'balumbacraft-pack',
    /** Release tag or "latest" that the launcher reads the manifest from. */
    manifestAsset: 'manifest.json',
  },

  /** Azure AD application (public client) for Microsoft login (Phase 5). */
  azureClientId: 'CHANGE_ME',

  /** Defaults. */
  defaultRamMb: 6144,
  minRamFloorMb: 2048,
} as const;

/** URL to the latest published pack manifest on GitHub Releases. */
export function manifestUrl(): string {
  const { owner, repo, manifestAsset } = APP_CONFIG.github;
  return `https://github.com/${owner}/${repo}/releases/latest/download/${manifestAsset}`;
}

/** True once the pack's GitHub repo has been configured (not the placeholder). */
export function isGithubConfigured(): boolean {
  return APP_CONFIG.github.owner !== 'CHANGE_ME';
}

/** True once an Azure Client ID is set, enabling Microsoft login. */
export function isMicrosoftConfigured(): boolean {
  return APP_CONFIG.azureClientId !== 'CHANGE_ME';
}
