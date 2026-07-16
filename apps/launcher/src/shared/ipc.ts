/**
 * Shared IPC contract between the Electron main process and the renderer.
 * Keep this file free of Node/Electron imports — it is imported by both sides.
 */
import type {
  Account,
  ProgressEvent,
  ModrinthHit,
  ModrinthProjectType,
  UserContentEntry,
  MasterEntry,
  Side,
} from '@balumba/core';

export interface PublishResult {
  version: string;
  fileCount: number;
  addedDeps: number;
}
export interface ImportResult {
  added: number;
  unresolved: string[];
}

/** Persisted user settings. */
export interface LauncherSettings {
  maxRamMb: number;
  minRamMb: number;
  extraJvmArgs: string[];
  /** Override auto-detected Java (empty = managed runtime). */
  javaPathOverride: string;
  /** Close launcher after the game starts. */
  closeOnLaunch: boolean;
  /** Keep game window resolution. */
  resolution: { width: number; height: number } | null;

  // --- server ---
  serverRamMb: number;
  serverViewDistance: number;
  serverMaxPlayers: number;
  serverMotd: string;
  /** Auto-start the Playit.gg agent when the server is running. */
  serverUseTunnel: boolean;
  /** Static public address friends connect to (e.g. xxx.craft.playit.gg). */
  serverPublicAddress: string;

  // --- admin / distribution (configured in-app, no code editing) ---
  /** Marks this machine as the pack admin (shows publish tools). */
  adminMode: boolean;
  /** GitHub repo hosting the pack manifest (public). */
  githubOwner: string;
  githubRepo: string;
  /** GitHub token with repo write access (admin only; encrypted at rest). */
  githubToken: string;
  /** Azure application (client) id for Microsoft login (optional). */
  azureClientId: string;
}

/** Settings safe to expose to the renderer (token redacted to a boolean). */
export interface SafeSettings extends Omit<LauncherSettings, 'githubToken'> {
  hasGithubToken: boolean;
}

export type LaunchStage =
  | 'idle'
  | 'checking'
  | 'installing-java'
  | 'installing-minecraft'
  | 'installing-loader'
  | 'syncing-pack'
  | 'launching'
  | 'running'
  | 'error';

export interface LaunchState {
  stage: LaunchStage;
  progress: ProgressEvent | null;
  error: string | null;
}

export interface PackStatus {
  configured: boolean;
  installedVersion: string | null;
  latestVersion: string | null;
  updateAvailable: boolean;
}

export type LauncherUpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface LauncherUpdateState {
  phase: LauncherUpdatePhase;
  percent?: number;
  version?: string;
}

export type ServerStatus = 'stopped' | 'starting' | 'running' | 'stopping';

export interface ServerState {
  status: ServerStatus;
  /** Public tunnel address for friends, if a tunnel is up. */
  publicAddress: string | null;
  /** Playit.gg claim URL shown on first run (link the agent to an account). */
  tunnelClaimUrl: string | null;
  players: string[];
  /** Whitelisted usernames. */
  whitelist: string[];
}

/** The API surface exposed to the renderer via `window.balumba`. */
export interface BalumbaApi {
  // --- accounts ---
  listAccounts(): Promise<Account[]>;
  addOfflineAccount(username: string): Promise<Account>;
  beginMicrosoftLogin(): Promise<{ userCode: string; verificationUri: string; message: string }>;
  removeAccount(id: string): Promise<void>;
  selectAccount(id: string): Promise<void>;
  getSelectedAccountId(): Promise<string | null>;

  // --- settings ---
  getSettings(): Promise<SafeSettings>;
  saveSettings(patch: Partial<LauncherSettings>): Promise<SafeSettings>;
  getSystemInfo(): Promise<{
    totalRamMb: number;
    cpuCount: number;
    appVersion: string;
    microsoftEnabled: boolean;
  }>;

  // --- play ---
  play(): Promise<void>;
  cancelLaunch(): Promise<void>;
  getLaunchState(): Promise<LaunchState>;

  // --- server ---
  getServerState(): Promise<ServerState>;
  startServer(): Promise<void>;
  stopServer(): Promise<void>;
  sendServerCommand(command: string): Promise<void>;
  addToWhitelist(username: string): Promise<void>;
  removeFromWhitelist(username: string): Promise<void>;

  // --- admin: shared pack ---
  listPackEntries(): Promise<MasterEntry[]>;
  addPackProject(projectId: string, type: ModrinthProjectType): Promise<MasterEntry[]>;
  removePackProject(projectId: string): Promise<MasterEntry[]>;
  setPackSide(projectId: string, side: Side): Promise<MasterEntry[]>;
  importPackFolder(): Promise<ImportResult | null>;
  publishPack(): Promise<PublishResult>;
  checkAdminAccess(): Promise<boolean>;

  // --- updates ---
  getPackStatus(): Promise<PackStatus>;
  installLauncherUpdate(): Promise<void>;
  onLauncherUpdate(cb: (s: LauncherUpdateState) => void): () => void;

  // --- content manager (Modrinth) ---
  searchContent(query: string, type: ModrinthProjectType): Promise<ModrinthHit[]>;
  listInstalledContent(): Promise<UserContentEntry[]>;
  installContent(projectId: string, type: ModrinthProjectType): Promise<UserContentEntry[]>;
  removeContent(projectId: string): Promise<UserContentEntry[]>;

  // --- events (main -> renderer) ---
  onLaunchState(cb: (s: LaunchState) => void): () => void;
  onServerState(cb: (s: ServerState) => void): () => void;
  onServerLog(cb: (line: string) => void): () => void;
  onMicrosoftLoginDone(cb: (account: Account | null) => void): () => void;
}

/** Channel name constants (single source of truth). */
export const IPC = {
  listAccounts: 'accounts:list',
  addOfflineAccount: 'accounts:add-offline',
  beginMicrosoftLogin: 'accounts:ms-begin',
  removeAccount: 'accounts:remove',
  selectAccount: 'accounts:select',
  getSelectedAccountId: 'accounts:get-selected',

  getSettings: 'settings:get',
  saveSettings: 'settings:save',
  getSystemInfo: 'system:info',

  play: 'play:start',
  cancelLaunch: 'play:cancel',
  getLaunchState: 'play:state',

  listPackEntries: 'pack:list',
  addPackProject: 'pack:add',
  removePackProject: 'pack:remove',
  setPackSide: 'pack:set-side',
  importPackFolder: 'pack:import-folder',
  publishPack: 'pack:publish',
  checkAdminAccess: 'pack:check-admin',

  getPackStatus: 'update:pack-status',
  installLauncherUpdate: 'update:install-launcher',
  evtLauncherUpdate: 'evt:launcher-update',

  searchContent: 'content:search',
  listInstalledContent: 'content:list',
  installContent: 'content:install',
  removeContent: 'content:remove',

  getServerState: 'server:state',
  startServer: 'server:start',
  stopServer: 'server:stop',
  sendServerCommand: 'server:command',
  addToWhitelist: 'server:whitelist-add',
  removeFromWhitelist: 'server:whitelist-remove',

  // events
  evtLaunchState: 'evt:launch-state',
  evtServerState: 'evt:server-state',
  evtServerLog: 'evt:server-log',
  evtMsLoginDone: 'evt:ms-login-done',
} as const;
