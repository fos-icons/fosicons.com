// Turn the single-page build into crawlable static pages.
//
// Every route, in every language (src/i18n/config.ts), gets its own index.html with its real content prerendered
// (so search engines and AI crawlers that don't run JavaScript can read it),
// plus its own title, description, canonical link, Open Graph/Twitter share
// tags, and JSON-LD. 404.html serves the app for unknown paths. Also writes
// robots.txt, sitemap.xml, and llms.txt. The prerender bundle (dist-ssr/)
// is built by `vite build --ssr` and removed afterwards.
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const ssrDir = join(root, 'dist-ssr');
const server = await import(pathToFileURL(join(ssrDir, 'entry-server.js')).href);
const {
  PAGES, PAGE_IDS, pageFor, pageUrl, headTags, facts, absolute, artworkDirectory, catalog, brands,
  SITE_NAME, LIBRARY_URL, FIGMA_URL, FLUTTER_PACKAGE, FRAMEWORK_NAMES, FRAMEWORK_PACKAGES, packageSource,
  LOCALES, webManifest, DEFAULT_LOCALE, localizePath, i18nFor,
  primeArtwork, trackArtwork, takeTrackedArtwork, iconPath, categoryPath, svgFilePath,
  DEFAULT_ARTWORK_SIZE, defaultGridSvg, gridPreviewPath, FRAMEWORK_PATHS, displayName,
} = server;

// Every style's artwork, for prerendering the landing pages and publishing
// one SVG file per icon and style (/svg/<style>/<name>.svg) that pages link
// to, Google Images can index, and anyone can download without JavaScript.
const versionedArtwork = join(dist, artworkDirectory);
mkdirSync(dirname(versionedArtwork), { recursive: true });
renameSync(join(dist, 'icons'), versionedArtwork);
const artwork = Object.fromEntries(catalog.styles.map((style) => [style, JSON.parse(readFileSync(join(versionedArtwork, `${style}.json`), 'utf8'))]));
primeArtwork(artwork);
// Grid previews use the artwork the default interactive grid shows (its
// optical size), so landing-page thumbnails match the home grid exactly.
const previewArtwork = (() => {
  if (DEFAULT_ARTWORK_SIZE === catalog.grid) return artwork.regular;
  const folder = join(versionedArtwork, String(DEFAULT_ARTWORK_SIZE), 'regular');
  return Object.assign({}, ...readdirSync(folder).filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(folder, f), 'utf8'))));
})();
let svgFiles = 0;
mkdirSync(join(dist, 'svg', 'preview'), { recursive: true });
for (const style of catalog.styles) {
  mkdirSync(join(dist, 'svg', style), { recursive: true });
  for (const icon of catalog.icons) {
    const svg = artwork[style][icon.name];
    if (!svg) throw new Error(`Missing ${style} artwork for ${icon.name}`);
    writeFileSync(join(dist, svgFilePath(style, icon.name)), `${svg}\n`);
    if (style === 'regular') {
      const preview = previewArtwork[icon.name];
      if (!preview) throw new Error(`Missing ${DEFAULT_ARTWORK_SIZE}px regular artwork for ${icon.name}`);
      writeFileSync(join(dist, gridPreviewPath(icon.name)), `${defaultGridSvg(preview)}\n`);
    }
    svgFiles += 1;
  }
}

const template = readFileSync(join(dist, 'index.html'), 'utf8');
const META = /<!-- page-meta:start[^>]*-->[\s\S]*?<!-- page-meta:end -->/;
const ROOT = '<div id="root"></div>';
const HTML_TAG = /<html[^>]*>/;
if (!META.test(template) || !template.includes(ROOT)) throw new Error('index.html is missing the page-meta markers or #root');

// Fetch the Latin text fonts with the HTML instead of after the CSS parses.
const assets = readdirSync(join(dist, 'assets'));
const fontPreloads = ['funnel-display-latin-wght-normal', 'asta-sans-latin-wght-normal'].map((stem) => {
  const file = assets.find((f) => f.startsWith(`${stem}-`) && f.endsWith('.woff2'));
  if (!file) throw new Error(`Font not found in dist/assets: ${stem}`);
  return `<link rel="preload" href="/assets/${file}" as="font" type="font/woff2" crossorigin />`;
});
// The home grid's first artwork chunk, so icons paint without waiting for the app.
const homePreloads = [`<link rel="preload" href="/${artworkDirectory}/${catalog.styles[0]}/0.json" as="fetch" crossorigin />`];

