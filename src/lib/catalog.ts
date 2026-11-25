import catalogData from '../data/catalog.json';
import { artworkKey, fetchArtwork, ICON_CHUNK, loadIconChunk, resetChunkCache } from './artwork-files';
import { orderBrowseIcons } from './browse-order';
import { catalogMeta, lock, type IconEntry, type StyleId } from './catalog-meta';

export * from './catalog-meta';
export { artworkDirectory, artworkKey, loadIconChunk, ICON_CHUNK } from './artwork-files';

export const catalog = { ...catalogMeta, icons: catalogData.icons as IconEntry[] };

export const iconsByName = new Map(catalog.icons.map((icon) => [icon.name, icon]));

export const iconsInCategory = (category: string): IconEntry[] => orderBrowseIcons(catalog.icons.filter((i) => i.category === category));

/** Icons to suggest next to one: shared tags first, then the rest of its category. */
export function relatedIcons(icon: IconEntry, limit = 24): IconEntry[] {
  const tags = new Set(icon.tags);
  const base = icon.composition?.base;
  return catalog.icons
    .filter((other) => other.name !== icon.name && (other.category === icon.category || other.tags.some((t) => tags.has(t))))
    .map((other) => ({
      other,
      score: (other.category === icon.category ? 1 : 0)
        + other.tags.filter((t) => tags.has(t)).length * 2
        + (other.composition?.base === icon.name || other.name === base ? 4 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.other.name.localeCompare(b.other.name))
    .slice(0, limit)
    .map(({ other }) => other);
}

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

let cache: Record<string, Promise<Record<string, string>>> = {};

/**
 * Fetch one style's SVG snapshot at an optical size. Only requested styles
 * are downloaded. Sizes other than 24 ship as chunks only, merged here.
 */
export function loadStyle(style: StyleId, size: number = catalog.grid): Promise<Record<string, string>> {
  const key = artworkKey(style, size);
  cache[key] ??= (size === catalog.grid
    ? fetchArtwork(`${style}.json`, style)
    : Promise.all(Array.from({ length: Math.ceil(catalog.icons.length / ICON_CHUNK) }, (_, n) => loadIconChunk(style, n, size)))
      .then((chunks) => Object.assign({}, ...chunks) as Record<string, string>)
  ).catch((error: unknown) => {
    delete cache[key];
    throw error;
  });
  return cache[key];
}

const position = new Map(catalog.icons.map((icon, i) => [icon.name, i]));

/** The artwork chunks (catalog order) that hold these icons, in first-needed order. */
export function chunksFor(names: Iterable<string>): number[] {
  const chunks = new Set<number>();
  for (const name of names) {
    const i = position.get(name);
    if (i !== undefined) chunks.add(Math.floor(i / ICON_CHUNK));
  }
  return [...chunks];
}

let animatedCache: Promise<Record<string, string>> | null = null;

/**
 * The animated icons, in one small file. They can change without the
 * manifest changing, and artwork is cached as immutable, so the URL carries
 * their own digest.
 */
export function loadAnimated(): Promise<Record<string, string>> {
  const version = lock.snapshotSha256?.animated?.slice(0, 12) ?? 'none';
  animatedCache ??= fetchArtwork(`animated.json?v=${version}`, 'regular', 'Animated').catch((error: unknown) => {
    animatedCache = null;
    throw error;
  });
  return animatedCache;
}

export function resetStyleCache() {
  animatedCache = null;
  cache = {};
  resetChunkCache();
}
