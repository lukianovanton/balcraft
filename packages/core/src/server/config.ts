import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { offlineUuid } from '../auth/offline.js';
import { ensureDir, pathExists } from '../util/fsx.js';

export interface WhitelistEntry {
  uuid: string;
  name: string;
}

export interface ServerProps {
  motd: string;
  maxPlayers: number;
  viewDistance: number;
  simulationDistance: number;
  port: number;
  difficulty: string;
  whitelist: boolean;
  /** How far entity updates are broadcast, in % of view distance. Lower = far less
   *  packet traffic around busy bases (big win for players on weak connections). */
  entityBroadcastRangePercentage: number;
  /** Packets larger than this get compressed. Lower = less bandwidth, a bit more CPU. */
  networkCompressionThreshold: number;
}

const DEFAULT_PROPS: ServerProps = {
  motd: 'BalumbaCraft — Create',
  maxPlayers: 10,
  viewDistance: 10,
  simulationDistance: 10,
  port: 25565,
  difficulty: 'normal',
  whitelist: true,
  entityBroadcastRangePercentage: 50,
  networkCompressionThreshold: 64,
};

/** Write eula.txt accepting the Minecraft EULA (required to start the server). */
export async function writeEula(serverDir: string): Promise<void> {
  await ensureDir(serverDir);
  await writeFile(join(serverDir, 'eula.txt'), 'eula=true\n', 'utf8');
}

/**
 * Write server.properties for an offline (cracked+licensed) whitelisted server.
 * Preserves the world seed / level-name if a file already exists.
 */
export async function writeServerProperties(
  serverDir: string,
  props: Partial<ServerProps> = {},
): Promise<void> {
  const p = { ...DEFAULT_PROPS, ...props };
  const lines = [
    `motd=${p.motd}`,
    'online-mode=false',
    `white-list=${p.whitelist}`,
    `enforce-whitelist=${p.whitelist}`,
    `max-players=${p.maxPlayers}`,
    `view-distance=${p.viewDistance}`,
    `simulation-distance=${p.simulationDistance}`,
    `server-port=${p.port}`,
    `difficulty=${p.difficulty}`,
    'allow-flight=true', // Create jetpacks / aeronautics
    'spawn-protection=0',
    'sync-chunk-writes=false',
    // Network tuning: cuts packet volume around dense bases so players on weak
    // connections stay playable (MC would otherwise reset these to defaults).
    `entity-broadcast-range-percentage=${p.entityBroadcastRangePercentage}`,
    `network-compression-threshold=${p.networkCompressionThreshold}`,
    'level-name=world',
    'enable-command-block=true',
    'allow-nether=true',
  ];
  await writeFile(join(serverDir, 'server.properties'), lines.join('\n') + '\n', 'utf8');
}

/** Read the whitelist.json (returns [] if missing). */
export async function readWhitelist(serverDir: string): Promise<WhitelistEntry[]> {
  const file = join(serverDir, 'whitelist.json');
  if (!(await pathExists(file))) return [];
  try {
    return JSON.parse(await readFile(file, 'utf8')) as WhitelistEntry[];
  } catch {
    return [];
  }
}

/** Write the whitelist.json from a list of usernames (offline uuids computed). */
export async function writeWhitelist(serverDir: string, usernames: string[]): Promise<WhitelistEntry[]> {
  const seen = new Set<string>();
  const entries: WhitelistEntry[] = [];
  for (const raw of usernames) {
    const name = raw.trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    entries.push({ uuid: offlineUuid(name), name });
  }
  await ensureDir(serverDir);
  await writeFile(join(serverDir, 'whitelist.json'), JSON.stringify(entries, null, 2), 'utf8');
  return entries;
}
