/**
 * Read-only icon lookups behind the MCP server. Pure functions over the
 * synchronized catalog, so they run the same in Vercel, Vite dev, and tests.
 *
 * This module imports the catalog JSON directly rather than src/lib/catalog.ts,
 * which also carries browser-only artwork loading.
 */
import catalogData from '../../src/data/catalog.json' with { type: 'json' };
import regularArtwork from '../../public/icons/regular.json' with { type: 'json' };
import type { IconEntry, StyleId } from '../../src/lib/catalog.js';
import { createIndex, search, suggest } from '../../src/lib/search.js';
import {
  angularSnippet, componentName, reactSnippet, solidSnippet, svelteSnippet, vueSnippet, type SnippetOptions,
} from '../../src/lib/react-snippet.js';
import { isDuo } from '../../src/lib/svg.js';

export const SITE = 'https://www.fosicons.com';
const LIBRARY = 'https://github.com/fos-icons/fos-icons';

const catalog = catalogData as unknown as {
  license: string;
  sizes: number[];
  styles: StyleId[];
  categories: { name: string; count: number }[];
  icons: IconEntry[];
};
const regular = regularArtwork as Record<string, string>;

export const STYLES = ['regular', 'filled', 'duocolor', 'duotone'] as const satisfies readonly StyleId[];
export const FRAMEWORKS = ['react', 'vue', 'svelte', 'solid', 'angular', 'flutter', 'svg'] as const;
export type Framework = (typeof FRAMEWORKS)[number];
export const CATEGORIES = catalog.categories.map((c) => c.name);

const index = createIndex(catalog.icons);
const byName = new Map(catalog.icons.map((icon) => [icon.name, icon]));

/** What a search result or listing says about one icon. */
export interface IconSummary {
  name: string;
  category: string;
  tags: string[];
  /** Component name per style, the same in React, Vue, Svelte, SolidJS and Angular. */
  components: Record<StyleId, string>;
  url: string;
}

export const iconUrl = (name: string) => `${SITE}/icons/${name}`;

/** Flutter constant: lower camel case plus the style, `icon` prefix before a digit. */
export function flutterName(name: string, style: StyleId): string {
  const camel = name.split('-').map((part, i) => (i ? part[0].toUpperCase() + part.slice(1) : part)).join('');
  const full = `${camel}${style[0].toUpperCase()}${style.slice(1)}`;
  return /^\d/.test(full) ? `icon${full[0].toUpperCase()}${full.slice(1)}` : full;
}

function summarize(icon: IconEntry): IconSummary {
  return {
    name: icon.name,
    category: icon.category,
    tags: icon.tags,
    components: Object.fromEntries(STYLES.map((style) => [style, componentName(icon.name, style)])) as Record<StyleId, string>,
    url: iconUrl(icon.name),
  };
}

/* ── search_icons ─────────────────────────────────────────────────────── */

export interface SearchResult {
  query: string;
  total: number;
  icons: IconSummary[];
  /** Close matches, only when nothing matched every word. */
  suggestions?: string[];
}

export function searchIcons(queries: string[], options: { category?: string; limit?: number } = {}): SearchResult[] {
  const limit = options.limit ?? 10;
  return queries.map((query) => {
    const found = search(index, query, options.category ?? null);
    const result: SearchResult = { query, total: found.length, icons: found.slice(0, limit).map(summarize) };
    if (!found.length) result.suggestions = suggest(index, query, 5).map((icon) => icon.name);
    return result;
  });
}

/* ── check_icon_names ─────────────────────────────────────────────────── */

/**
 * Every code identifier the packages export, mapped back to its icon:
 * component names (`FuelPumpRegular`) and Flutter constants (`fuelPumpFilled`).
 * Exact lookups, so no guessing where hyphens and digits went.
 */
const byIdentifier = new Map<string, { name: string; style: StyleId }>();
for (const icon of catalog.icons) {
  for (const style of STYLES) {
    byIdentifier.set(componentName(icon.name, style), { name: icon.name, style });
    byIdentifier.set(flutterName(icon.name, style), { name: icon.name, style });
  }
}

