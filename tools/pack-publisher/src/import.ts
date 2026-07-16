import { copyFile, readdir, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { packDir } from './config.js';

const DEFAULT_MODRINTH_MODS =
  'C:\\Users\\lykia\\AppData\\Roaming\\ModrinthApp\\profiles\\Сборка\\mods';

/**
 * Copy mod jars from a source directory (default: the Modrinth "Сборка" profile)
 * into pack/mods, so pack/ becomes the source of truth for publishing.
 */
export async function runImport(sourceArg?: string): Promise<void> {
  const source = sourceArg || DEFAULT_MODRINTH_MODS;
  const destDir = join(packDir(), 'mods');
  await mkdir(destDir, { recursive: true });

  let entries: string[];
  try {
    entries = (await readdir(source, { withFileTypes: true }))
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.jar'))
      .map((e) => e.name);
  } catch (err) {
    throw new Error(`Не удалось прочитать папку модов: ${source}\n${(err as Error).message}`);
  }

  let copied = 0;
  for (const name of entries) {
    await copyFile(join(source, name), join(destDir, name));
    copied++;
  }
  console.log(`[import] скопировано ${copied} модов из:\n  ${source}\nв:\n  ${destDir}`);
  console.log('[import] дальше: balumba-pack build');
}
