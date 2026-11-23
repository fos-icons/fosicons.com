import { createI18n, DEFAULT_LOCALE, LOCALES, localizePath, splitLocale, type I18n, type MessageKey } from '../i18n';
import { brands } from './brands';
import { catalog, ICONS_ROUNDED, ICON_VARIANTS_ROUNDED, iconsByName, MODIFIER_COMBINATIONS_ROUNDED, STYLE_META, type IconEntry } from './catalog';
import { legacyCatalogDestination } from './catalog-location';
import {
  categoryBySlug, categoryPath, displayAliases, displayName, FRAMEWORK_PATHS, iconPath, svgFilePath,
} from './icon-pages';
import { FIGMA_URL, FLUTTER_PACKAGE, LIBRARY_URL, PLATFORM_NAMES } from './links';

/**
 * Search, AI-answer, and social-share metadata for every page. The build
 * writes it into each page's static HTML (scripts/postbuild.mjs); the app
 * keeps the title, description, and canonical link current while you navigate.
 * Icon and style counts follow the synced catalog.
 */

/** The production origin. Vercel redirects fosicons.com here, so canonical links must use www. */
export const SITE_URL = 'https://www.fosicons.com';
export const SITE_NAME = 'Fos Icons';
export const GITHUB_ORG_URL = 'https://github.com/fos-icons';
export const NPM_REACT_URL = 'https://www.npmjs.com/package/@fos-icons/react';
export const NPM_VUE_URL = 'https://www.npmjs.com/package/@fos-icons/vue';

export const SHARE_IMAGE = { path: '/og-image.png', width: 1200, height: 630 };

export const facts = {
  /** Rounded down to the hundred; copy shows it as "1,200+". */
  icons: ICONS_ROUNDED,
  styles: catalog.styles.map((s) => STYLE_META[s].label),
  categories: catalog.categories,
  modifiers: Object.keys(catalog.modifiers).length,
  brands: brands.approved.length,
  license: catalog.license,
};

/** Pages with one fixed URL. */
export type StaticPageId = 'home' | 'docs' | 'brands' | 'not-found' | 'react' | 'vue' | 'figma';
export type PageId = StaticPageId | 'icon' | 'category';

export interface PageMeta {
  id: PageId;
  /** Canonical path in the default language, without a trailing slash (except the root). */
  path: string;
  title: string;
  description: string;
  /** Keep out of search results (the 404 page). */
  noindex?: boolean;
  /** The icon an icon page shows. */
  icon?: IconEntry;
  /** The category a category page lists. */
  category?: { name: string; count: number };
}

const PATHS: Record<StaticPageId, string> = {
  home: '/', docs: '/docs', brands: '/brands', 'not-found': '/404',
  react: FRAMEWORK_PATHS.react, vue: FRAMEWORK_PATHS.vue, figma: FRAMEWORK_PATHS.figma,
};
const META_KEYS = {
  home: ['meta.home.title', 'meta.home.description'],
  docs: ['meta.docs.title', 'meta.docs.description'],
  brands: ['meta.brands.title', 'meta.brands.description'],
  'not-found': ['meta.notFound.title', 'meta.notFound.description'],
  react: ['meta.react.title', 'meta.react.description'],
  vue: ['meta.vue.title', 'meta.vue.description'],
  figma: ['meta.figma.title', 'meta.figma.description'],
} as const satisfies Record<StaticPageId, readonly [MessageKey, MessageKey]>;

export const PAGE_IDS = Object.keys(PATHS) as StaticPageId[];

const TITLE_MAX = 60;
const DESCRIPTION_MAX = 160;
/** The first title that fits a search result, else the last one. */
const fit = (titles: string[]) => titles.find((t) => t.length <= TITLE_MAX) ?? titles[titles.length - 1];
const clip = (text: string) => (text.length <= DESCRIPTION_MAX ? text : `${text.slice(0, DESCRIPTION_MAX - 1).replace(/[\s,;:]+\S*$/, '')}…`);

const styleList = (i18n: I18n) => i18n.list(catalog.styles.map((s) => i18n.t(`style.${s}`)));

/** A fixed page's metadata in a language; counts come from the catalog. */
export function pageMeta(id: StaticPageId, i18n: I18n = createI18n(DEFAULT_LOCALE)): PageMeta {
  const vars = {
    icons: facts.icons,
    variants: ICON_VARIANTS_ROUNDED,
    combinations: MODIFIER_COMBINATIONS_ROUNDED,
    styles: styleList(i18n),
    platforms: i18n.list(PLATFORM_NAMES),
    license: facts.license,
    modifiers: facts.modifiers,
    brands: facts.brands,
  };
  const [title, description] = META_KEYS[id];
  return { id, path: PATHS[id], title: i18n.t(title, vars), description: i18n.t(description, vars), noindex: id === 'not-found' };
}