/**
 * Resolve canonical names (`fuel-pump`) and the names agents tend to write
 * instead: component names (`FuelPumpRegular`, `<FuelPumpRegular />`),
 * Flutter constants (`FosIcons.fuelPumpFilled`), a component name without
 * its style (`FuelPump`), spaces and underscores. Returns the input
 * kebab-cased when nothing matches.
 */
export function canonicalName(input: string): { name: string; style?: StyleId } {
  const trimmed = input.trim().replace(/^<\s*/, '').replace(/\s*\/?>$/, '').replace(/^FosIcons\./, '');
  const kebab = trimmed.replace(/[\s_]+/g, '-').toLowerCase();
  if (byName.has(kebab)) return { name: kebab };
  const exact = byIdentifier.get(trimmed) ?? byIdentifier.get(`${trimmed}Regular`);
  if (exact) return exact.style === 'regular' && !trimmed.endsWith('Regular') ? { name: exact.name } : exact;
  return { name: trimmed.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase() };
}

export interface NameCheck {
  input: string;
  valid: boolean;
  /** The canonical name, when the input resolves to a real icon. */
  name?: string;
  style?: StyleId;
  /** Closest real icons, when it doesn't. */
  suggestions?: string[];
}

export function checkIconNames(names: string[]): NameCheck[] {
  return names.map((input) => {
    const { name, style } = canonicalName(input);
    if (byName.has(name)) return { input, valid: true, name, ...(style ? { style } : {}) };
    return { input, valid: false, suggestions: suggest(index, name.replace(/-/g, ' '), 5).map((icon) => icon.name) };
  });
}

/* ── list_icons ───────────────────────────────────────────────────────── */

export interface IconList {
  category: string | null;
  total: number;
  offset: number;
  icons: IconSummary[];
  /** Offset for the next page, or null after the last one. */
  nextOffset: number | null;
  categories: { name: string; count: number }[];
}

export function listIcons(options: { category?: string; offset?: number; limit?: number } = {}): IconList {
  const offset = options.offset ?? 0;
  const limit = options.limit ?? 50;
  const pool = options.category ? catalog.icons.filter((icon) => icon.category === options.category) : catalog.icons;
  const page = [...pool].sort((a, b) => a.name.localeCompare(b.name)).slice(offset, offset + limit);
  return {
    category: options.category ?? null,
    total: pool.length,
    offset,
    icons: page.map(summarize),
    nextOffset: offset + limit < pool.length ? offset + limit : null,
    categories: catalog.categories,
  };
}

/* ── get_framework_setup ──────────────────────────────────────────────── */

export interface FrameworkSetup {
  framework: Framework;
  package: string;
  /** False until the package is on its registry; install from a local build. */
  published: boolean;
  install: string;
  naming: string;
  props: string;
  example: string;
  accessibility: string;
  docs: string;
}

const SAMPLE: SnippetOptions = { size: 32, color: null, primary: '#245B9E', secondary: '#60A5FA' };
const COMPONENT_NAMING =
  'Each style is its own component: the icon name in PascalCase plus the style suffix. fuel-pump → FuelPumpRegular, FuelPumpFilled, FuelPumpDuocolor, FuelPumpDuotone. The style shown as "Solid" on the website uses the Filled suffix. Names starting with a digit get an Icon prefix.';
const COMPONENT_PROPS =
  'size (default 24, scales the 24px artwork), color for Regular and Filled (defaults to currentColor), primaryColor and secondaryColor for Duocolor and Duotone, modifierColor for named presets with a badge glyph, title for meaningful icons.';
const DECORATIVE =
  'Icons are decorative by default (aria-hidden). Give a meaningful standalone icon a title or aria-label, and give icon-only buttons their own accessible name.';

function tarballInstall(id: 'svelte' | 'solid' | 'angular', extra = '') {
  return [
    'Not on npm yet. Build a local tarball from the library and install it:',
    `git clone ${LIBRARY}.git`,
    `cd fos-icons/packages/${id} && npm ci && npm pack`,
    `npm install /path/to/fos-icons/packages/${id}/fos-icons-${id}-<version>.tgz${extra}`,
  ].join('\n');
}

