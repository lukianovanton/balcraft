import { createHash } from 'node:crypto';

/**
 * Compute the offline-mode UUID Minecraft uses for a username.
 * This is a name-based (v3/MD5) UUID over "OfflinePlayer:<name>", matching
 * the vanilla server's `UUIDUtil.createOfflinePlayerUUID`. Using the same
 * algorithm keeps offline UUIDs stable and consistent with the whitelist.
 */
export function offlineUuid(username: string): string {
  const hash = createHash('md5').update(`OfflinePlayer:${username}`, 'utf8').digest();
  // Set version to 3 and the IETF variant, per RFC 4122.
  hash[6] = (hash[6] & 0x0f) | 0x30;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** UUID with dashes removed, as Minecraft launch args expect. */
export function undashUuid(uuid: string): string {
  return uuid.replace(/-/g, '');
}
