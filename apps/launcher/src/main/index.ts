import { app, BrowserWindow, shell } from 'electron';
import { join } from 'node:path';
import { Store } from './store.js';
import { LaunchController } from './launch-controller.js';
import { ServerManager } from './server-manager.js';
import { AuthService } from './auth-service.js';
import { ContentService } from './content-service.js';
import { registerIpc } from './ipc.js';
import { GameService } from './game-service.js';
import { initSelfUpdate } from './updater.js';
import { APP_CONFIG } from './config.js';
import { IPC } from '../shared/ipc.js';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 940,
    minHeight: 620,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#1a1410',
    title: APP_CONFIG.displayName,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on('ready-to-show', () => mainWindow?.show());

  // Open external links in the default browser, not inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) {
    void mainWindow.loadURL(devUrl);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

async function bootstrap(): Promise<void> {
  const store = new Store();
  await store.load();

  const launch = new LaunchController();
  const server = new ServerManager(store);
  const auth = new AuthService(store, (account) => {
    mainWindow?.webContents.send(IPC.evtMsLoginDone, account);
  });

  // Wires the install/launch pipeline into the controller.
  new GameService(store, auth, launch);
  const content = new ContentService();

  registerIpc({ store, auth, launch, server, content, getWindow: () => mainWindow });

  createWindow();
  initSelfUpdate();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}

// Single-instance lock so friends don't accidentally launch two copies.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(bootstrap).catch((err) => {
    console.error('Failed to start BalumbaCraft:', err);
    app.quit();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
