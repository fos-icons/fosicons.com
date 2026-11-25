import { BRANDS_CATEGORY, isBrand } from './brands';
import { catalog, iconsByName } from './catalog';
import { browsePath, catalogRoute, legacyCatalogDestination as legacyDestination, type CatalogLocation, type EditorState } from './catalog-routing';
import { categoryBySlug, iconPath } from './icon-pages';
import { serializeState, type CatalogState } from './url-state';

export { isCatalogEditor } from './catalog-routing';

/** Derive the selection and category from the path; a grid visit keeps its original filter. */
export function catalogRouteFilters(location: CatalogLocation): Partial<Pick<CatalogState, 'category' | 'icon'>> {
  const route = catalogRoute(location.pathname);
  const history = location.state as Partial<EditorState> | null;
  if (route?.kind === 'category') return { category: route.category };
  if (route?.kind === 'brands') return { category: history?.category !== undefined ? history.category : route.category };
  if (route?.kind !== 'icon' || !iconsByName.has(route.icon)) return {};
  const from = new URLSearchParams(location.search).get('from');
  const category = from === 'brands' ? BRANDS_CATEGORY : from && categoryBySlug(from)?.name;
  return { icon: route.icon, category: history?.category ?? category ?? null };
}

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
export const legacyCatalogDestination = (search: string) => legacyDestination(search, (name) => iconsByName.has(name));
