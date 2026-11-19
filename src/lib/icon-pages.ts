import { orderBrowseIcons } from './browse-order';
import { catalog, iconsByName, type IconEntry } from './catalog';

/**
 * Crawlable landing pages: one per icon (/icons/<name>), one per category
 * (/categories/<slug>), and one per way of using the library (React, Vue,
 * Figma). The home grid stays the place to search and customize; these pages
 * are what search engines index and link to.
 */

/** "arrow-circle-right" -> "Arrow Circle Right" (for titles and headings). */
export const displayName = (name: string) =>
  name.split('-').map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part)).join(' ');

/** "AI & agents" -> "ai-agents". */
export const categorySlug = (category: string) =>
  category.toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const categoriesBySlug = new Map(catalog.categories.map((c) => [categorySlug(c.name), c]));
export const categoryBySlug = (slug: string) => categoriesBySlug.get(slug) ?? null;

export const iconPath = (name: string) => `/icons/${name}`;
export const categoryPath = (category: string) => `/categories/${categorySlug(category)}`;
/** The editor on the home page, with this icon open. */
export const editorPath = (name: string) => `/?${new URLSearchParams({ icon: name })}`;
/** The library's own SVG file, published at build time (scripts/postbuild.mjs). */
export const svgFilePath = (style: string, name: string) => `/svg/${style}/${name}.svg`;

/**
 * Words people search for this icon by: its aliases, then its tags, lowercased
 * and without repeats of the icon's own name or category.
 */
export const iconKeywords = (icon: IconEntry) => {
  const skip = new Set([icon.name.replace(/-/g, ' '), icon.category.toLowerCase()]);
  const words = [...displayAliases(icon), ...icon.tags.map((t) => t.replace(/-/g, ' '))].map((w) => w.toLowerCase());
  return [...new Set(words)].filter((w) => !skip.has(w));
};

/** Other names people search for (legacy library paths such as "interface/x" are left out). */
export const displayAliases = (icon: IconEntry) =>
  [...new Set(icon.aliases.filter((a) => !a.includes('/')).map((a) => a.replace(/-/g, ' ')))].filter((a) => a !== icon.name.replace(/-/g, ' '));

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

export type FrameworkId = 'react' | 'vue' | 'figma';
export const FRAMEWORK_PATHS: Record<FrameworkId, string> = {
  react: '/react-icons',
  vue: '/vue-icons',
  figma: '/figma-icons',
};

/** Well-known icons to show on the framework pages, where the library has them. */
const POPULAR = [
  'home', 'search', 'settings', 'user', 'bell', 'calendar', 'mail', 'heart', 'star', 'camera',
  'trash', 'edit', 'download', 'upload', 'share', 'lock', 'cart', 'chat', 'map', 'clock',
  'image', 'folder', 'phone', 'globe', 'sparkles', 'link', 'filter', 'bookmark',
];
export const POPULAR_ICONS: IconEntry[] = (() => {
  const picked = POPULAR.map((n) => iconsByName.get(n)).filter((i): i is IconEntry => !!i && !i.composition);
  // Top up from the catalog's first icons of each category so the grid is never thin.
  for (const c of catalog.categories) {
    if (picked.length >= 24) break;
    const first = catalog.icons.find((i) => i.category === c.name && !i.composition && !picked.includes(i));
    if (first) picked.push(first);
  }
  return picked.slice(0, 24);
})();
