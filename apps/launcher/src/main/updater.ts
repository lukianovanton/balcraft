import { app } from 'electron';
import pkg from 'electron-updater';

const { autoUpdater } = pkg;

/**
 * Check for launcher self-updates (separate from pack/mod updates) via the
 * GitHub Releases feed configured in electron-builder.yml. Best-effort: only
 * runs in a packaged build and never throws into the app.
 */
export function initSelfUpdate(): void {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.on('error', (err) => console.warn('[updater]', err?.message ?? err));
  autoUpdater.on('update-available', (info) =>
    console.log('[updater] доступно обновление лаунчера:', info.version),
  );
  autoUpdater.on('update-downloaded', () => {
    // Install on next quit; friends get updates transparently.
    console.log('[updater] обновление загружено, будет установлено при выходе.');
  });
  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.warn('[updater] проверка обновлений не удалась:', err?.message ?? err);
  });
}