/** An icon page's metadata, or null for an unknown icon. */
export function iconMeta(name: string, i18n: I18n = createI18n(DEFAULT_LOCALE)): PageMeta | null {
  const icon = iconsByName.get(name);
  if (!icon) return null;
  const vars = { name: displayName(name), platforms: i18n.list(PLATFORM_NAMES) };
  return {
    id: 'icon',
    path: iconPath(name),
    title: fit([i18n.t('meta.icon.title', vars), i18n.t('meta.icon.titleShort', vars), i18n.t('meta.icon.titleShortest', vars)]),
    description: clip(i18n.t('meta.icon.description', vars)),
    icon,
  };
}

/** A category page's metadata, or null for an unknown category. */
export function categoryMeta(slug: string, i18n: I18n = createI18n(DEFAULT_LOCALE)): PageMeta | null {
  const category = categoryBySlug(slug);
  if (!category) return null;
  const name = i18n.label('category', category.name, category.name);
  // Title case for the title ("Food & Drink Icons"); sentence case reads better in the description.
  const titled = name.replace(/(^|\s)(\p{Ll})/gu, (_, space: string, letter: string) => space + letter.toLocaleUpperCase(i18n.config.code));
  const vars = { category: name, count: category.count, platforms: i18n.list(PLATFORM_NAMES) };
  const titleVars = { ...vars, category: titled };
  return {
    id: 'category',
    path: categoryPath(category.name),
    title: fit([i18n.t('meta.category.title', titleVars), i18n.t('meta.category.titleShort', titleVars)]),
    description: clip(i18n.t('meta.category.description', vars)),
    category,
  };
}

/** English metadata for every fixed page (for the build's sitemap and llms.txt). */
export const PAGES = Object.fromEntries(PAGE_IDS.map((id) => [id, pageMeta(id)])) as Record<StaticPageId, PageMeta>;

/** The metadata for a location in the app, in a language (the path may include a language prefix). */
export function pageFor(pathname: string, search = '', i18n: I18n = createI18n(DEFAULT_LOCALE)): PageMeta {
  const path = splitLocale(pathname).path.replace(/\/+$/, '') || '/';
  if (path === '/') {
    const legacy = legacyCatalogDestination(search);
    return legacy ? pageFor(legacy.split('?')[0], '', i18n) : pageMeta('home', i18n);
  }
  const fixed = PAGE_IDS.find((id) => id !== 'home' && id !== 'not-found' && PATHS[id] === path);
  if (fixed) return pageMeta(fixed, i18n);
  const icon = /^\/icons\/([a-z0-9-]+)$/.exec(path);
  if (icon) return iconMeta(icon[1], i18n) ?? pageMeta('not-found', i18n);
  const category = /^\/categories\/([a-z0-9-]+)$/.exec(path);
  if (category) return categoryMeta(category[1], i18n) ?? pageMeta('not-found', i18n);
  return pageMeta('not-found', i18n);
}

/** Which page a location shows. */
export const pageIdFor = (pathname: string, search = ''): PageId => pageFor(pathname, search).id;

export const absolute = (path: string) => `${SITE_URL}${path}`;

const ORGANIZATION = {
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  logo: absolute('/apple-touch-icon.png'),
  sameAs: [GITHUB_ORG_URL, NPM_REACT_URL, NPM_VUE_URL, ...(FIGMA_URL ? [FIGMA_URL] : [])],
};

const platformKeywords = [...PLATFORM_NAMES.map((name) => `${name} icons`), FLUTTER_PACKAGE.name, 'Dart icons'];

/** A page's URL in a language. */
export const pageUrl = (page: Pick<PageMeta, 'path'>, locale: string) => absolute(localizePath(page.path, locale));