export function frameworkSetup(framework: Framework): FrameworkSetup {
  const docs = `${SITE}/docs#${framework}`;
  switch (framework) {
    case 'react':
      return {
        framework, package: '@fos-icons/react', published: true, install: 'npm install @fos-icons/react',
        naming: COMPONENT_NAMING, props: COMPONENT_PROPS, example: reactSnippet('camera', 'duocolor', SAMPLE),
        accessibility: DECORATIVE, docs,
      };
    case 'vue':
      return {
        framework, package: '@fos-icons/vue', published: true, install: 'npm install @fos-icons/vue',
        naming: COMPONENT_NAMING, props: `${COMPONENT_PROPS} In templates, use kebab-case attributes (primary-color).`,
        example: vueSnippet('camera', 'duocolor', SAMPLE), accessibility: DECORATIVE, docs,
      };
    case 'svelte':
      return {
        framework, package: '@fos-icons/svelte', published: false, install: tarballInstall('svelte'),
        naming: COMPONENT_NAMING, props: `${COMPONENT_PROPS} Also strokeWidth. Requires Svelte 5.20 or later.`,
        example: svelteSnippet('camera', 'duocolor', SAMPLE), accessibility: DECORATIVE, docs,
      };
    case 'solid':
      return {
        framework, package: '@fos-icons/solid', published: false,
        install: tarballInstall('solid', ' solid-js@2.0.0-rc.21 @solidjs/web@2.0.0-rc.21'),
        naming: `${COMPONENT_NAMING} SolidJS the framework is unrelated to the Solid icon style.`,
        props: `${COMPONENT_PROPS} Also strokeWidth. Requires Solid 2; Solid 1.x is not supported.`,
        example: solidSnippet('camera', 'duocolor', SAMPLE), accessibility: DECORATIVE, docs,
      };
    case 'angular':
      return {
        framework, package: '@fos-icons/angular', published: false, install: tarballInstall('angular'),
        naming: `${COMPONENT_NAMING} The selector goes on a native <svg> element: <svg fos-camera-regular></svg>.`,
        props: `${COMPONENT_PROPS} Bind numbers with [size]="32". Use title or label for meaningful icons. Angular 20 to 22.`,
        example: angularSnippet('camera', 'duocolor', SAMPLE), accessibility: DECORATIVE, docs,
      };
    case 'flutter':
      return {
        framework, package: 'fos_icons', published: false,
        install: [
          'Not on pub.dev yet. Clone the library and add a path dependency to pubspec.yaml:',
          `git clone ${LIBRARY}.git`,
          'dependencies:\n  fos_icons:\n    path: ../fos-icons/packages/flutter',
        ].join('\n'),
        naming: 'Constants on FosIcons: the icon name in lower camel case plus the style. fuel-pump → FosIcons.fuelPumpRegular, fuelPumpFilled, fuelPumpDuocolor, fuelPumpDuotone. Names starting with a digit get an icon prefix.',
        props: 'FosIcon(glyph, size:, color:, primaryColor:, secondaryColor:, modifierColor:, strokeWidth:, semanticLabel:). Regular and Filled follow IconTheme. Requires Flutter 3.44 or later.',
        example: flutterSnippet('camera', 'duocolor', SAMPLE),
        accessibility: 'Icons are decorative by default. Pass semanticLabel for a meaningful standalone icon.',
        docs,
      };
    case 'svg':
      return {
        framework, package: 'none (plain SVG)', published: true,
        install: `No package. Regular SVGs are served at ${SITE}/svg/regular/<name>.svg; every style is in the library repository under icons/<style>/<name>.svg (${LIBRARY}).`,
        naming: 'Files use the canonical kebab-case name: icons/regular/fuel-pump.svg. The Solid style lives in icons/filled/.',
        props: 'Inline the markup to theme with CSS: strokes and fills use currentColor, so they follow the parent element\'s color. Do not override fill globally; Filled icons rely on transparent cutouts.',
        example: `<img src="${SITE}/svg/regular/camera.svg" width="24" height="24" alt="Camera">`,
        accessibility: 'Give a meaningful <img> an alt text; use alt="" or aria-hidden="true" for decorative icons.',
        docs: `${SITE}/docs#svg`,
      };
  }
}

/* ── get_icon_code ────────────────────────────────────────────────────── */

