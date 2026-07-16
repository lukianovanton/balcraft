import { join } from 'node:path';
import type { LauncherPaths } from '../paths.js';
import { detectPlatform } from '../util/platform.js';
import { downloadFile } from '../util/download.js';
import { pathExists } from '../util/fsx.js';

/**
 * Ensure the Playit.gg agent binary is present, downloading it if needed.
 * Playit exposes the local server to friends without port-forwarding or a
 * static IP.
 */
export async function ensurePlayitAgent(paths: LauncherPaths): Promise<string> {
  const plat = detectPlatform();
  if (plat.os !== 'windows') {
    // Only Windows is a target for BalumbaCraft right now.
    throw new Error('Playit-агент поддерживается только на Windows в этой сборке.');
  }
  const exe = join(paths.bin, 'playit.exe');
  if (await pathExists(exe)) return exe;

  const url =
    'https://github.com/playit-cloud/playit-agent/releases/latest/download/playit-windows-x86_64-signed.exe';
  await downloadFile({ urls: [url], dest: exe });
  return exe;
}

/** Regexes for scraping playit output for the claim URL and tunnel address. */
export const PLAYIT_CLAIM_RE = /https:\/\/playit\.gg\/(?:claim|mc|play)\/[\w-]+/i;
export const PLAYIT_ADDRESS_RE = /([a-z0-9-]+\.(?:craft\.)?playit\.gg(?::\d+)?)/i;
