import { EventEmitter } from 'node:events';
import { spawn, type ChildProcess } from 'node:child_process';
import { app } from 'electron';
import { join } from 'node:path';
import {
  LauncherPaths,
  ensureJavaRuntime,
  installNeoForgeServer,
  buildServerArgs,
  writeEula,
  writeServerProperties,
  readWhitelist,
  writeWhitelist,
  syncPack,
} from '@balumba/core';
import type { ServerState, ServerStatus } from '../shared/ipc.js';
import { APP_CONFIG, isGithubConfigured } from './config.js';
import { fetchLatestManifest } from './pack-status.js';
import type { Store } from './store.js';

const JAVA_MAJOR = 21;

/**
 * Owns the NeoForge dedicated-server lifecycle: install, config, process,
 * console I/O, whitelist, and online players.
 */
export class ServerManager extends EventEmitter {
  private paths: LauncherPaths;
  private proc: ChildProcess | null = null;
  private state: ServerState = {
    status: 'stopped',
    publicAddress: null,
    players: [],
    whitelist: [],
  };

  constructor(private store: Store) {
    super();
    this.paths = new LauncherPaths(join(app.getPath('userData'), 'minecraft'));
    void this.loadWhitelistFromDisk();
  }

  getState(): ServerState {
    return this.state;
  }

  private get serverDir(): string {
    return this.paths.serverDir();
  }

  private update(patch: Partial<ServerState>): void {
    this.state = { ...this.state, ...patch };
    this.emit('state', this.state);
  }

  private log(line: string): void {
    this.emit('log', line);
  }

  private async loadWhitelistFromDisk(): Promise<void> {
    const wl = await readWhitelist(this.serverDir);
    this.update({ whitelist: wl.map((w) => w.name) });
  }

  // --- lifecycle ---

  async start(): Promise<void> {
    if (this.state.status !== 'stopped') return;
    this.update({ status: 'starting', players: [] });
    try {
      const settings = this.store.getSettings();
      // Show the static public address right away (from settings).
      if (settings.serverPublicAddress) {
        this.update({ publicAddress: settings.serverPublicAddress });
      }

      this.log('[launcher] Проверка Java…');
      const java = await ensureJavaRuntime(this.paths, JAVA_MAJOR);

      this.log('[launcher] Установка/проверка сервера NeoForge…');
      const install = await installNeoForgeServer(
        this.paths,
        java.javaPath,
        APP_CONFIG.neoforgeVersion,
        this.serverDir,
        (e) => this.log(`[install] ${e.phase}${e.detail ? ' · ' + e.detail : ''}`),
      );

      // config
      await writeEula(this.serverDir);
      await writeServerProperties(this.serverDir, {
        whitelist: true,
        motd: settings.serverMotd,
        maxPlayers: settings.serverMaxPlayers,
        viewDistance: settings.serverViewDistance,
        simulationDistance: settings.serverViewDistance,
      });
      await writeWhitelist(this.serverDir, this.state.whitelist);

      // sync server-side mods
      if (isGithubConfigured(settings)) {
        this.log('[launcher] Синхронизация серверных модов…');
        try {
          const manifest = await fetchLatestManifest(settings);
          const r = await syncPack({ manifest, instanceDir: this.serverDir, side: 'server' });
          this.log(`[sync] обновлено ${r.downloaded}, удалено ${r.removed}, актуально ${r.upToDate}`);
        } catch (err) {
          this.log(`[sync] пропущено: ${err instanceof Error ? err.message : err}`);
        }
      } else {
        this.log('[launcher] GitHub-сборка не настроена — серверные моды не синхронизированы.');
      }

      // launch (uses the server-specific RAM setting)
      const args = buildServerArgs(install.argsFile, settings.serverRamMb, settings.minRamMb);
      this.log('[launcher] Запуск сервера…');
      const proc = spawn(java.javaPath.replace(/javaw\.exe$/i, 'java.exe'), args, {
        cwd: this.serverDir,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      this.proc = proc;

      proc.stdout?.on('data', (d: Buffer) => this.handleOutput(d.toString()));
      proc.stderr?.on('data', (d: Buffer) => this.handleOutput(d.toString()));
      proc.on('close', (code) => this.onExit(code));
      proc.on('error', (err) => {
        this.log(`[launcher] Ошибка запуска: ${err.message}`);
        this.onExit(1);
      });
    } catch (err) {
      this.log(`[launcher] Не удалось запустить сервер: ${err instanceof Error ? err.message : err}`);
      this.update({ status: 'stopped' });
    }
  }

  async stop(): Promise<void> {
    if (this.state.status === 'stopped' || !this.proc) return;
    this.update({ status: 'stopping' });
    this.sendRaw('stop');
    // Force kill if it doesn't shut down in time.
    setTimeout(() => {
      if (this.proc) this.proc.kill();
    }, 20000);
  }

  private onExit(code: number | null): void {
    this.log(`[launcher] Сервер остановлен (код ${code ?? 0}).`);
    this.proc = null;
    this.update({ status: 'stopped', players: [], publicAddress: null });
  }

  async sendCommand(command: string): Promise<void> {
    if (this.state.status !== 'running') return;
    this.sendRaw(command);
    this.log(`> ${command}`);
  }

  private sendRaw(command: string): void {
    this.proc?.stdin?.write(command.replace(/\n+$/, '') + '\n');
  }

  // --- output parsing ---

  private handleOutput(chunk: string): void {
    for (const line of chunk.split('\n')) {
      const l = line.trimEnd();
      if (!l) continue;
      this.log(l);

      if (/Done \([\d.]+s\)! For help/.test(l)) {
        this.update({ status: 'running' });
      }
      const joined = l.match(/: ([A-Za-z0-9_]{1,16}) joined the game/);
      if (joined) this.addPlayer(joined[1]);
      const left = l.match(/: ([A-Za-z0-9_]{1,16}) left the game/);
      if (left) this.removePlayer(left[1]);
    }
  }

  private addPlayer(name: string): void {
    if (!this.state.players.includes(name)) {
      this.update({ players: [...this.state.players, name] });
    }
  }

  private removePlayer(name: string): void {
    this.update({ players: this.state.players.filter((p) => p !== name) });
  }

  // --- whitelist ---

  async addToWhitelist(username: string): Promise<void> {
    const name = username.trim();
    if (!name || this.state.whitelist.includes(name)) return;
    const list = [...this.state.whitelist, name];
    // Write whitelist.json ourselves with the correct OFFLINE uuid, then just
    // reload. We must NOT use `whitelist add`, which on an offline server does a
    // Mojang lookup and stores the wrong (online) uuid -> player can't join.
    await writeWhitelist(this.serverDir, list);
    this.update({ whitelist: list });
    if (this.state.status === 'running') this.sendRaw('whitelist reload');
  }

  async removeFromWhitelist(username: string): Promise<void> {
    const list = this.state.whitelist.filter((u) => u !== username);
    await writeWhitelist(this.serverDir, list);
    this.update({ whitelist: list });
    if (this.state.status === 'running') this.sendRaw('whitelist reload');
  }
}

export type { ServerStatus };
