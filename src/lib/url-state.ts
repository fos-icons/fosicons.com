import { STYLE_META, styleFromSlug, type StyleId } from './catalog-meta';
import { CORNERS, type Corner } from './modifiers';

/** The style switcher's options: the four core styles, Animated, then Brands. */
export type View = StyleId | 'animated' | 'brands';
/** Animated is a view of Regular artwork: the curated icons that move. */
export const ANIMATED_SLUG = 'animated';
/** Brands offer Regular and Solid only — never the duo styles. */
export type BrandStyle = 'regular' | 'filled';
export { BRAND_STYLES } from './brands';

export interface CatalogState {
  q: string;
  category: string | null;
  style: View;
  /** Regular or Solid within Brands; ignored for core styles. */
  brandStyle: BrandStyle;
  icon: string | null;
  /** A modifier tried on the open icon (library name), and where; only with `icon`. */
  modifier: string | null;
  corner: Corner | null;
}

export interface CollectionConfig {
  categories: readonly string[];
  icons: ReadonlySet<string>;
}

export interface UrlStateConfig {
  styles: readonly StyleId[];
  /** Whether the Animated view exists (the library has animated icons). */
  animated?: boolean;
  core: CollectionConfig;
  brands: CollectionConfig;
}

/** Parse shareable state, discarding values the catalog cannot honor. */
export function parseState(search: string, config: UrlStateConfig, route: Partial<Pick<CatalogState, 'category' | 'icon'>> = {}): CatalogState {
  const params = new URLSearchParams(search);
  const slug = params.get('style');
  // Brands used to be a style tab; old links now open the Brands category.
  const legacyBrands = slug === 'brands';
  const style: View = legacyBrands ? config.styles[0]
    : slug === ANIMATED_SLUG && config.animated ? 'animated'
      : styleFromSlug(slug, config.styles) ?? config.styles[0];
  const collection = config.core;
  const category = route.category !== undefined ? route.category : legacyBrands ? params.get('category') ?? 'Brands' : params.get('category');
  const icon = route.icon !== undefined ? route.icon : params.get('icon');
  const iconOk = !!icon && collection.icons.has(icon);
  const modifier = params.get('modifier');
  // Brand marks never take modifiers.
  const modifierOk = iconOk && !config.brands.icons.has(icon) && !!modifier && /^[a-z0-9-]{1,40}$/.test(modifier);
  const corner = params.get('corner') as Corner | null;
  return {
    q: (params.get('q') ?? '').slice(0, 100),
    category: category && collection.categories.includes(category) ? category : null,
    style,
    brandStyle: 'regular',
    icon: iconOk ? icon : null,
    modifier: modifierOk ? modifier : null,
    corner: modifierOk && corner && CORNERS.includes(corner) ? corner : null,
  };
}

/** Serialize state, omitting defaults so URLs stay short. */
export function serializeState(state: CatalogState, config: Pick<UrlStateConfig, 'styles'>): string {
  const params = new URLSearchParams();
  if (state.q.trim()) params.set('q', state.q);
  if (state.category) params.set('category', state.category);
  if (state.style === 'brands') {
    params.set('style', 'brands');
    if (state.brandStyle !== 'regular') params.set('variant', STYLE_META[state.brandStyle].slug);
  } else if (state.style === 'animated') {
    params.set('style', ANIMATED_SLUG);
  } else if (state.style !== config.styles[0]) {
    params.set('style', STYLE_META[state.style].slug);
  }
  if (state.icon) params.set('icon', state.icon);
  if (state.icon && state.modifier) {
    params.set('modifier', state.modifier);
    if (state.corner) params.set('corner', state.corner);
  }
  const out = params.toString();
  return out ? `?${out}` : '';
}
