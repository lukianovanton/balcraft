import { stat } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { ensureParent, remove, streamToFileAtomic } from './fsx.js';
import { verifyFile } from './hash.js';

export interface DownloadOptions {
  /** URLs to try in order. */
  urls: string[];
  /** Destination absolute path. */
  dest: string;
  /** Expected sha1 (skips download if already valid, verifies after). */
  sha1?: string;
  /** Expected size in bytes. */
  size?: number;
  /** Retry attempts per URL. */
  retries?: number;
  /** Optional per-file byte progress callback. */
  onBytes?: (done: number, total: number | null) => void;
  /** Abort signal. */
  signal?: AbortSignal;
}

/**
 * Download a file with SHA-1 verification, multi-URL fallback and retries.
 * If the file already exists and matches sha1/size, no network call is made.
 */
export async function downloadFile(opts: DownloadOptions): Promise<void> {
  const { urls, dest, sha1, size, onBytes, signal } = opts;
  const retries = opts.retries ?? 3;

  if (sha1 && (await verifyFile(dest, sha1, size))) {
    return; // already present and valid
  }

  let lastErr: unknown;
  for (const url of urls) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        await ensureParent(dest);
        const res = await fetch(url, { signal, redirect: 'follow' });
        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status} for ${url}`);
        }
        const total = Number(res.headers.get('content-length')) || size || null;

        if (onBytes) {
          let done = 0;
          const reported = res.body.pipeThrough(
            new TransformStream<Uint8Array, Uint8Array>({
              transform(chunk, controller) {
                done += chunk.byteLength;
                onBytes(done, total);
                controller.enqueue(chunk);
              },
            }),
          );
          await streamToFileAtomic(reported, dest);
        } else {
          await streamToFileAtomic(res.body, dest);
        }

        if (sha1) {
          const ok = await verifyFile(dest, sha1, size);
          if (!ok) {
            await remove(dest);
            throw new Error(`Checksum mismatch for ${dest}`);
          }
        } else if (size != null) {
          const s = await stat(dest);
          if (s.size !== size) {
            await remove(dest);
            throw new Error(`Size mismatch for ${dest}: expected ${size}, got ${s.size}`);
          }
        }
        return; // success
      } catch (err) {
        lastErr = err;
        if (signal?.aborted) throw err;
        if (attempt < retries) await delay(400 * (attempt + 1));
      }
    }
  }
  throw new Error(
    `Failed to download ${dest} from ${urls.length} URL(s): ${
      lastErr instanceof Error ? lastErr.message : String(lastErr)
    }`,
  );
}

/** Fetch JSON with retries. */
export async function fetchJson<T>(url: string, signal?: AbortSignal, retries = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { signal, redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return (await res.json()) as T;
    } catch (err) {
      lastErr = err;
      if (signal?.aborted) throw err;
      if (attempt < retries) await delay(400 * (attempt + 1));
    }
  }
  throw new Error(
    `Failed to fetch JSON ${url}: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`,
  );
}

/**
 * Run async tasks with a concurrency limit. Rejects on first failure after
 * letting in-flight tasks settle.
 */
export async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  const queue = items.map((item, index) => ({ item, index }));
  const errors: unknown[] = [];
  async function runner(): Promise<void> {
    for (;;) {
      const next = queue.shift();
      if (!next) return;
      try {
        await worker(next.item, next.index);
      } catch (err) {
        errors.push(err);
        return;
      }
    }
  }
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, runner);
  await Promise.all(runners);
  if (errors.length) throw errors[0];
}
