import { catalogMeta, type IconEntry, type StyleId } from './catalog-meta';

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

const categoriesBySlug = new Map(catalogMeta.categories.map((c) => [categorySlug(c.name), c]));
export const categoryBySlug = (slug: string) => categoriesBySlug.get(slug) ?? null;

export const iconPath = (name: string) => `/icons/${name}`;
export const categoryPath = (category: string) => `/categories/${categorySlug(category)}`;
/** Open the catalog editor with this icon selected. */
export const editorPath = (name: string) => `${iconPath(name)}?view=editor`;
/** The library's own SVG file, published at build time (scripts/postbuild.mjs). */
export const svgFilePath = (style: string, name: string) => `/svg/${style}/${name}.svg`;
export const gridPreviewPath = (name: string) => `/svg/preview/${name}.svg`;

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

export type FrameworkId = 'react' | 'vue' | 'figma';
export const FRAMEWORK_PATHS: Record<FrameworkId, string> = {
  react: '/react-icons',
  vue: '/vue-icons',
  figma: '/figma-icons',
};

/** One landing page per style ("solid icons" and so on); `?style=` stays the catalog filter. */
export const STYLE_PATHS: Record<StyleId, string> = {
  regular: '/regular-icons',
  filled: '/solid-icons',
  duocolor: '/duocolor-icons',
  duotone: '/duotone-icons',
};

export const POPULAR_ICONS = catalogMeta.examples.map((name) => ({ name }));
