import { EventEmitter } from 'node:events';
import type { ProgressEvent } from '@balumba/core';
import type { LaunchState } from '../shared/ipc.js';

/**
 * Owns the current launch lifecycle state and broadcasts changes.
 * The heavy install/launch pipeline is attached in later phases via `setRunner`.
 */
export class LaunchController extends EventEmitter {
  private state: LaunchState = { stage: 'idle', progress: null, error: null };
  private abort: AbortController | null = null;
  private runner: ((signal: AbortSignal, report: (s: Partial<LaunchState>) => void) => Promise<void>) | null =
    null;

  getState(): LaunchState {
    return this.state;
  }

  /** Provide the actual pipeline implementation (Phase 2+). */
  setRunner(
    runner: (signal: AbortSignal, report: (s: Partial<LaunchState>) => void) => Promise<void>,
  ): void {
    this.runner = runner;
  }

  private update(patch: Partial<LaunchState>): void {
    this.state = { ...this.state, ...patch };
    this.emit('state', this.state);
  }

  progress(p: ProgressEvent): void {
    this.update({ progress: p });
  }

  async play(): Promise<void> {
    if (this.state.stage !== 'idle' && this.state.stage !== 'error') {
      return; // already in progress
    }
    if (!this.runner) {
      this.update({ stage: 'error', error: 'Движок запуска ещё не подключён (Фаза 2).', progress: null });
      return;
    }
    this.abort = new AbortController();
    this.update({ stage: 'checking', error: null, progress: null });
    try {
      await this.runner(this.abort.signal, (s) => this.update(s));
    } catch (err) {
      if (this.abort.signal.aborted) {
        this.update({ stage: 'idle', progress: null, error: null });
      } else {
        this.update({
          stage: 'error',
          error: err instanceof Error ? err.message : String(err),
          progress: null,
        });
      }
    } finally {
      this.abort = null;
    }
  }

  cancel(): void {
    this.abort?.abort();
  }

  /** Called by the runner when the game process exits. */
  markStopped(): void {
    this.update({ stage: 'idle', progress: null });
  }
}
