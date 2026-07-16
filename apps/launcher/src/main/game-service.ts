import { app } from 'electron';
import { join } from 'node:path';
import {
  LauncherPaths,
  ensureJavaRuntime,
  installVanilla,
  installNeoForge,
  syncPack,
  ensureServerInList,
  spawnGame,
  type Account,
  type LaunchOptions,
  type ProgressEvent,
  type RunningGame,
  type VersionJson,
} from '@balumba/core';
import { APP_CONFIG, isGithubConfigured } from './config.js';
import {
  recordInstalledPackVersion,
  getPackStatus,
  fetchLatestManifest,
  type PackStatus,
} from './pack-status.js';
import type { LaunchStage } from '../shared/ipc.js';
import type { Store } from './store.js';
import type { AuthService } from './auth-service.js';
import type { LaunchController } from './launch-controller.js';

/** Java major version required by MC 1.21.x. */
const JAVA_MAJOR = 21;

/**
 * Orchestrates the full "play" pipeline: Java -> Minecraft -> (NeoForge, Phase 3)
 * -> (pack sync, Phase 4) -> launch. Wires itself into the LaunchController.
 */
export class GameService {
  readonly paths: LauncherPaths;
  private running: RunningGame | null = null;

  constructor(
    private store: Store,
    private auth: AuthService,
    private controller: LaunchController,
  ) {
    this.paths = new LauncherPaths(join(app.getPath('userData'), 'minecraft'));
    controller.setRunner((signal, report) => this.run(signal, report));
  }

  /** Current pack update status for the UI. */
  getPackStatus(): Promise<PackStatus> {
    return getPackStatus(this.paths, this.store.getSettings());
  }

  private report(
    report: (s: { stage?: LaunchStage; progress?: ProgressEvent | null }) => void,
    stage: LaunchStage,
    p?: ProgressEvent,
  ): void {
    report({ stage, progress: p ?? null });
  }

  private async run(
    signal: AbortSignal,
    report: (s: { stage?: LaunchStage; progress?: ProgressEvent | null; error?: string | null }) => void,
  ): Promise<void> {
    const selected = this.store.getSelectedAccount();
    if (!selected) throw new Error('Не выбран аккаунт.');
    // Refresh Microsoft tokens if needed (no-op for offline accounts).
    const account = await this.auth.ensureLaunchable(selected);
    const settings = this.store.getSettings();

    // 1) Java
    this.report(report, 'installing-java');
    const java = await ensureJavaRuntime(
      this.paths,
      JAVA_MAJOR,
      (e) => report({ stage: 'installing-java', progress: e }),
      signal,
    );

    // 2) Minecraft (vanilla base)
    this.report(report, 'installing-minecraft');
    const vanilla = await installVanilla(
      this.paths,
      APP_CONFIG.minecraftVersion,
      (e) => report({ stage: 'installing-minecraft', progress: e }),
      signal,
    );

    // 3) NeoForge (produces the merged, launch-ready version json).
    this.report(report, 'installing-loader');
    const { version } = await installNeoForge(
      this.paths,
      java.javaPath,
      APP_CONFIG.minecraftVersion,
      APP_CONFIG.neoforgeVersion,
      (e) => report({ stage: 'installing-loader', progress: e }),
      signal,
    );
    const baseVersionId = APP_CONFIG.minecraftVersion;
    void (vanilla as VersionJson);

    // 4) Pack sync (mods) from GitHub. Soft-fails if the repo isn't configured
    //    yet or the manifest is unreachable, so local testing still works.
    const instanceDir = this.paths.instanceDir(APP_CONFIG.instanceId);
    if (isGithubConfigured(settings)) {
      try {
        this.report(report, 'syncing-pack');
        const manifest = await fetchLatestManifest(settings, signal);
        const result = await syncPack({
          manifest,
          instanceDir,
          side: 'client',
          report: (e) => report({ stage: 'syncing-pack', progress: e }),
          signal,
        });
        await recordInstalledPackVersion(this.paths, manifest.version);
        // Auto-add the pack server to the in-game multiplayer list.
        if (manifest.serverAddress) {
          await ensureServerInList(instanceDir, {
            name: manifest.name || 'BalumbaCraft',
            ip: manifest.serverAddress,
          }).catch(() => {});
        }
        console.log(
          `[sync] обновлено: ${result.downloaded}, удалено: ${result.removed}, актуально: ${result.upToDate}`,
        );
      } catch (err) {
        if (signal.aborted) throw err;
        console.warn('[sync] пропущено:', err instanceof Error ? err.message : err);
      }
    } else {
      console.warn('[sync] GitHub-репозиторий сборки не настроен — синхронизация пропущена.');
    }

    // For the admin (or offline), also honor a locally-set public address.
    if (settings.serverPublicAddress) {
      await ensureServerInList(instanceDir, {
        name: 'BalumbaCraft',
        ip: settings.serverPublicAddress,
      }).catch(() => {});
    }

    if (signal.aborted) throw new Error('aborted');

    // 5) Launch
    this.report(report, 'launching');
    const options: LaunchOptions = {
      account: account as Account,
      maxRamMb: settings.maxRamMb,
      minRamMb: settings.minRamMb,
      extraJvmArgs: settings.extraJvmArgs,
      resolution: settings.resolution ?? undefined,
    };

    const game = await spawnGame({
      paths: this.paths,
      version,
      baseVersionId,
      instanceId: APP_CONFIG.instanceId,
      javaPath: settings.javaPathOverride || java.javaPath,
      options,
    });
    this.running = game;

    // Killing the game when the user cancels.
    signal.addEventListener('abort', () => game.process.kill(), { once: true });

    game.process.stdout?.on('data', (d: Buffer) => console.log('[mc]', d.toString().trimEnd()));
    game.process.stderr?.on('data', (d: Buffer) => console.error('[mc]', d.toString().trimEnd()));

    report({ stage: 'running', progress: null });
    if (settings.closeOnLaunch) {
      // give the JVM a moment to grab its files, then quit the launcher
      setTimeout(() => app.quit(), 4000);
    }

    const code = await game.waitForExit();
    this.running = null;
    if (code && code !== 0 && !signal.aborted) {
      throw new Error(`Игра завершилась с кодом ${code}. Проверьте логи.`);
    }
    this.controller.markStopped();
  }
}
