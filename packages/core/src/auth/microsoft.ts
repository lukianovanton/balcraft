import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { Account } from '../types.js';

/**
 * Microsoft OAuth 2.0 Device Code flow → Xbox Live → XSTS → Minecraft.
 * Used for licensed accounts. Requires an Azure "public client" application id
 * (see SETUP.md). No client secret is used (public/native client).
 */

const DEVICECODE_URL = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode';
const TOKEN_URL = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';
const XBL_URL = 'https://user.auth.xboxlive.com/user/authenticate';
const XSTS_URL = 'https://xsts.auth.xboxlive.com/xsts/authorize';
const MC_LOGIN_URL = 'https://api.minecraftservices.com/authentication/login_with_xbox';
const MC_PROFILE_URL = 'https://api.minecraftservices.com/minecraft/profile';
const SCOPE = 'XboxLive.signin offline_access';

export interface DeviceCodeInfo {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  message: string;
  expiresIn: number;
  interval: number;
}

interface MsToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

async function postForm(url: string, form: Record<string, string>): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form).toString(),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

async function postJson(url: string, body: unknown, headers: Record<string, string> = {}): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

/** Step 1: request a device code the user enters at the verification URL. */
export async function startDeviceCode(clientId: string): Promise<DeviceCodeInfo> {
  const { ok, json } = await postForm(DEVICECODE_URL, { client_id: clientId, scope: SCOPE });
  if (!ok || !json.device_code) {
    throw new Error(`Не удалось начать вход Microsoft: ${json.error_description ?? 'неизвестная ошибка'}`);
  }
  return {
    deviceCode: json.device_code,
    userCode: json.user_code,
    verificationUri: json.verification_uri,
    message: json.message,
    expiresIn: json.expires_in,
    interval: json.interval ?? 5,
  };
}

/** Step 2: poll until the user authorizes (or the code expires / is aborted). */
export async function pollForMsToken(
  clientId: string,
  device: DeviceCodeInfo,
  signal?: AbortSignal,
): Promise<MsToken> {
  let interval = device.interval;
  const deadline = Date.now() + device.expiresIn * 1000;
  for (;;) {
    if (signal?.aborted) throw new Error('Вход отменён.');
    if (Date.now() > deadline) throw new Error('Время ожидания входа истекло.');
    await delay(interval * 1000);

    const { json } = await postForm(TOKEN_URL, {
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      client_id: clientId,
      device_code: device.deviceCode,
    });

    if (json.access_token) {
      return {
        accessToken: json.access_token,
        refreshToken: json.refresh_token,
        expiresIn: json.expires_in,
      };
    }
    switch (json.error) {
      case 'authorization_pending':
        break;
      case 'slow_down':
        interval += 5;
        break;
      case 'authorization_declined':
        throw new Error('Вход отклонён пользователем.');
      case 'expired_token':
        throw new Error('Код входа истёк, попробуйте снова.');
      default:
        if (json.error) throw new Error(`Ошибка входа: ${json.error_description ?? json.error}`);
    }
  }
}

/** Refresh an expired Microsoft token using the stored refresh token. */
async function refreshMsToken(clientId: string, refreshToken: string): Promise<MsToken> {
  const { ok, json } = await postForm(TOKEN_URL, {
    grant_type: 'refresh_token',
    client_id: clientId,
    scope: SCOPE,
    refresh_token: refreshToken,
  });
  if (!ok || !json.access_token) {
    throw new Error('Сессия Microsoft истекла, войдите заново.');
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? refreshToken,
    expiresIn: json.expires_in,
  };
}

/** Run the Xbox Live → XSTS → Minecraft chain and fetch the profile. */
async function msTokenToAccount(ms: MsToken, existingId?: string): Promise<Account> {
  // Xbox Live
  const xbl = await postJson(XBL_URL, {
    Properties: {
      AuthMethod: 'RPS',
      SiteName: 'user.auth.xboxlive.com',
      RpsTicket: `d=${ms.accessToken}`,
    },
    RelyingParty: 'http://auth.xboxlive.com',
    TokenType: 'JWT',
  });
  if (!xbl.ok || !xbl.json.Token) throw new Error('Не удалось авторизоваться в Xbox Live.');
  const xblToken: string = xbl.json.Token;
  const userHash: string = xbl.json.DisplayClaims.xui[0].uhs;

  // XSTS
  const xsts = await postJson(XSTS_URL, {
    Properties: { SandboxId: 'RETAIL', UserTokens: [xblToken] },
    RelyingParty: 'rp://api.minecraftservices.com/',
    TokenType: 'JWT',
  });
  if (!xsts.ok || !xsts.json.Token) {
    const xerr = xsts.json?.XErr;
    if (xerr === 2148916233) throw new Error('У аккаунта Microsoft нет профиля Xbox.');
    if (xerr === 2148916238) throw new Error('Детский аккаунт: добавьте его в семью Microsoft.');
    throw new Error('Не удалось получить XSTS-токен Xbox.');
  }
  const xstsToken: string = xsts.json.Token;

  // Minecraft login
  const mc = await postJson(MC_LOGIN_URL, {
    identityToken: `XBL3.0 x=${userHash};${xstsToken}`,
  });
  if (!mc.ok || !mc.json.access_token) throw new Error('Не удалось войти в Minecraft services.');
  const mcToken: string = mc.json.access_token;
  const mcExpiresIn: number = mc.json.expires_in ?? 86400;

  // Profile (owns the game?)
  const profRes = await fetch(MC_PROFILE_URL, {
    headers: { Authorization: `Bearer ${mcToken}` },
  });
  if (profRes.status === 404) {
    throw new Error('На этом аккаунте нет купленного Minecraft.');
  }
  const prof = (await profRes.json()) as { id?: string; name?: string };
  if (!prof.id || !prof.name) throw new Error('Не удалось получить профиль Minecraft.');

  const uuid = dashUuid(prof.id);
  return {
    id: existingId ?? randomUUID(),
    type: 'microsoft',
    username: prof.name,
    uuid,
    accessToken: mcToken,
    refreshToken: ms.refreshToken,
    expiresAt: Date.now() + mcExpiresIn * 1000,
  };
}

/** Insert dashes into a 32-char hex UUID. */
function dashUuid(hex: string): string {
  if (hex.includes('-')) return hex;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Full device-code login: obtain the code (delivered via `onCode`), wait for the
 * user, then resolve to a ready-to-launch Minecraft account.
 */
export async function loginMicrosoftDeviceCode(
  clientId: string,
  onCode: (info: DeviceCodeInfo) => void,
  signal?: AbortSignal,
): Promise<Account> {
  const device = await startDeviceCode(clientId);
  onCode(device);
  const ms = await pollForMsToken(clientId, device, signal);
  return msTokenToAccount(ms);
}

/** Ensure a Microsoft account's Minecraft token is valid, refreshing if needed. */
export async function ensureFreshMicrosoft(clientId: string, account: Account): Promise<Account> {
  if (account.type !== 'microsoft') return account;
  const stillValid = account.expiresAt && account.expiresAt - Date.now() > 60_000;
  if (stillValid && account.accessToken) return account;
  if (!account.refreshToken) throw new Error('Сессия Microsoft истекла, войдите заново.');
  const ms = await refreshMsToken(clientId, account.refreshToken);
  return msTokenToAccount(ms, account.id);
}
