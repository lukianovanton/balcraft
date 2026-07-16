import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathExists } from '../util/fsx.js';

/**
 * Minimal NBT reader/writer for Minecraft's `servers.dat` (uncompressed NBT),
 * enough to add the pack server to the in-game multiplayer list automatically.
 *
 * Structure:
 *   TAG_Compound("")
 *     TAG_List("servers") of TAG_Compound { TAG_String "name", TAG_String "ip" }
 */

export interface SavedServer {
  name: string;
  ip: string;
}

// --- write ---

function str(s: string): Buffer {
  const body = Buffer.from(s, 'utf8');
  const len = Buffer.alloc(2);
  len.writeUInt16BE(body.length, 0);
  return Buffer.concat([len, body]);
}

function namedString(name: string, value: string): Buffer {
  return Buffer.concat([Buffer.from([8]), str(name), str(value)]);
}

function encodeServers(servers: SavedServer[]): Buffer {
  const entries = servers.map((s) =>
    Buffer.concat([
      namedString('name', s.name),
      namedString('ip', s.ip),
      Buffer.from([0]), // TAG_End of this compound
    ]),
  );

  const listHeader = Buffer.alloc(1 + 4);
  listHeader.writeUInt8(10, 0); // element type = TAG_Compound
  listHeader.writeInt32BE(servers.length, 1);

  const listTag = Buffer.concat([
    Buffer.from([9]), // TAG_List
    str('servers'),
    listHeader,
    ...entries,
  ]);

  // Root TAG_Compound("") { <listTag> } TAG_End
  return Buffer.concat([Buffer.from([10]), str(''), listTag, Buffer.from([0])]);
}

// --- read (best-effort; returns [] on any problem) ---

function decodeServers(buf: Buffer): SavedServer[] {
  try {
    let i = 0;
    const readShort = () => {
      const v = buf.readUInt16BE(i);
      i += 2;
      return v;
    };
    const readStr = () => {
      const len = readShort();
      const s = buf.toString('utf8', i, i + len);
      i += len;
      return s;
    };
    // Advance `i` past a tag payload of the given type (name already consumed).
    const skipPayload = (type: number): void => {
      switch (type) {
        case 1: i += 1; break; // byte
        case 2: i += 2; break; // short
        case 3: case 5: i += 4; break; // int / float
        case 4: case 6: i += 8; break; // long / double
        case 7: i += 4 + buf.readInt32BE(i); break; // byte array
        case 8: i += 2 + readShort0(i); break; // string
        case 11: i += 4 + buf.readInt32BE(i) * 4; break; // int array
        case 12: i += 4 + buf.readInt32BE(i) * 8; break; // long array
        default: throw new Error('unsupported tag ' + type);
      }
    };
    const readShort0 = (at: number) => buf.readUInt16BE(at);

    if (buf[i] !== 10) return [];
    i += 1;
    readStr(); // root name
    const out: SavedServer[] = [];
    while (i < buf.length) {
      const type = buf[i++];
      if (type === 0) break;
      const name = readStr();
      if (type === 9 && name === 'servers') {
        const elemType = buf[i++];
        const count = buf.readInt32BE(i);
        i += 4;
        for (let e = 0; e < count && elemType === 10; e++) {
          const srv: Partial<SavedServer> = {};
          for (;;) {
            const t = buf[i++];
            if (t === 0) break;
            const fname = readStr();
            if (t === 8) {
              const val = readStr();
              if (fname === 'name') srv.name = val;
              else if (fname === 'ip') srv.ip = val;
            } else {
              skipPayload(t); // preserve entry, ignore extra fields (icon, etc.)
            }
          }
          if (srv.ip) out.push({ name: srv.name ?? '', ip: srv.ip });
        }
        return out;
      }
      skipPayload(type); // skip other root tags we don't care about
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Ensure `server` is present in the instance's servers.dat (in-game multiplayer
 * list), preserving any existing entries. Idempotent by ip.
 */
export async function ensureServerInList(
  instanceDir: string,
  server: SavedServer,
): Promise<void> {
  const file = join(instanceDir, 'servers.dat');
  let existing: SavedServer[] = [];
  if (await pathExists(file)) {
    existing = decodeServers(await readFile(file));
  }
  const already = existing.find((s) => s.ip === server.ip);
  if (already) {
    if (already.name !== server.name) already.name = server.name;
  } else {
    existing.unshift(server);
  }
  await writeFile(file, encodeServers(existing));
}
