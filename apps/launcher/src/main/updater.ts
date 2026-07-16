import { app } from 'electron';
import pkg from 'electron-updater';
import type { LauncherUpdateState } from '../shared/ipc.js';

const { autoUpdater } = pkg;

/**
 * Check for launcher self-updates (separate from pack/mod updates) via the
 * GitHub Releases feed in electron-builder.yml, forwarding progress to the UI.
 * Best-effort: only runs in a packaged build and never throws into the app.
 */
export function initSelfUpdate(send: (s: LauncherUpdateState) => void): void {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.on('checking-for-update', () => send({ phase: 'checking' }));
  autoUpdater.on('update-available', (info) => send({ phase: 'available', version: info.version }));
  autoUpdater.on('update-not-available', () => send({ phase: 'idle' }));
  autoUpdater.on('download-progress', (p) =>
    send({ phase: 'downloading', percent: Math.round(p.percent) }),
  );
  autoUpdater.on('update-downloaded', (info) =>
    send({ phase: 'downloaded', version: info.version }),
  );
  autoUpdater.on('error', (err) => {
    console.warn('[updater]', err?.message ?? err);
    send({ phase: 'error' });
  });

  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.warn('[updater] проверка обновлений не удалась:', err?.message ?? err);
  });
}

/** Quit and install a downloaded launcher update. */
export function installLauncherUpdate(): void {
  autoUpdater.quitAndInstall();
}
