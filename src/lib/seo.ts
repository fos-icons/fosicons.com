import { createI18n, DEFAULT_LOCALE, type I18n } from '../i18n';
import { iconsByName } from './catalog';
import { iconEntryMeta, pageFor as routeMeta, type PageId, type PageMeta } from './seo-meta';

export * from './seo-meta';

export function iconMeta(name: string, i18n: I18n = createI18n(DEFAULT_LOCALE)): PageMeta | null {
  const icon = iconsByName.get(name);
  return icon ? iconEntryMeta(icon, i18n) : null;
}

export function pageFor(pathname: string, search = '', i18n?: I18n): PageMeta {
  return routeMeta(pathname, search, i18n, (name) => iconsByName.get(name));
}

export const pageIdFor = (pathname: string, search = ''): PageId => pageFor(pathname, search).id;
