#!/usr/bin/env node
/**
 * Synchronize website data from a checkout of fos-icons/fos-icons.
 *
 *   node scripts/sync-icons.mjs --source ../fos-icons   # write
 *   node scripts/sync-icons.mjs --check                    # verify committed output
 *
 * The library is read-only. Every SVG is verified against the SHA-256 digest
 * recorded in its manifest before it is copied. Output is deterministic, so a
 * re-run with the same source revision produces byte-identical files.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOCK_PATH = join(ROOT, 'src/data/source-lock.json');

/** Regular icons the website chrome uses. They must exist in the library. */
export const UI_ICONS = [
  'search', 'x', 'download', 'copy', 'image', 'code', 'sun', 'moon', 'monitor',
  'check', 'badge-verified', 'info-circle', 'chevron-down', 'link', 'link-external', 'menu',
  'book-open', 'palette', 'arrow-left', 'filter', 'x-circle',
  'layout-sidebar-right', 'settings-sliders', 'undo', 'message-smile-square',
  'plus', 'minus', 'dots-horizontal', 'compass', 'binoculars', 'map', 'route', 'home',
  'sparkles', 'lightbulb', 'arrow-right', 'search-sparkles', 'globe', 'expand', 'slider-horizontal', 'arrows-fit-horizontal',
  'crown-simple', 'refresh', 'arrows-swap-vertical', 'arrows-swap-horizontal',
];

/** Brand names and search aliases where the file path alone isn't the familiar name. */
const BRAND_META = {
  'google/chrome.svg': { name: 'google-chrome', aliases: ['chrome'] },
  'microsoft/edge.svg': { name: 'microsoft-edge', aliases: ['edge'] },
  'microsoft/teams.svg': { name: 'microsoft-teams', aliases: ['teams'] },
  'microsoft/windows.svg': { name: 'windows', aliases: ['microsoft-windows'] },
  'social/x.svg': { aliases: ['twitter'] },
};

/** Icons per artwork chunk. Must match ICON_CHUNK in src/lib/artwork-files.ts. */
export const ICON_CHUNK = 96;

const POPULAR = [
  'home', 'search', 'settings', 'user', 'bell', 'calendar', 'mail', 'heart', 'star', 'camera',
  'trash', 'edit', 'download', 'upload', 'share', 'lock', 'cart', 'chat', 'map', 'clock',
  'image', 'folder', 'phone', 'globe', 'sparkles', 'link', 'filter', 'bookmark',
];

/** The app shell and sample pages need facts and a few icons, not the searchable catalog. */
export function catalogMetadata({ icons, animated = [], ...metadata }, brandNames = []) {
  const byName = new Map(icons.map((icon, index) => [icon.name, { icon, index }]));
  const popular = POPULAR.filter((name) => {
    const entry = byName.get(name);
    return entry && !entry.icon.composition;
  });
  for (const category of metadata.categories) {
    if (popular.length >= 24) break;
    const first = icons.find((icon) => icon.category === category.name && !icon.composition && !popular.includes(icon.name));
    if (first) popular.push(first.name);
  }
  const examples = popular.slice(0, 24);
  const sampleChunks = Object.fromEntries([...new Set([...examples, 'calendar', 'calendar-add'])].flatMap((name) => {
    const entry = byName.get(name);
    return entry ? [[name, Math.floor(entry.index / ICON_CHUNK)]] : [];
  }));
  const compositions = icons.flatMap(({ composition }) => composition ? [composition] : []);
  return {
    ...metadata,
    animated,
    iconCount: icons.length,
    examples,
    sampleChunks,
    brandNameCollisions: brandNames.filter((name) => byName.has(name)),
    compositions: {
      count: compositions.length,
      bases: new Set(compositions.map(({ base }) => base)).size,
      modifiers: new Set(compositions.flatMap(({ modifiers }) => modifiers.map(({ name }) => name))).size,
    },
  };
}

const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const json = (value) => JSON.stringify(value, null, 2) + '\n';

