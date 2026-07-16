import { app, safeStorage } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Account } from '@balumba/core';
import { ensureDir } from '@balumba/core';
import type { LauncherSettings, SafeSettings } from '../shared/ipc.js';
import { APP_CONFIG } from './config.js';

const DEFAULT_SETTINGS: LauncherSettings = {
  maxRamMb: APP_CONFIG.defaultRamMb,
  minRamMb: 1024,
  extraJvmArgs: [],
  javaPathOverride: '',
  closeOnLaunch: false,
  resolution: null,
  serverRamMb: 4096,
  serverViewDistance: 10,
  serverMaxPlayers: 10,
  serverMotd: 'BalumbaCraft — Create',
  serverPublicAddress: '',
  adminMode: false,
  githubOwner: '',
  githubRepo: '',
  githubToken: '',
  azureClientId: '',
};

interface PersistedState {
  settings: LauncherSettings;
  accounts: Account[];
  selectedAccountId: string | null;
}

/**
 * Simple JSON-backed store for settings + accounts. Microsoft tokens are
 * encrypted at rest with Electron safeStorage (OS-level) when available.
 */
export class Store {
  private state: PersistedState = {
    settings: { ...DEFAULT_SETTINGS },
    accounts: [],
    selectedAccountId: null,
  };

  private get file(): string {
    return join(app.getPath('userData'), 'balumba-state.json');
  }

  async load(): Promise<void> {
    try {
      const raw = await readFile(this.file, 'utf8');
      const parsed = JSON.parse(raw) as PersistedState;
      const settings = { ...DEFAULT_SETTINGS, ...parsed.settings };
      settings.githubToken = this.decStr(settings.githubToken) ?? '';
      this.state = {
        settings,
        accounts: (parsed.accounts ?? []).map((a) => this.decryptAccount(a)),
        selectedAccountId: parsed.selectedAccountId ?? null,
      };
    } catch {
      // first run / corrupt file — start fresh
      this.state = { settings: { ...DEFAULT_SETTINGS }, accounts: [], selectedAccountId: null };
    }
  }

  private async persist(): Promise<void> {
    await ensureDir(app.getPath('userData'));
    const toSave: PersistedState = {
      settings: { ...this.state.settings, githubToken: this.encStr(this.state.settings.githubToken) ?? '' },
      accounts: this.state.accounts.map((a) => this.encryptAccount(a)),
      selectedAccountId: this.state.selectedAccountId,
    };
    await writeFile(this.file, JSON.stringify(toSave, null, 2), 'utf8');
  }

  // --- token encryption helpers ---
  private encStr(v?: string): string | undefined {
    if (!v || v.startsWith('enc:') || !safeStorage.isEncryptionAvailable()) return v;
    return `enc:${safeStorage.encryptString(v).toString('base64')}`;
  }

  private decStr(v?: string): string | undefined {
    if (!v || !v.startsWith('enc:') || !safeStorage.isEncryptionAvailable()) return v;
    return safeStorage.decryptString(Buffer.from(v.slice(4), 'base64'));
  }

  private encryptAccount(a: Account): Account {
    if (a.type !== 'microsoft') return a;
    return { ...a, accessToken: this.encStr(a.accessToken), refreshToken: this.encStr(a.refreshToken) };
  }

  private decryptAccount(a: Account): Account {
    if (a.type !== 'microsoft') return a;
    return { ...a, accessToken: this.decStr(a.accessToken), refreshToken: this.decStr(a.refreshToken) };
  }

  // --- settings ---
  getSettings(): LauncherSettings {
    return this.state.settings;
  }

  /** Settings for the renderer, with the raw token replaced by a boolean. */
  getSafeSettings(): SafeSettings {
    const { githubToken, ...rest } = this.state.settings;
    return { ...rest, hasGithubToken: !!githubToken };
  }

  async saveSettings(patch: Partial<LauncherSettings>): Promise<SafeSettings> {
    this.state.settings = { ...this.state.settings, ...patch };
    await this.persist();
    return this.getSafeSettings();
  }

  // --- accounts ---
  listAccounts(): Account[] {
    return this.state.accounts;
  }

  getAccount(id: string): Account | undefined {
    return this.state.accounts.find((a) => a.id === id);
  }

  async upsertAccount(account: Account): Promise<Account> {
    const idx = this.state.accounts.findIndex((a) => a.id === account.id);
    if (idx >= 0) this.state.accounts[idx] = account;
    else this.state.accounts.push(account);
    if (!this.state.selectedAccountId) this.state.selectedAccountId = account.id;
    await this.persist();
    return account;
  }

  async removeAccount(id: string): Promise<void> {
    this.state.accounts = this.state.accounts.filter((a) => a.id !== id);
    if (this.state.selectedAccountId === id) {
      this.state.selectedAccountId = this.state.accounts[0]?.id ?? null;
    }
    await this.persist();
  }

  getSelectedAccountId(): string | null {
    return this.state.selectedAccountId;
  }

  getSelectedAccount(): Account | undefined {
    const id = this.state.selectedAccountId;
    return id ? this.getAccount(id) : undefined;
  }

  async selectAccount(id: string): Promise<void> {
    if (this.getAccount(id)) {
      this.state.selectedAccountId = id;
      await this.persist();
    }
  }
}