const embed = (store) => {
  const used = Object.fromEntries(Object.entries(store).filter(([, svgs]) => Object.keys(svgs).length));
  return Object.keys(used).length
    ? `<script type="application/json" id="fos-artwork">${JSON.stringify(used).replace(/</g, '\\u003c')}</script>`
    : '';
};

async function writePage(file, location, locale, extraPreloads = []) {
  const i18n = await i18nFor(locale);
  const [pathname, search = ''] = location.split('?');
  const page = pageFor(pathname, search ? `?${search}` : '', i18n);
  trackArtwork();
  const body = await server.render(localizePath(location, locale), locale);
  const art = embed(takeTrackedArtwork());
  const preloads = [...fontPreloads, ...extraPreloads];
  const html = template
    .replace(HTML_TAG, `<html lang="${i18n.config.code}" dir="${i18n.dir}">`)
    .replace(META, [headTags(page, i18n), ...preloads].join('\n    '))
    .replace(ROOT, `<div id="root">${body}</div>${art}`);
  mkdirSync(dirname(join(dist, file)), { recursive: true });
  writeFileSync(join(dist, file), html);
  return page;
}

// Every page in every language. Non-default languages live under /<locale>/;
// one 404.html serves every language (the app reads the language from the URL).
const pageFile = (path) => (path === '/' ? 'index.html' : `${path.slice(1)}/index.html`);
const ROUTES = [
  ['/', homePreloads],
  ['/docs'],
  ['/brands'],
  ...Object.values(FRAMEWORK_PATHS).map((path) => [path]),
  ...catalog.categories.map((c) => [categoryPath(c.name)]),
  ...catalog.icons.map((icon) => [iconPath(icon.name)]),
];
let written = 0;
for (const { code } of LOCALES) {
  const prefix = code === DEFAULT_LOCALE ? '' : `${code}/`;
  for (const [location, preloads = [], file] of ROUTES) {
    const page = await writePage(`${prefix}${file ?? pageFile(location)}`, location, code, preloads);
    if (page.id === 'not-found') throw new Error(`Route ${location} prerendered as the 404 page`);
    written += 1;
  }
}
await writePage('404.html', '/404', DEFAULT_LOCALE);
written += 1;

// Every page in every language, each listing its translations (hreflang).
const english = await i18nFor(DEFAULT_LOCALE);
const indexed = [
  ...PAGE_IDS.map((id) => PAGES[id]).filter((page) => !page.noindex),
  ...catalog.categories.map((c) => pageFor(categoryPath(c.name), '', english)),
  ...catalog.icons.map((icon) => pageFor(iconPath(icon.name), '', english)),
];
const urls = indexed.flatMap((page) => LOCALES.map(({ code }) => [
  '  <url>',
  `    <loc>${pageUrl(page, code)}</loc>`,
  ...(LOCALES.length > 1 ? [
    ...LOCALES.map((alt) => `    <xhtml:link rel="alternate" hreflang="${alt.code}" href="${pageUrl(page, alt.code)}" />`),
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${pageUrl(page, DEFAULT_LOCALE)}" />`,
  ] : []),
  ...(page.icon ? catalog.styles.map((style) => [
    '    <image:image>',
    `      <image:loc>${absolute(svgFilePath(style, page.icon.name))}</image:loc>`,
    '    </image:image>',
  ].join('\n')) : []),
  '  </url>',
].join('\n')));
writeFileSync(join(dist, 'sitemap.xml'), [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
  ...urls,
  '</urlset>',
  '',
].join('\n'));

// Search engines and AI assistants are welcome; everything here is public.
writeFileSync(join(dist, 'robots.txt'), [
  'User-agent: *',
  'Allow: /',
  '',
  `Sitemap: ${absolute('/sitemap.xml')}`,
  '',
].join('\n'));

