import type { Side } from '../types.js';

/**
 * Curated list of client-only mods (rendering, UI, sound, minimaps, client-side
 * FPS tweaks). Matched case-insensitively as a substring of the jar filename.
 * Everything not listed defaults to `both` (present on client AND server) —
 * which is the safe default for content/optimization mods.
 *
 * Refined against the "Сборка" (Create, NeoForge 1.21.1) mod list. Review this
 * before building the dedicated server (Phase 6).
 */
export const CLIENT_ONLY_MODS: string[] = [
  // GPU / rendering / shaders
  'sodium',
  'iris',
  'reeses-sodium-options',
  'sodiumextras',
  'sodiumoptionsapi',
  'iris-flywheel-compat',
  'distanthorizons',
  'entityculling',
  'gpumemleakfix',
  'betterfpsdist',
  'smoothchunk',
  'immediatelyfast',
  'fusion', // connected textures
  'createbetterfps',
  // minimap / world view
  'journeymap',
  'jmi-neoforge', // journeymap integration
  'forgematica', // schematic client tool
  // HUD / tooltips / UI
  'jade',
  'jadeaddons',
  'iceberg', // jade/UI lib
  // NOTE: JEI itself is NOT client-only — many mods (e.g. sliceanddice) hard-
  // reference its API server-side, so it must be on both. Its addons below are
  // pure client UI and safe to exclude from the server.
  'justenoughprofessions',
  'justenoughresources',
  'justenoughbreeding',
  'mousetweaks',
  'advancementplaques',
  'betteradvancements',
  'enchdesc',
  'bobberdetector',
  'cfwinfo',
  'notenoughanimations',
  'skinlayers3d',
  'reeses',
  'sodiumoptions',
  // sound / ambience
  'ambientsounds',
  'sound-physics-remastered',
  'do_a_barrel_roll',
];

/**
 * Decide which side a mod jar belongs to based on its filename.
 * Returns 'client' for curated client-only mods, otherwise 'both'.
 */
export function classifyModByFilename(fileName: string): Side {
  const lower = fileName.toLowerCase();
  return CLIENT_ONLY_MODS.some((m) => lower.includes(m)) ? 'client' : 'both';
}
