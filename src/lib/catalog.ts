import { LocalizedError } from '../i18n/errors';
import catalogData from '../data/catalog.json';
import paletteData from '../data/palettes.json';
import sourceLock from '../data/source-lock.json';

export type StyleId = 'regular' | 'filled' | 'duocolor' | 'duotone';

export interface Composition {
  base: string;
  modifiers: { name: string; position: string }[];
}

export interface IconEntry {
  name: string;
  category: string;
  tags: string[];
  aliases: string[];
  composition?: Composition;
}

export interface Palette {
  name: string;
  light: { primary: string; secondary: string };
  dark: { primary: string; secondary: string };
}

export const catalog = catalogData as {
  license: string;
  grid: number;
  strokeWidth: number;
  styles: StyleId[];
  categories: { name: string; count: number }[];
  modifiers: Record<string, { label: string; group: string }>;
  icons: IconEntry[];
};

// Chunk membership and SVG content belong to the same snapshot as the catalog.
export const artworkDirectory = `icon-artwork/${sourceLock.manifestSha256}/icons`;

export const palettes = paletteData as { defaultPalette: string; palettes: Palette[] };
export const lock = sourceLock as {
  repository: string;
  revision: string | null;
  dirty: boolean | null;
  manifestSha256: string;
};

/** Display labels. The library's `filled` style is presented as "Solid". */
export const STYLE_META: Record<StyleId, { label: string; slug: string; description: string }> = {
  regular: { label: 'Regular', slug: 'regular', description: '1.25px line on a 24px grid' },
  filled: { label: 'Solid', slug: 'solid', description: 'Filled silhouettes with transparent cutouts' },
  duocolor: { label: 'Duocolor', slug: 'duocolor', description: 'Primary structure with secondary details' },
  duotone: { label: 'Duotone', slug: 'duotone', description: 'Line with a 16% interior tint' },
};

export const styleFromSlug = (slug: string | null, allowed: readonly StyleId[] = catalog.styles) =>
  allowed.find((s) => STYLE_META[s].slug === slug) ?? null;

/**
 * The icon count for copy, rounded down to the hundred and shown as "1,200+",
 * so text stays true as icons are added. Use catalog.icons.length where the
 * exact number matters (result counts, exports).
 */
export const ICONS_ROUNDED = Math.floor(catalog.icons.length / 100) * 100;

export const iconsByName = new Map(catalog.icons.map((icon) => [icon.name, icon]));

/**
 * Verified modifier family of an icon: its base plus every authored named
 * composition of that base. Only these combinations are offered.
 */
export function modifierFamily(name: string): { base: IconEntry; variants: IconEntry[] } | null {
  const icon = iconsByName.get(name);
  if (!icon) return null;
  const base = iconsByName.get(icon.composition?.base ?? icon.name);
  if (!base) return null;
  const variants = catalog.icons.filter((i) => i.composition?.base === base.name);
  return variants.length ? { base, variants } : null;
}

let cache: Partial<Record<StyleId, Promise<Record<string, string>>>> = {};

const RELOAD_KEY = 'fos-artwork-reload';

/**
 * Artwork lives under a folder named after the library snapshot, and each
 * deploy ships only its own snapshot. A 404 therefore means this page was
 * loaded before a deploy (an open tab, or a cached page): reload once to pick
 * up the new snapshot. The session flag stops a reload loop, and without
 * session storage we never reload automatically.
 */
function recoverFromStaleArtwork(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_KEY) === lock.manifestSha256) return false;
    sessionStorage.setItem(RELOAD_KEY, lock.manifestSha256);
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/** Fetch one artwork file of the current snapshot. */
async function fetchArtwork(file: string, style: StyleId): Promise<Record<string, string>> {
  const res = await fetch(`${import.meta.env.BASE_URL}${artworkDirectory}/${file}`);
  if (res.status === 404) {
    if (recoverFromStaleArtwork()) return new Promise(() => {}); // the page is reloading
    throw new LocalizedError('error.artworkUpdated');
  }
  if (!res.ok) throw new LocalizedError('error.loadStyle', { style: STYLE_META[style].label, status: String(res.status) });
  return res.json() as Promise<Record<string, string>>;
}

/** Fetch one style's SVG snapshot. Only requested styles are downloaded. */
export function loadStyle(style: StyleId): Promise<Record<string, string>> {
  cache[style] ??= fetchArtwork(`${style}.json`, style).catch((error: unknown) => {
    delete cache[style];
    throw error;
  });
  return cache[style];
}

/** Icons per artwork chunk; matches ICON_CHUNK in scripts/sync-icons.mjs. */
export const ICON_CHUNK = 96;
const position = new Map(catalog.icons.map((icon, i) => [icon.name, i]));
let chunkCache: Record<string, Promise<Record<string, string>>> = {};

/** The artwork chunks (catalog order) that hold these icons, in first-needed order. */
export function chunksFor(names: Iterable<string>): number[] {
  const chunks = new Set<number>();
  for (const name of names) {
    const i = position.get(name);
    if (i !== undefined) chunks.add(Math.floor(i / ICON_CHUNK));
  }
  return [...chunks];
}

/** One chunk of a style's artwork, fetched once. */
export function loadIconChunk(style: StyleId, chunk: number): Promise<Record<string, string>> {
  const key = `${style}/${chunk}`;
  chunkCache[key] ??= fetchArtwork(`${key}.json`, style).catch((error: unknown) => {
    delete chunkCache[key];
    throw error;
  });
  return chunkCache[key];
}

export function resetStyleCache() {
  cache = {};
  chunkCache = {};
}