// llms.txt (https://llmstxt.org): a plain summary for AI assistants and answer engines.
const nf = new Intl.NumberFormat('en-US');
const list = (items) => new Intl.ListFormat('en', { type: 'conjunction' }).format(items);
const frameworkPackages = Object.entries(FRAMEWORK_PACKAGES);
writeFileSync(join(dist, 'llms.txt'), [
  `# ${SITE_NAME}`,
  '',
  `> ${SITE_NAME} is a free, open-source icon library: ${nf.format(facts.icons)}+ SVG icons on a 24px grid in ${list(facts.styles)}, under the ${facts.license} license. ${absolute('/')} lets you search the icons, change their color, size, and stroke, and export SVG or PNG.`,
  '',
  'Key facts:',
  '',
  `- ${nf.format(facts.icons)} icons, each in ${facts.styles.length} styles: ${list(facts.styles)}.`,
  `- ${facts.license} licensed, free for personal and commercial use; keep the license notice when you redistribute the files.`,
  `- ${facts.modifiers} reusable modifiers (badges such as add, check, or lock) that can sit in a corner of any icon.`,
  `- ${nf.format(facts.brands)} brand logos (social networks, Google, Microsoft) are offered separately; they belong to their owners and are not covered by the ${facts.license} license.`,
  `- Available as SVG files, a Figma library, and components for ${list(FRAMEWORK_NAMES)}.`,
  '',
  '## Use the icons',
  '',
  `- [Browse and export icons](${absolute('/')}): search by name, tag, or category; copy SVG, framework code, or PNG; download one icon or a ZIP.`,
  `- [Docs](${absolute('/docs')}): styles, SVG, framework setup, Figma, colors, sizes, modifiers, accessibility, licensing, and privacy.`,
  `- [Source library on GitHub](${LIBRARY_URL}): the canonical SVGs, manifest, and metadata.`,
  '- React: `npm install @fos-icons/react` ([npm](https://www.npmjs.com/package/@fos-icons/react))',
  '- Vue 3: `npm install @fos-icons/vue` ([npm](https://www.npmjs.com/package/@fos-icons/vue))',
  ...frameworkPackages.filter(([id]) => id !== 'react' && id !== 'vue').map(([id, { label, name }]) =>
    `- ${label}: \`${name}\` ([Setup](${absolute(`/docs#${id}`)}))`),
  `- Flutter: \`${FLUTTER_PACKAGE.name}\` ([Setup](${absolute('/docs#flutter')}), [Dart package source](${packageSource('flutter')}))`,
  ...(FIGMA_URL ? [`- [Figma library](${FIGMA_URL})`] : []),
  `- [React icons](${absolute(FRAMEWORK_PATHS.react)}), [Vue icons](${absolute(FRAMEWORK_PATHS.vue)}), [Figma icons](${absolute(FRAMEWORK_PATHS.figma)}): getting started with each.`,
  `- Every icon has its own page at ${absolute('/icons/<name>')} (for example [${displayName(catalog.icons[0].name)}](${absolute(iconPath(catalog.icons[0].name))})) and its SVG at ${absolute('/svg/<style>/<name>.svg')}.`,
  '',
  '## Categories',
  '',
  ...catalog.categories.map((c) => `- [${c.name}](${absolute(categoryPath(c.name))}): ${nf.format(c.count)} icons`),
  '',
  '## Optional',
  '',
  `- [Brand icons](${absolute('/brands')}): ${brands.approved.map((b) => b.name).join(', ')}.`,
  '',
].join('\n'));

// Web app manifest: makes the site installable (with public/sw.js).
writeFileSync(join(dist, 'manifest.webmanifest'), JSON.stringify(webManifest(PAGES.home.description), null, 2) + '\n');

// Version the service worker's caches by library revision and build, so a
// new snapshot or deploy never mixes with stale artwork.
const lock = JSON.parse(readFileSync(join(root, 'src/data/source-lock.json'), 'utf8'));
const entry = template.match(/assets\/index-([\w-]+)\.js/)?.[1] ?? 'dev';
const swPath = join(dist, 'sw.js');
writeFileSync(swPath, readFileSync(swPath, 'utf8').replace("const VERSION = 'v1';", `const VERSION = '${(lock.revision ?? 'local').slice(0, 7)}-${entry}';`));

rmSync(ssrDir, { recursive: true, force: true });
console.log(`Prerendered ${written} pages in ${LOCALES.length} language(s); wrote ${svgFiles} SVG files, sitemap.xml (${urls.length} URLs), robots.txt, llms.txt, manifest.webmanifest, sw.js.`);
