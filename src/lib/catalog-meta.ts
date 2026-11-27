import metadata from '../data/catalog-meta.json';
import paletteData from '../data/palettes.json';
import sourceLock from '../data/source-lock.json';

export type StyleId = 'regular' | 'filled' | 'duocolor' | 'duotone';
export const FREE_ICON_STYLE = 'regular' satisfies StyleId;

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

export const catalogMeta = {
  ...metadata,
  styles: metadata.styles as StyleId[],
  strokeWidths: metadata.strokeWidths as Partial<Record<string, number>>,
  sampleChunks: metadata.sampleChunks as Partial<Record<string, number>>,
};
export const palettes = paletteData as { defaultPalette: string; palettes: Palette[] };
export const lock = sourceLock as typeof sourceLock & { snapshotSha256?: Record<string, string> };
export const animatedNames: ReadonlySet<string> = new Set(catalogMeta.animated);

/** Display labels and URL slugs, one per style. */
export const STYLE_META: Record<StyleId, { label: string; slug: string; description: string }> = {
  regular: { label: 'Regular', slug: 'regular', description: '1.25px line on a 24px grid' },
  filled: { label: 'Filled', slug: 'filled', description: 'Silhouettes with transparent cutouts' },
  duocolor: { label: 'Duocolor', slug: 'duocolor', description: 'Primary structure with secondary details' },
  duotone: { label: 'Duotone', slug: 'duotone', description: 'Line with an adjustable interior tint' },
};

/** Old style slugs still accepted in links: Filled was called Solid until 2026-11-26. */
const LEGACY_STYLE_SLUGS: Record<string, string> = { solid: 'filled' };

export const styleFromSlug = (slug: string | null, allowed: readonly StyleId[] = catalogMeta.styles) => {
  const current = slug && (LEGACY_STYLE_SLUGS[slug] ?? slug);
  return allowed.find((s) => STYLE_META[s].slug === current) ?? null;
};

export const ICONS_ROUNDED = Math.floor(catalogMeta.iconCount / 100) * 100;
export const ICON_VARIANTS_ROUNDED = Math.floor(catalogMeta.iconCount * catalogMeta.styles.length / 100) * 100;
/** Conservative lower bound across styles and supported modifier placements. */
export const MODIFIER_COMBINATIONS_ROUNDED = 860_000;

/**
 * The optical size closest by ratio (40px is drawn from 48, 20px from 24).
 * Halfway between two sizes, the larger one wins.
 */
export function opticalSize(px: number): number {
  let best = catalogMeta.grid;
  for (const size of catalogMeta.sizes) {
    const distance = Math.abs(Math.log(px / size));
    const current = Math.abs(Math.log(px / best));
    if (distance < current - 1e-9 || (Math.abs(distance - current) <= 1e-9 && size > best)) best = size;
  }
  return best;
}

/** An optical size's designed stroke in 24px grid units (1.25 at 24, 1 at 48). */
export const opticalStroke = (size: number) =>
  ((catalogMeta.strokeWidths[String(size)] ?? catalogMeta.strokeWidth) * catalogMeta.grid) / size;
