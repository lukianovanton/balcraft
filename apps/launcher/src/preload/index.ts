import { contextBridge, ipcRenderer } from 'electron';
import type { Account } from '@balumba/core';
import {
  IPC,
  type BalumbaApi,
  type LaunchState,
  type LauncherSettings,
  type ServerState,
} from '../shared/ipc.js';

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_e: unknown, payload: T) => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api: BalumbaApi = {
  // accounts
  listAccounts: () => ipcRenderer.invoke(IPC.listAccounts),
  addOfflineAccount: (username) => ipcRenderer.invoke(IPC.addOfflineAccount, username),
  beginMicrosoftLogin: () => ipcRenderer.invoke(IPC.beginMicrosoftLogin),
  removeAccount: (id) => ipcRenderer.invoke(IPC.removeAccount, id),
  selectAccount: (id) => ipcRenderer.invoke(IPC.selectAccount, id),
  getSelectedAccountId: () => ipcRenderer.invoke(IPC.getSelectedAccountId),

  // settings
  getSettings: () => ipcRenderer.invoke(IPC.getSettings),
  saveSettings: (patch: Partial<LauncherSettings>) => ipcRenderer.invoke(IPC.saveSettings, patch),
  getSystemInfo: () => ipcRenderer.invoke(IPC.getSystemInfo),

  // play
  play: () => ipcRenderer.invoke(IPC.play),
  cancelLaunch: () => ipcRenderer.invoke(IPC.cancelLaunch),
  getLaunchState: () => ipcRenderer.invoke(IPC.getLaunchState),

  // content manager
  searchContent: (query, type) => ipcRenderer.invoke(IPC.searchContent, query, type),
  listInstalledContent: () => ipcRenderer.invoke(IPC.listInstalledContent),
  installContent: (projectId, type) => ipcRenderer.invoke(IPC.installContent, projectId, type),
  removeContent: (projectId) => ipcRenderer.invoke(IPC.removeContent, projectId),

  // server
  getServerState: () => ipcRenderer.invoke(IPC.getServerState),
  startServer: () => ipcRenderer.invoke(IPC.startServer),
  stopServer: () => ipcRenderer.invoke(IPC.stopServer),
  sendServerCommand: (command) => ipcRenderer.invoke(IPC.sendServerCommand, command),
  addToWhitelist: (username) => ipcRenderer.invoke(IPC.addToWhitelist, username),
  removeFromWhitelist: (username) => ipcRenderer.invoke(IPC.removeFromWhitelist, username),

  // events
  onLaunchState: (cb) => subscribe<LaunchState>(IPC.evtLaunchState, cb),
  onServerState: (cb) => subscribe<ServerState>(IPC.evtServerState, cb),
  onServerLog: (cb) => subscribe<string>(IPC.evtServerLog, cb),
  onMicrosoftLoginDone: (cb) => subscribe<Account | null>(IPC.evtMsLoginDone, cb),
};

contextBridge.exposeInMainWorld('balumba', api);