/** schema.org structured data for a page, as one JSON-LD graph. */
export function structuredData(page: PageMeta, i18n: I18n = createI18n(DEFAULT_LOCALE)): object {
  const lang = i18n.config.code;
  const url = pageUrl(page, lang);
  const home = pageMeta('home', i18n);
  const imageUrl = page.icon ? absolute(svgFilePath(catalog.styles[0], page.icon.name)) : null;
  const webPage = {
    '@type': { docs: 'TechArticle', react: 'TechArticle', vue: 'TechArticle', icon: 'ItemPage', category: 'CollectionPage' }[page.id as string] ?? 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: page.title,
    ...(['docs', 'react', 'vue'].includes(page.id) ? { headline: page.title } : {}),
    description: page.description,
    ...(['docs', 'icon', 'category'].includes(page.id) ? {
      keywords: [...(page.icon ? [page.icon.name, ...page.icon.tags] : []), ...platformKeywords].join(', '),
    } : {}),
    isPartOf: { '@id': `${SITE_URL}/#website` },
    publisher: { '@id': `${SITE_URL}/#organization` },
    primaryImageOfPage: imageUrl ? { '@id': `${url}#image` } : absolute(SHARE_IMAGE.path),
    inLanguage: lang,
  };
  const graph: object[] = [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: SITE_NAME,
      description: home.description,
      publisher: { '@id': `${SITE_URL}/#organization` },
      inLanguage: LOCALES.map((l) => l.code),
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${pageUrl(home, lang)}?q={search_term_string}` },
        'query-input': 'required name=search_term_string',
      },
    },
    ORGANIZATION,
    webPage,
  ];
  if (page.id === 'home') {
    graph.push({
      '@type': 'SoftwareSourceCode',
      '@id': `${SITE_URL}/#library`,
      name: SITE_NAME,
      description: i18n.t('meta.library.description', {
        icons: facts.icons,
        styles: i18n.list(catalog.styles.map((s) => i18n.t(`style.${s}`))),
        modifiers: facts.modifiers,
        flutterPackage: FLUTTER_PACKAGE.name,
      }),
      codeRepository: LIBRARY_URL,
      programmingLanguage: ['SVG', 'TypeScript', 'Dart'],
      license: 'https://opensource.org/licenses/MIT',
      isAccessibleForFree: true,
      author: { '@id': `${SITE_URL}/#organization` },
      keywords: ['icons', 'SVG icons', 'icon library', ...platformKeywords, ...facts.styles.map((s) => `${s.toLowerCase()} icons`)].join(', '),
    });
  } else if (!page.noindex) {
    const crumbs: [string, string][] = [[SITE_NAME, pageUrl(home, lang)]];
    const category = page.category?.name ?? page.icon?.category;
    if (category) {
      crumbs.push([i18n.t('categoryPage.heading', { category: i18n.label('category', category, category) }), pageUrl({ path: categoryPath(category) }, lang)]);
    }
    if (page.id !== 'category') {
      crumbs.push([page.icon ? i18n.t('iconPage.heading', { name: displayName(page.icon.name) }) : page.title.split(/ [—|] /)[0], url]);
    }
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })),
    });
  }
  if (page.icon && imageUrl) {
    graph.push({
      '@type': 'ImageObject',
      '@id': `${url}#image`,
      name: i18n.t('iconPage.heading', { name: displayName(page.icon.name) }),
      description: page.description,
      contentUrl: imageUrl,
      encodingFormat: 'image/svg+xml',
      width: catalog.grid,
      height: catalog.grid,
      keywords: [page.icon.name, ...page.icon.tags, ...displayAliases(page.icon)].join(', '),
      license: 'https://opensource.org/licenses/MIT',
      acquireLicensePage: absolute('/docs#licensing'),
      creditText: SITE_NAME,
      creator: { '@id': `${SITE_URL}/#organization` },
      copyrightNotice: `${SITE_NAME} contributors`,
      isAccessibleForFree: true,
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

const escapeAttr = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeText = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Every head tag that varies by page and language, for the static HTML:
 * title, description, robots, canonical, hreflang alternates for every
 * language (plus x-default), Open Graph and X/Twitter tags, and JSON-LD.
 */
export function headTags(page: PageMeta, i18n: I18n = createI18n(DEFAULT_LOCALE)): string {
  const lang = i18n.config.code;
  const url = pageUrl(page, lang);
  const image = absolute(SHARE_IMAGE.path);
  const imageAlt = i18n.t('meta.shareImageAlt');
  const meta = (attr: 'name' | 'property', key: string, value: string) => `<meta ${attr}="${key}" content="${escapeAttr(value)}" />`;
  const json = JSON.stringify(structuredData(page, i18n)).replace(/</g, '\\u003c');
  const alternates = page.noindex ? [] : [
    ...LOCALES.map((l) => `<link rel="alternate" hreflang="${l.code}" href="${pageUrl(page, l.code)}" />`),
    `<link rel="alternate" hreflang="x-default" href="${pageUrl(page, DEFAULT_LOCALE)}" />`,
  ];
  return [
    `<title>${escapeText(page.title)}</title>`,
    meta('name', 'description', page.description),
    page.noindex ? meta('name', 'robots', 'noindex, follow') : meta('name', 'robots', 'index, follow, max-image-preview:large, max-snippet:-1'),
    page.noindex ? '' : `<link rel="canonical" href="${url}" />`,
    ...alternates,
    meta('property', 'og:type', 'website'),
    meta('property', 'og:site_name', SITE_NAME),
    meta('property', 'og:locale', i18n.config.ogLocale),
    ...LOCALES.filter((l) => l.code !== lang).map((l) => meta('property', 'og:locale:alternate', l.ogLocale)),
    meta('property', 'og:title', page.title),
    meta('property', 'og:description', page.description),
    meta('property', 'og:url', url),
    meta('property', 'og:image', image),
    meta('property', 'og:image:type', 'image/png'),
    meta('property', 'og:image:width', String(SHARE_IMAGE.width)),
    meta('property', 'og:image:height', String(SHARE_IMAGE.height)),
    meta('property', 'og:image:alt', imageAlt),
    meta('name', 'twitter:card', 'summary_large_image'),
    meta('name', 'twitter:title', page.title),
    meta('name', 'twitter:description', page.description),
    meta('name', 'twitter:image', image),
    meta('name', 'twitter:image:alt', imageAlt),
    `<script type="application/ld+json">${json}</script>`,
  ].filter(Boolean).join('\n    ');
}
