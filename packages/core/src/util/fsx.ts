import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

/** Ensure a directory exists (recursive, no error if present). */
export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

/** Ensure the parent directory of a file path exists. */
export async function ensureParent(filePath: string): Promise<void> {
  await ensureDir(dirname(filePath));
}

/** True if the path exists. */
export async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/** Remove a file or directory recursively; never throws if missing. */
export async function remove(p: string): Promise<void> {
  await rm(p, { recursive: true, force: true });
}

/**
 * Write a web ReadableStream (from fetch) to disk atomically:
 * download to a `.part` temp file, then rename into place.
 */
export async function streamToFileAtomic(
  body: ReadableStream<Uint8Array> | NodeJS.ReadableStream,
  destPath: string,
): Promise<void> {
  await ensureParent(destPath);
  const tmp = `${destPath}.part`;
  const nodeStream =
    body instanceof Readable ? body : Readable.fromWeb(body as ReadableStream<Uint8Array>);
  await pipeline(nodeStream, createWriteStream(tmp));
  await rename(tmp, destPath);
}

/**
 * Recursively list all files under `root`, returning paths relative to `root`
 * with forward slashes. Directories themselves are not returned.
 */
export async function listFilesRelative(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string, rel: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const childRel = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        await walk(join(dir, e.name), childRel);
      } else if (e.isFile()) {
        out.push(childRel);
      }
    }
  }
  await walk(root, '');
  return out;
}
