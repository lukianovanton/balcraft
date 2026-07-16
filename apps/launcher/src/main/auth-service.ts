import { randomUUID } from 'node:crypto';
import {
  loginMicrosoftDeviceCode,
  ensureFreshMicrosoft,
  offlineUuid,
  type Account,
  type DeviceCodeInfo,
} from '@balumba/core';
import { azureClientId, isMicrosoftConfigured } from './config.js';
import type { Store } from './store.js';

/**
 * Owns account creation and Microsoft token lifecycle. The Microsoft login runs
 * as a background device-code flow: `beginMicrosoftLogin` returns the code to
 * show the user, and completion is delivered via the `onComplete` callback.
 */
export class AuthService {
  private msAbort: AbortController | null = null;

  constructor(
    private store: Store,
    private onComplete: (account: Account | null) => void,
  ) {}

  get microsoftConfigured(): boolean {
    return isMicrosoftConfigured(this.store.getSettings());
  }

  async addOffline(username: string): Promise<Account> {
    const name = username.trim();
    if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) {
      throw new Error('Ник должен быть 3–16 символов: латиница, цифры, подчёркивание.');
    }
    return this.store.upsertAccount({
      id: randomUUID(),
      type: 'offline',
      username: name,
      uuid: offlineUuid(name),
    });
  }

  /**
   * Begin Microsoft login. Resolves with the device code to display, then
   * continues polling in the background; the result is delivered via onComplete.
   */
  async beginMicrosoft(): Promise<{ userCode: string; verificationUri: string; message: string }> {
    if (!this.microsoftConfigured) {
      throw new Error('Azure Client ID не настроен (Настройки → Microsoft-вход).');
    }
    const clientId = azureClientId(this.store.getSettings());
    this.msAbort?.abort();
    this.msAbort = new AbortController();
    const signal = this.msAbort.signal;

    return new Promise((resolve, reject) => {
      let delivered = false;
      const onCode = (info: DeviceCodeInfo) => {
        delivered = true;
        resolve({
          userCode: info.userCode,
          verificationUri: info.verificationUri,
          message: info.message,
        });
      };

      loginMicrosoftDeviceCode(clientId, onCode, signal)
        .then(async (account) => {
          await this.store.upsertAccount(account);
          this.onComplete(account);
        })
        .catch((err) => {
          if (!delivered) reject(err);
          else {
            console.warn('[auth] Microsoft login failed:', err?.message ?? err);
            this.onComplete(null);
          }
        });
    });
  }

  cancelMicrosoft(): void {
    this.msAbort?.abort();
    this.msAbort = null;
  }

  /** Refresh a Microsoft account's token before launch; persists the update. */
  async ensureLaunchable(account: Account): Promise<Account> {
    if (account.type !== 'microsoft') return account;
    const fresh = await ensureFreshMicrosoft(azureClientId(this.store.getSettings()), account);
    if (fresh !== account) await this.store.upsertAccount(fresh);
    return fresh;
  }
}
