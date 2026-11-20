import { LocalizedError } from '../i18n/errors';
import brandData from '../data/brands.json';
import { iconsByName, type IconEntry } from './catalog';
import { scopeSvg } from './svg';
import { BRAND_STYLES, type BrandStyle } from './url-state';

export interface BrandEntry {
  name: string;
  owner: string;
  category: string;
  aliases?: string[];
  officialSource: string;
  retrieved: string;
  terms: string;
  /** Paths under public/, per style. Solid (`filled`) is optional. */
  files: Partial<Record<BrandStyle, string>>;
}

export const brands = brandData as { disclaimer: string; approved: BrandEntry[] };

/** Approved brands as searchable entries. */
export const brandEntries: IconEntry[] = brands.approved.map((b) => ({
  name: b.name, category: b.category, tags: [b.owner.toLowerCase()], aliases: b.aliases ?? [],
}));

export const brandCategories = [...new Set(brandEntries.map((e) => e.category))].sort()
  .map((name) => ({ name, count: brandEntries.filter((e) => e.category === name).length }));

/** Brand styles at least one approved brand ships (Solid only once a Solid source exists). */
export const availableBrandStyles: BrandStyle[] = BRAND_STYLES.filter((s) => brands.approved.some((b) => b.files[s]));

export const hasBrandStyle = (name: string, style: BrandStyle) =>
  !!brands.approved.find((b) => b.name === name)?.files[style];

const cache = new Map<BrandStyle, Promise<Record<string, string>>>();

/** Fetch the approved brand SVGs for one style. */
export function loadBrands(style: BrandStyle): Promise<Record<string, string>> {
  if (!cache.has(style)) {
    cache.set(style, Promise.all(brands.approved.map(async (b) => {
      const file = b.files[style];
      if (!file) return null;
      const res = await fetch(`${import.meta.env.BASE_URL}${file}`);
      if (!res.ok) throw new LocalizedError('error.loadBrand', { name: b.name, status: String(res.status) });
      // Marks are shown unmodified, but their IDs (gradients, clip paths) are
      // namespaced so marks sharing an ID don't repaint each other on one page.
      return [b.name, scopeSvg(await res.text(), `brand-${b.name}-${style}`)] as const;
    })).then((rows) => Object.fromEntries(rows.filter((r) => r !== null))).catch((error: unknown) => {
      cache.delete(style);
      throw error;
    }));
  }
  return cache.get(style)!;
}

/** The category brand marks are filed under in the icon grid. */
export const BRANDS_CATEGORY = 'Brands';

/**
 * A brand's name in the combined catalog. A few brands share a name with a
 * core icon (apple, signal, x…); those marks are listed as "<name>-logo".
 */
const catalogName = (name: string) => (iconsByName.has(name) ? `${name}-logo` : name);

/** Brand marks as entries of the combined catalog, all in the Brands category. */
export const brandCatalogEntries: IconEntry[] = brands.approved.map((b) => ({
  name: catalogName(b.name),
  category: BRANDS_CATEGORY,
  tags: [b.owner.toLowerCase(), b.category.toLowerCase(), 'brand', 'logo', ...(catalogName(b.name) === b.name ? [] : [b.name])],
  aliases: b.aliases ?? [],
}));

const brandByCatalogName = new Map(brands.approved.map((b) => [catalogName(b.name), b]));

/** Whether a catalog name is a brand mark. */
export const isBrand = (name: string) => brandByCatalogName.has(name);

/** Whether a mark is drawn in its own colors (true) or as a one-color Solid mark. */
export const isColorMark = (name: string, style: BrandStyle) => style === 'regular' || !brandByCatalogName.get(name)?.files.filled;

/**
 * The approved brand marks keyed by catalog name. Solid gives each brand's
 * one-color mark where its kit has one; marks without one (the Google and
 * Microsoft product icons) keep their original colors in every style.
 */
export async function loadBrandMarks(style: BrandStyle = 'regular'): Promise<Record<string, string>> {
  const regular = await loadBrands('regular');
  const solid = style === 'filled' && availableBrandStyles.includes('filled') ? await loadBrands('filled') : {};
  return Object.fromEntries(brands.approved
    .filter((b) => solid[b.name] ?? regular[b.name])
    .map((b) => [catalogName(b.name), solid[b.name] ?? regular[b.name]]));
}
