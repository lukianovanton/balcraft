import { ipcMain, type BrowserWindow } from 'electron';
import os from 'node:os';
import { app } from 'electron';
import { IPC, type LauncherSettings } from '../shared/ipc.js';
import { APP_CONFIG, isMicrosoftConfigured } from './config.js';
import type { Store } from './store.js';
import type { AuthService } from './auth-service.js';
import type { LaunchController } from './launch-controller.js';
import type { ServerManager } from './server-manager.js';

export interface Services {
  store: Store;
  auth: AuthService;
  launch: LaunchController;
  server: ServerManager;
  getWindow(): BrowserWindow | null;
}

export function registerIpc(services: Services): void {
  const { store, auth, launch, server, getWindow } = services;

  // Forward main-side events to the renderer.
  const send = (channel: string, payload: unknown) => {
    getWindow()?.webContents.send(channel, payload);
  };
  launch.on('state', (s) => send(IPC.evtLaunchState, s));
  server.on('state', (s) => send(IPC.evtServerState, s));
  server.on('log', (line: string) => send(IPC.evtServerLog, line));

  // --- accounts ---
  ipcMain.handle(IPC.listAccounts, () => store.listAccounts());
  ipcMain.handle(IPC.addOfflineAccount, (_e, username: string) => auth.addOffline(username));
  ipcMain.handle(IPC.beginMicrosoftLogin, () => auth.beginMicrosoft());

  ipcMain.handle(IPC.removeAccount, (_e, id: string) => store.removeAccount(id));
  ipcMain.handle(IPC.selectAccount, (_e, id: string) => store.selectAccount(id));
  ipcMain.handle(IPC.getSelectedAccountId, () => store.getSelectedAccountId());

  // --- settings ---
  ipcMain.handle(IPC.getSettings, () => store.getSettings());
  ipcMain.handle(IPC.saveSettings, (_e, patch: Partial<LauncherSettings>) =>
    store.saveSettings(patch),
  );
  ipcMain.handle(IPC.getSystemInfo, () => ({
    totalRamMb: Math.round(os.totalmem() / (1024 * 1024)),
    cpuCount: os.cpus().length,
    appVersion: app.getVersion(),
    microsoftEnabled: isMicrosoftConfigured(),
  }));

  // --- play ---
  ipcMain.handle(IPC.play, () => launch.play());
  ipcMain.handle(IPC.cancelLaunch, () => launch.cancel());
  ipcMain.handle(IPC.getLaunchState, () => launch.getState());

  // --- server ---
  ipcMain.handle(IPC.getServerState, () => server.getState());
  ipcMain.handle(IPC.startServer, () => server.start());
  ipcMain.handle(IPC.stopServer, () => server.stop());
  ipcMain.handle(IPC.sendServerCommand, (_e, cmd: string) => server.sendCommand(cmd));
  ipcMain.handle(IPC.addToWhitelist, (_e, u: string) => server.addToWhitelist(u));
  ipcMain.handle(IPC.removeFromWhitelist, (_e, u: string) => server.removeFromWhitelist(u));

  void APP_CONFIG; // referenced by later phases
}
