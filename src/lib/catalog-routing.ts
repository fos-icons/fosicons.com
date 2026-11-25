import { splitLocale } from '../i18n/config';
import { BRANDS_CATEGORY, isBrand } from './brands';
import { catalogMeta } from './catalog-meta';
import { categoryBySlug, categoryPath, categorySlug, iconPath } from './icon-pages';

export type CatalogLocation = { pathname: string; search: string; state?: unknown };
export type EditorState = { catalogEditor: true; category?: string | null };

export function catalogRoute(pathname: string) {
  const path = splitLocale(pathname).path.replace(/\/+$/, '') || '/';
  if (path === '/') return { kind: 'home' } as const;
  if (path === '/brands') return { kind: 'brands', category: BRANDS_CATEGORY } as const;
  const slug = /^\/categories\/([a-z0-9-]+)$/.exec(path)?.[1];
  const category = slug && categoryBySlug(slug);
  if (category) return { kind: 'category', category: category.name } as const;
  const icon = /^\/icons\/([a-z0-9-]+)$/.exec(path)?.[1];
  return icon ? { kind: 'icon', icon } as const : null;
}

/** Route shape only: icon names are validated when the catalog page loads. */
export function isCatalogEditor(location: CatalogLocation) {
  const route = catalogRoute(location.pathname);
  if (!route) return false;
  if (route.kind === 'home' || route.kind === 'brands') return true;
  const query = new URLSearchParams(location.search);
  const history = location.state as Partial<EditorState> | null;
  return history?.catalogEditor === true || query.get('view') === 'editor' || query.has('q')
    || (route.kind === 'category' && query.has('style'));
}

export const browsePath = (category: string | null) =>
  category === BRANDS_CATEGORY ? '/brands' : category ? categoryPath(category) : '/';

export function legacyCatalogDestination(search: string, hasIcon: (name: string) => boolean): string | null {
  if (!search) return null;
  const params = new URLSearchParams(search);
  const icon = params.get('icon');
  const categoryParam = params.get('category');
  const legacyBrands = params.get('style') === 'brands';
  const category = categoryParam === BRANDS_CATEGORY || (legacyBrands && !categoryParam)
    ? BRANDS_CATEGORY : catalogMeta.categories.find((entry) => entry.name === categoryParam)?.name ?? null;
  const coreIcon = icon && hasIcon(icon) ? icon : null;
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
