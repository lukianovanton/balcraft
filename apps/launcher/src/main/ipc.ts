import { ipcMain, type BrowserWindow } from 'electron';
import os from 'node:os';
import { app } from 'electron';
import { IPC, type LauncherSettings } from '../shared/ipc.js';
import { isMicrosoftConfigured } from './config.js';
import { DEFAULT_CHICKEN_PROMPT } from './chicken-brain.js';
import type { Store } from './store.js';
import type { AuthService } from './auth-service.js';
import type { LaunchController } from './launch-controller.js';
import type { ServerManager } from './server-manager.js';
import type { ContentService } from './content-service.js';
import type { GameService } from './game-service.js';
import type { PackAdminService } from './pack-admin-service.js';
import { installLauncherUpdate } from './updater.js';
import { dialog } from 'electron';

export interface Services {
  store: Store;
  auth: AuthService;
  launch: LaunchController;
  server: ServerManager;
  content: ContentService;
  game: GameService;
  packAdmin: PackAdminService;
  getWindow(): BrowserWindow | null;
}

export function registerIpc(services: Services): void {
  const { store, auth, launch, server, content, game, packAdmin, getWindow } = services;

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
  ipcMain.handle(IPC.getSettings, () => store.getSafeSettings());
  ipcMain.handle(IPC.saveSettings, (_e, patch: Partial<LauncherSettings>) =>
    store.saveSettings(patch),
  );
  ipcMain.handle(IPC.getSystemInfo, () => ({
    totalRamMb: Math.round(os.totalmem() / (1024 * 1024)),
    cpuCount: os.cpus().length,
    appVersion: app.getVersion(),
    microsoftEnabled: isMicrosoftConfigured(store.getSettings()),
    defaultChickenPrompt: DEFAULT_CHICKEN_PROMPT,
  }));

  // --- play ---
  ipcMain.handle(IPC.play, () => launch.play());
  ipcMain.handle(IPC.cancelLaunch, () => launch.cancel());
  ipcMain.handle(IPC.getLaunchState, () => launch.getState());

  // --- admin: shared pack ---
  ipcMain.handle(IPC.listPackEntries, () => packAdmin.listEntries());
  ipcMain.handle(IPC.addPackProject, (_e, projectId: string, type) =>
    packAdmin.addProject(projectId, type),
  );
  ipcMain.handle(IPC.removePackProject, (_e, projectId: string) =>
    packAdmin.removeProject(projectId),
  );
  ipcMain.handle(IPC.setPackSide, (_e, projectId: string, side) =>
    packAdmin.setSide(projectId, side),
  );
  ipcMain.handle(IPC.importPackFolder, async () => {
    const win = getWindow();
    const res = await dialog.showOpenDialog(win!, {
      title: 'Выбери папку mods для импорта',
      properties: ['openDirectory'],
    });
    if (res.canceled || !res.filePaths[0]) return null;
    return packAdmin.importFromFolder(res.filePaths[0]);
  });
  ipcMain.handle(IPC.publishPack, () => packAdmin.publish());
  ipcMain.handle(IPC.checkAdminAccess, () => packAdmin.checkAdminAccess());

  // --- updates ---
  ipcMain.handle(IPC.getPackStatus, () => game.getPackStatus());
  ipcMain.handle(IPC.installLauncherUpdate, () => installLauncherUpdate());

  // --- content manager ---
  ipcMain.handle(IPC.searchContent, (_e, query: string, type) => content.search(query, type));
  ipcMain.handle(IPC.listInstalledContent, () => content.listInstalled());
  ipcMain.handle(IPC.installContent, (_e, projectId: string, type) =>
    content.install(projectId, type),
  );
  ipcMain.handle(IPC.removeContent, (_e, projectId: string) => content.remove(projectId));

  // --- server ---
  ipcMain.handle(IPC.getServerState, () => server.getState());
  ipcMain.handle(IPC.startServer, () => server.start());
  ipcMain.handle(IPC.stopServer, () => server.stop());
  ipcMain.handle(IPC.sendServerCommand, (_e, cmd: string) => server.sendCommand(cmd));
  ipcMain.handle(IPC.addToWhitelist, (_e, u: string) => server.addToWhitelist(u));
  ipcMain.handle(IPC.removeFromWhitelist, (_e, u: string) => server.removeFromWhitelist(u));
}
