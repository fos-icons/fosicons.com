import { splitLocale } from '../i18n/config';
import { BRANDS_CATEGORY, isBrand } from './brands';
import { catalog, iconsByName } from './catalog';
import { categoryBySlug, categoryPath, categorySlug, iconPath } from './icon-pages';
import { serializeState, type CatalogState } from './url-state';

type CatalogLocation = { pathname: string; search: string; state?: unknown };
type EditorState = { catalogEditor: true; category?: string | null };

function catalogRoute(pathname: string) {
  const path = splitLocale(pathname).path.replace(/\/+$/, '') || '/';
  if (path === '/') return { kind: 'home' } as const;
  if (path === '/brands') return { kind: 'brands', category: BRANDS_CATEGORY } as const;
  const slug = /^\/categories\/([a-z0-9-]+)$/.exec(path)?.[1];
  const category = slug && categoryBySlug(slug);
  if (category) return { kind: 'category', category: category.name } as const;
  const icon = /^\/icons\/([a-z0-9-]+)$/.exec(path)?.[1];
  return icon && iconsByName.has(icon) ? { kind: 'icon', icon } as const : null;
}

/** A click in the grid keeps it open. A fresh visit to an unfiltered path opens its landing page. */
export function isCatalogEditor(location: CatalogLocation) {
  const route = catalogRoute(location.pathname);
  if (!route) return false;
  if (route.kind === 'home' || route.kind === 'brands') return true;
  const query = new URLSearchParams(location.search);
  const history = location.state as Partial<EditorState> | null;
  return history?.catalogEditor === true || query.get('view') === 'editor' || query.has('q')
    || (route.kind === 'category' && query.has('style'));
}

/** Derive the selection and category from the path; a grid visit keeps its original filter. */
export function catalogRouteFilters(location: CatalogLocation): Partial<Pick<CatalogState, 'category' | 'icon'>> {
  const route = catalogRoute(location.pathname);
  const history = location.state as Partial<EditorState> | null;
  if (route?.kind === 'category') return { category: route.category };
  if (route?.kind === 'brands') return { category: history?.category !== undefined ? history.category : route.category };
  if (route?.kind !== 'icon') return {};
  const from = new URLSearchParams(location.search).get('from');
  const category = from === 'brands' ? BRANDS_CATEGORY : from && categoryBySlug(from)?.name;
  return { icon: route.icon, category: history?.category ?? category ?? null };
}

const browsePath = (category: string | null) =>
  category === BRANDS_CATEGORY ? '/brands' : category ? categoryPath(category) : '/';

/** Catalog interactions put the selected category or core icon in the pathname. */
export function catalogEditorLocation(state: CatalogState) {
  const coreIcon = state.icon && iconsByName.has(state.icon) ? state.icon : null;
  const brands = state.style === 'brands' || (state.icon !== null && isBrand(state.icon));
  const category = state.style === 'brands' ? BRANDS_CATEGORY : state.category;
  const pathname = coreIcon ? iconPath(coreIcon) : brands ? '/brands' : browsePath(category);
  const params = new URLSearchParams(serializeState(state, catalog));
  params.delete('category');
  if (coreIcon) params.delete('icon');
  if (state.style === 'brands') params.delete('style');
  const query = params.toString();
  return {
    href: `${pathname}${query ? `?${query}` : ''}`,
    state: { catalogEditor: true, category } satisfies EditorState,
  };
}

/** Move old catalog deep links to their clean paths and retain meaningful query options. */
export function legacyCatalogDestination(search: string): string | null {
  if (!search) return null;
  const params = new URLSearchParams(search);
  const icon = params.get('icon');
  const categoryParam = params.get('category');
  const legacyBrands = params.get('style') === 'brands';
  const category = categoryParam === BRANDS_CATEGORY || (legacyBrands && !categoryParam)
    ? BRANDS_CATEGORY : catalog.categories.find((entry) => entry.name === categoryParam)?.name ?? null;
  const coreIcon = icon && iconsByName.has(icon) ? icon : null;
  const brand = icon && isBrand(icon);
  if (!coreIcon && !brand && !category) return null;

  const pathname = coreIcon ? iconPath(coreIcon) : brand ? '/brands' : browsePath(category);
  params.delete('category');
  if (!brand) params.delete('icon');
  if (legacyBrands) params.delete('style');
  if (coreIcon && (category || params.has('modifier') || params.has('style'))) {
    params.set('view', 'editor');
    if (category) params.set('from', categorySlug(category));
  }
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ''}`;
}
