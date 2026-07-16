import { app, safeStorage } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Account } from '@balumba/core';
import { ensureDir } from '@balumba/core';
import type { LauncherSettings } from '../shared/ipc.js';
import { APP_CONFIG } from './config.js';

const DEFAULT_SETTINGS: LauncherSettings = {
  maxRamMb: APP_CONFIG.defaultRamMb,
  minRamMb: 1024,
  extraJvmArgs: [],
  javaPathOverride: '',
  closeOnLaunch: false,
  resolution: null,
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
      this.state = {
        settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
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
      ...this.state,
      accounts: this.state.accounts.map((a) => this.encryptAccount(a)),
    };
    await writeFile(this.file, JSON.stringify(toSave, null, 2), 'utf8');
  }

  // --- token encryption helpers ---
  private encryptAccount(a: Account): Account {
    if (a.type !== 'microsoft' || !safeStorage.isEncryptionAvailable()) return a;
    const enc = (v?: string) =>
      v ? `enc:${safeStorage.encryptString(v).toString('base64')}` : v;
    return { ...a, accessToken: enc(a.accessToken), refreshToken: enc(a.refreshToken) };
  }

  private decryptAccount(a: Account): Account {
    if (a.type !== 'microsoft' || !safeStorage.isEncryptionAvailable()) return a;
    const dec = (v?: string) =>
      v && v.startsWith('enc:')
        ? safeStorage.decryptString(Buffer.from(v.slice(4), 'base64'))
        : v;
    return { ...a, accessToken: dec(a.accessToken), refreshToken: dec(a.refreshToken) };
  }

  // --- settings ---
  getSettings(): LauncherSettings {
    return this.state.settings;
  }

  async saveSettings(patch: Partial<LauncherSettings>): Promise<LauncherSettings> {
    this.state.settings = { ...this.state.settings, ...patch };
    await this.persist();
    return this.state.settings;
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