function parseArgs(argv) {
  const args = { check: false, source: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--') continue; // `pnpm run sync -- --source …` passes the separator through
    if (argv[i] === '--check') args.check = true;
    else if (argv[i] === '--source') args.source = argv[++i];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
}

function git(source, ...args) {
  try {
    return execFileSync('git', ['-C', source, ...args], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readVerified(source, file, digest) {
  const path = resolve(source, file);
  if (!path.startsWith(resolve(source) + sep)) throw new Error(`Path escapes library: ${file}`);
  const data = readFileSync(path);
  if (sha256(data) !== digest) throw new Error(`SHA-256 mismatch: ${file}`);
  return data.toString('utf8').trim();
}

/** Build every output file in memory. Returns { path: contents }. */
export function buildOutputs(source) {
  source = resolve(source);
  const manifestRaw = readFileSync(join(source, 'manifest.json'));
  const manifest = JSON.parse(manifestRaw);
  const modifiers = readJson(join(source, 'metadata/modifiers.json'));
  const colors = readJson(join(source, 'metadata/colors.json'));
  const { styles, icons } = manifest;

  if (!Array.isArray(styles) || styles.length === 0) throw new Error('Manifest has no styles');
  if (manifest.iconCount !== icons.length) {
    throw new Error(`Manifest iconCount ${manifest.iconCount} != ${icons.length} entries`);
  }
  const names = new Set();
  for (const icon of icons) {
    if (names.has(icon.name)) throw new Error(`Duplicate icon: ${icon.name}`);
    names.add(icon.name);
    for (const style of styles) {
      if (!icon.files?.[style]) throw new Error(`${icon.name} is missing ${style}`);
    }
  }

  const sorted = [...icons].sort((a, b) => a.name.localeCompare(b.name));
  const outputs = {};
  const snapshotDigests = {};

  for (const style of styles) {
    const map = {};
    for (const icon of sorted) {
      map[icon.name] = readVerified(source, icon.files[style], icon.sha256[style]);
    }
    const body = JSON.stringify(map);
    snapshotDigests[style] = sha256(body);
    outputs[`public/icons/${style}.json`] = body;
    // The grid loads artwork in small chunks as icons scroll into view
    // (catalog order, ICON_CHUNK icons each); the whole-style file above
    // serves downloads and browsers without IntersectionObserver.
    const names = Object.keys(map);
    for (let n = 0; n * ICON_CHUNK < names.length; n += 1) {
      const chunk = Object.fromEntries(names.slice(n * ICON_CHUNK, (n + 1) * ICON_CHUNK).map((name) => [name, map[name]]));
      outputs[`public/icons/${style}/${n}.json`] = JSON.stringify(chunk);
    }
  }

  // Optical sizes: each size is drawn on its own grid (16/32/48/64 beside
  // the canonical 24). They are published as chunks only; the grid and the
  // exports pick the size nearest the one being drawn.
  const sizes = manifest.sizes ?? [manifest.grid];
  const strokeWidths = manifest.strokeWidths ?? { [manifest.grid]: manifest.regularStrokeWidth };
  for (const size of sizes) {
    if (size === manifest.grid) continue;
    for (const style of styles) {
      const map = {};
      for (const icon of sorted) {
        const file = manifest.sizePath.replace('{size}', size).replace('{style}', style).replace('{name}', icon.name);
        map[icon.name] = readVerified(source, file, icon.sizes?.[size]?.[style]);
      }
      snapshotDigests[`${size}/${style}`] = sha256(JSON.stringify(map));
      const names = Object.keys(map);
      for (let n = 0; n * ICON_CHUNK < names.length; n += 1) {
        const chunk = Object.fromEntries(names.slice(n * ICON_CHUNK, (n + 1) * ICON_CHUNK).map((name) => [name, map[name]]));
        outputs[`public/icons/${size}/${style}/${n}.json`] = JSON.stringify(chunk);
      }
    }
  }

  // Animated icons: a curated set generated in the library from Regular
  // artwork (scripts/animate.mjs). They load as one small file and play on
  // hover in the grid. The library's CI checks they match their spec; here
  // every listed file must exist for a real icon.
  const animatedSpecPath = join(source, 'metadata/animated.json');
  const animatedNames = existsSync(animatedSpecPath)
    ? Object.keys(readJson(animatedSpecPath).icons).sort((a, b) => a.localeCompare(b))
    : [];
  const animated = {};
  if (animatedNames.length) {
    for (const name of animatedNames) {
      if (!names.has(name)) throw new Error(`Animated icon is not in the library: ${name}`);
      animated[name] = readFileSync(join(source, 'icons/animated', `${name}.svg`), 'utf8').trim();
    }
    const body = JSON.stringify(animated);
    snapshotDigests.animated = sha256(body);
    outputs['public/icons/animated.json'] = body;
    // The MCP server's animate_icon tool runs the library's own compiler.
    outputs['server/mcp/animate-core.js'] = '// Generated by scripts/sync-icons.mjs from fos-icons scripts/animate-core.mjs. Do not edit.\n'
      + readFileSync(join(source, 'scripts/animate-core.mjs'), 'utf8');
  }
  // Bundle the individual animations used by site controls.
  outputs['src/data/ui-animated-check.json'] = json({ check: animated.check ?? null });
  outputs['src/data/ui-animated-refresh.json'] = json({ refresh: animated.refresh ?? null });

  // Normalize the two composition shapes found in the manifest into a list.
  const compositionOf = (icon) => {
    const c = icon.composition;
    if (!c) return undefined;
    const mods = Array.isArray(c.modifiers)
      ? c.modifiers.map((m) => ({ name: m.name, position: m.position }))
      : [{ name: c.modifier, position: c.position }];
    return { base: c.base, modifiers: mods };
  };

  const categoryCounts = new Map();
  const catalogIcons = sorted.map((icon) => {
    categoryCounts.set(icon.category, (categoryCounts.get(icon.category) ?? 0) + 1);
    const entry = {
      name: icon.name,
      category: icon.category,
      tags: [...new Set(icon.tags.map((t) => t.toLowerCase()))].filter((t) => t !== icon.name),
      aliases: icon.aliases,
    };
    const composition = compositionOf(icon);
    if (composition) {
      if (!names.has(composition.base)) throw new Error(`${icon.name}: unknown base ${composition.base}`);
      entry.composition = composition;
    }
    return entry;
  });

  const modifierLabels = Object.fromEntries(
    modifiers.modifiers.map((m) => [m.name, { label: m.label, group: m.group }]),
  );
  for (const icon of catalogIcons) {
    for (const m of icon.composition?.modifiers ?? []) {
      if (!modifierLabels[m.name]) throw new Error(`${icon.name}: unknown modifier ${m.name}`);
    }
  }

  // Every reusable modifier, with the placements and transparent clearance
  // the library's own compose tool (scripts/compose_svg.py) uses. The site
  // composes previews from these; it never draws or edits a modifier.
  const POSITIONS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
  const modifierAssets = [...modifiers.modifiers].sort((a, b) => a.name.localeCompare(b.name)).map((m) => {
    const allowed = m.allowedPositions ?? POSITIONS;
    const positions = {};
    for (const position of POSITIONS) {
      const placement = m.positions?.[position];
      if (!allowed.includes(position) || !placement) continue;
      if (!placement.clearance?.length) throw new Error(`${m.name}: no clearance for ${position}`);
      positions[position] = {
        x: placement.x,
        y: placement.y,
        clearance: placement.clearance.map((p) => ({ d: p.data, evenodd: p.windingRule === 'EVENODD' })),
      };
    }
    if (!Object.keys(positions).length) throw new Error(`${m.name}: no usable corner`);
    if (m.defaultPosition && !positions[m.defaultPosition]) throw new Error(`${m.name}: default corner not allowed`);
    return {
      name: m.name,
      label: m.label,
      group: m.group,
      defaultPosition: m.defaultPosition ?? null,
      color: m.colors.light.primary,
      positions,
      svg: readVerified(source, m.file, m.sha256),
    };
  });

  // Third-party brand marks live outside the core in brand-assets/. They are
  // copied unmodified (digest-verified) and listed with their owner, source,
  // and the collection's shared rights notes. Never part of the MIT core.
  const brandManifestPath = join(source, 'brand-assets/manifest.json');
  const brandManifestRaw = existsSync(brandManifestPath) ? readFileSync(brandManifestPath) : null;
  const brandEntries = [];
  if (brandManifestRaw) {
    const bm = JSON.parse(brandManifestRaw);
    const brandNames = new Set();
    for (const asset of bm.assets) {
      const [group, file] = asset.path.split('/');
      const base = file.replace(/\.svg$/, '');
      const meta = BRAND_META[asset.path] ?? {};
      // Social and AI marks keep their plain names; other groups are prefixed.
      const name = meta.name ?? (group === 'social' || group === 'ai' ? base : `${group}-${base}`);
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) throw new Error(`Bad brand name: ${name}`);
      if (brandNames.has(name)) throw new Error(`Duplicate brand: ${name}`);
      brandNames.add(name);
      const publicPath = `brands/${name}-regular.svg`;
      outputs[`public/${publicPath}`] = readVerified(join(source, 'brand-assets'), asset.path, asset.sha256) + '\n';
      // A one-color Filled mark, where the brand's kit provides one.
      const solidPath = asset.solid ? `brands/${name}-filled.svg` : null;
      if (asset.solid) outputs[`public/${solidPath}`] = readVerified(join(source, 'brand-assets'), asset.solid.path, asset.solid.sha256) + '\n';
      brandEntries.push({
        name,
        owner: asset.owner,
        category: group === 'social' ? 'Social' : group === 'ai' ? 'AI' : 'Apps',
        ...(meta.aliases ? { aliases: meta.aliases } : {}),
        officialSource: asset.source,
        retrieved: asset.retrieved ?? bm.retrievedAt,
        terms: bm.rights.license,
        files: { regular: publicPath, ...(solidPath ? { filled: solidPath } : {}) },
      });
    }
    brandEntries.sort((a, b) => a.name.localeCompare(b.name));
  }

  const revision = git(source, 'rev-parse', 'HEAD');
  const dirty = revision ? git(source, 'status', '--porcelain', '--', 'icons', 'manifest.json', 'metadata', 'brand-assets', 'scripts/animate-core.mjs') !== '' : null;
  const lock = {
    repository: 'fos-icons/fos-icons',
    revision,
    dirty,
    manifestSha256: sha256(manifestRaw),
    brandManifestSha256: brandManifestRaw ? sha256(brandManifestRaw) : null,
    snapshotSha256: snapshotDigests,
  };

  const catalog = {
    license: manifest.license,
    grid: manifest.grid,
    strokeWidth: manifest.regularStrokeWidth,
    sizes,
    strokeWidths,
    styles,
    categories: [...categoryCounts].map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    modifiers: modifierLabels,
    icons: catalogIcons,
    animated: animatedNames,
    iconAliases: manifest.iconAliases ?? {},
  };
  outputs['src/data/catalog.json'] = json(catalog);
  outputs['src/data/catalog-meta.json'] = json(catalogMetadata(catalog, brandEntries.map(({ name }) => name)));
  outputs['src/data/palettes.json'] = json({
    defaultPalette: colors.defaultPalette,
    palettes: colors.palettes.map(({ name, light, dark }) => ({ name, light, dark })),
  });
  outputs['src/data/ui-icons.json'] = json(Object.fromEntries(UI_ICONS.map((name) => {
    const icon = icons.find((i) => i.name === name);
    if (!icon) throw new Error(`UI icon missing from library: ${name}`);
    return [name, readVerified(source, icon.files.regular, icon.sha256.regular)];
  })));
  outputs['src/data/brands.json'] = json({
    $comment: 'Generated by scripts/sync-icons.mjs from fos-icons brand-assets/manifest.json. Do not edit.',
    disclaimer: 'All brand icons belong to their respective owners.',
    approved: brandEntries,
  });
  outputs['public/modifiers.json'] = JSON.stringify({ modifiers: modifierAssets });
  outputs['public/licenses/fos-icons-LICENSE.txt'] = readFileSync(join(source, 'LICENSE'), 'utf8');
  outputs['src/data/source-lock.json'] = json(lock);
  return outputs;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const source = args.source ?? process.env.FOS_ICONS_SOURCE ?? join(ROOT, '../fos-icons');
  if (!existsSync(join(source, 'manifest.json'))) {
    throw new Error(`No fos-icons checkout at ${source}. Pass --source <path>.`);
  }
  const outputs = buildOutputs(source);
  // Brand files the source no longer has (a removed brand) are stale too.
  const brandDir = join(ROOT, 'public/brands');
  const leftovers = existsSync(brandDir)
    ? readdirSync(brandDir).map((f) => `public/brands/${f}`).filter((p) => !(p in outputs))
    : [];
  if (args.check) {
    const stale = Object.entries(outputs).filter(([path, body]) => {
      const full = join(ROOT, path);
      return !existsSync(full) || readFileSync(full, 'utf8') !== body;
    }).concat(leftovers.map((p) => [p]));
    if (stale.length) {
      console.error('Synchronized data is out of date:\n  ' + stale.map(([p]) => p).join('\n  '));
      console.error('Run: pnpm run sync --source <path-to-fos-icons>');
      process.exit(1);
    }
    console.log(`Synchronized data matches ${relative(ROOT, resolve(source)) || source}.`);
    return;
  }
  for (const [path, body] of Object.entries(outputs)) {
    const full = join(ROOT, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  }
  for (const path of leftovers) rmSync(join(ROOT, path));
  const lock = readJson(LOCK_PATH);
  const catalog = readJson(join(ROOT, 'src/data/catalog.json'));
  console.log(`Synced ${catalog.icons.length} icons x ${catalog.styles.length} styles from ` +
    `${lock.repository}@${lock.revision?.slice(0, 7) ?? 'unknown'}${lock.dirty ? ' (with local changes)' : ''}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