function flutterSnippet(name: string, style: StyleId, options: SnippetOptions): string {
  const args = [`FosIcons.${flutterName(name, style)}`];
  if (options.size !== 24) args.push(`size: ${options.size}`);
  const dart = (hex: string) => `Color(0xFF${hex.replace('#', '').toUpperCase()})`;
  if (isDuo(style)) {
    if (options.primary) args.push(`primaryColor: ${dart(options.primary)}`);
    if (options.secondary && style === 'duocolor') args.push(`secondaryColor: ${dart(options.secondary)}`);
  } else if (options.color) {
    args.push(`color: ${dart(options.color)}`);
  }
  if (options.modifier) args.push(`modifierColor: ${dart(options.modifier)}`);
  return `import 'package:fos_icons/fos_icons.dart';\n\nFosIcon(\n  ${args.join(',\n  ')},\n)`;
}

export interface IconCode {
  name: string;
  style: StyleId;
  framework: Framework;
  package: string;
  install: string;
  /** Component, Flutter constant, or file path. */
  identifier: string;
  code: string;
  /** Inline Regular SVG (24px), only for framework "svg" and style "regular". */
  svg?: string;
  url: string;
  docs: string;
  notes: string[];
}

export class UnknownIconError extends Error {
  constructor(readonly input: string, readonly suggestions: string[]) {
    super(`No icon named "${input}".${suggestions.length ? ` Closest: ${suggestions.join(', ')}.` : ''} Use search_icons to find one.`);
  }
}

export function iconCode(
  input: string,
  framework: Framework,
  options: { style?: StyleId; size?: number; color?: string; primaryColor?: string; secondaryColor?: string } = {},
): IconCode {
  const resolved = canonicalName(input);
  const icon = byName.get(resolved.name);
  if (!icon) throw new UnknownIconError(input, checkIconNames([input])[0].suggestions ?? []);
  const style = options.style ?? resolved.style ?? 'regular';
  const snippet: SnippetOptions = {
    size: options.size ?? 24,
    color: options.color ?? null,
    primary: options.primaryColor,
    secondary: options.secondaryColor,
  };
  const setup = frameworkSetup(framework);
  const notes: string[] = [];
  if (!setup.published) notes.push(`${setup.package} is not published to its registry yet; see install.`);
  if (style === 'filled') notes.push('The website calls this style "Solid"; code uses the Filled suffix.');
  if (options.size && !catalog.sizes.includes(options.size)) {
    notes.push(`Packages scale the 24px artwork. Optically tuned artwork exists at ${catalog.sizes.join(', ')}px on the website.`);
  }

  const base = { name: icon.name, style, framework, package: setup.package, install: setup.install, url: iconUrl(icon.name), docs: setup.docs };
  switch (framework) {
    case 'react':
      return { ...base, identifier: componentName(icon.name, style), code: reactSnippet(icon.name, style, snippet), notes };
    case 'vue':
      return { ...base, identifier: componentName(icon.name, style), code: vueSnippet(icon.name, style, snippet), notes };
    case 'svelte':
      return { ...base, identifier: componentName(icon.name, style), code: svelteSnippet(icon.name, style, snippet), notes };
    case 'solid':
      return { ...base, identifier: componentName(icon.name, style), code: solidSnippet(icon.name, style, snippet), notes };
    case 'angular':
      return { ...base, identifier: componentName(icon.name, style), code: angularSnippet(icon.name, style, snippet), notes };
    case 'flutter':
      return { ...base, identifier: `FosIcons.${flutterName(icon.name, style)}`, code: flutterSnippet(icon.name, style, snippet), notes };
    case 'svg': {
      const path = `icons/${style}/${icon.name}.svg`;
      if (style === 'regular') {
        const size = snippet.size;
        return {
          ...base, identifier: path, svg: regular[icon.name],
          code: `<img src="${SITE}/svg/regular/${icon.name}.svg" width="${size}" height="${size}" alt="">`,
          notes: [...notes, 'Inline the svg markup instead of <img> to color it with CSS (currentColor).'],
        };
      }
      return {
        ...base, identifier: path,
        code: `<!-- ${LIBRARY}/blob/main/${path} -->`,
        notes: [...notes, `Raw ${style} SVG is not served here. Use the file from the library repository, a framework package, or export it from ${iconUrl(icon.name)}.`],
      };
    }
  }
}

export const libraryStats = () => ({ icons: catalog.icons.length, styles: catalog.styles, categories: catalog.categories.length, license: catalog.license });
