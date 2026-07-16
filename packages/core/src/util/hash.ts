import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';

/** Compute the SHA-1 hex digest of a file, streaming it (safe for large jars). */
export async function sha1File(filePath: string): Promise<string> {
  return hashFile(filePath, 'sha1');
}

/** Compute an arbitrary hash of a file. */
export function hashFile(filePath: string, algo: 'sha1' | 'sha256'): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash(algo);
    const stream = createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

/** SHA-1 hex of an in-memory buffer or string. */
export function sha1Buffer(data: Buffer | string): string {
  return createHash('sha1').update(data).digest('hex');
}

/**
 * Check whether a file exists and matches the expected sha1 and (optionally) size.
 * Returns false on any mismatch or missing file — never throws.
 */
export async function verifyFile(
  filePath: string,
  expectedSha1: string,
  expectedSize?: number,
): Promise<boolean> {
  try {
    if (expectedSize != null) {
      const s = await stat(filePath);
      if (s.size !== expectedSize) return false;
    }
    const actual = await sha1File(filePath);
    return actual.toLowerCase() === expectedSha1.toLowerCase();
  } catch {
    return false;
  }
}
