import { LocalizedError } from '../i18n/errors';
import type { StyleId } from './catalog';
import { isDuo } from './svg';

/**
 * Free-form modifier previews. This mirrors the library's own composer
 * (fos-icons `scripts/compose_svg.py`, as used for its authored presets):
 * the base is clipped by the modifier's transparent clearance, the glyph is
 * cut out of the badge as a transparent stencil, and the badge follows the
 * icon color in Regular/Solid and the `--fos-modifier` role in the duo
 * styles. Unlike authored presets, the base is never refitted.
 */

export const CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;
export type Corner = (typeof CORNERS)[number];

export interface Placement {
  x: number;
  y: number;
  clearance: { d: string; evenodd: boolean }[];
}

export interface ModifierAsset {
  name: string;
  label: string;
  group: string;
  defaultPosition: Corner | null;
  /** Library default for the duo `--fos-modifier` role (light theme). */
  color: string;
  positions: Partial<Record<Corner, Placement>>;
  svg: string;
}

/** Library modifier groups, in tab order. Labels are messages: modifiers.group.<id>(.tab). */
export const MODIFIER_GROUPS = [
  { id: 'actions' },
  { id: 'status' },
  { id: 'access-identity' },
  { id: 'image-quality' },
  { id: 'file-types' },
] as const;

/**
 * Some modifier groups only make sense on certain icons: file-type labels on
 * files and folders, image-quality marks on images.
 */
const GROUP_SCOPE: Record<string, RegExp> = {
  'file-types': /^(file|files|folder)(-|$)/,
  'image-quality': /^images?(-|$)/,
};

export function modifiersFor(iconName: string, modifiers: ModifierAsset[]): ModifierAsset[] {
  return modifiers.filter((m) => GROUP_SCOPE[m.group]?.test(iconName) ?? true);
}

export const CORNER_LABELS: Record<Corner, string> = {
  'top-left': 'Top left',
  'top-right': 'Top right',
  'bottom-left': 'Bottom left',
  'bottom-right': 'Bottom right',
};

/** Where a modifier starts: bottom right when supported, otherwise its library default or first supported corner. */
export function initialCorner(modifier: ModifierAsset): Corner {
  if (modifier.positions['bottom-right']) return 'bottom-right';
  if (modifier.defaultPosition && modifier.positions[modifier.defaultPosition]) return modifier.defaultPosition;
  return CORNERS.find((c) => modifier.positions[c])!;
}

let cache: Promise<ModifierAsset[]> | null = null;

export function loadModifiers(): Promise<ModifierAsset[]> {
  cache ??= fetch(`${import.meta.env.BASE_URL}modifiers.json`).then((res) => {
    if (!res.ok) throw new LocalizedError('error.loadModifiersStatus', { status: String(res.status) });
    return res.json() as Promise<{ modifiers: ModifierAsset[] }>;
  }).then((data) => data.modifiers).catch((error: unknown) => {
    cache = null;
    throw error;
  });
  return cache;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
/** The library's paint for the glyph drawn on a badge. */
const GLYPH_PAINT = 'var(--fos-glyph-color, #FFFFFF)';

function parse(svg: string): Element {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = doc.documentElement;
  if (root.nodeName !== 'svg' || doc.getElementsByTagName('parsererror').length) throw new Error('Invalid SVG source');
  return root;
}

function prefixIds(root: Element, prefix: string) {
  const ids = new Map<string, string>();
  root.querySelectorAll('[id]').forEach((node) => {
    const next = `${prefix}-${node.getAttribute('id')}`;
    ids.set(node.getAttribute('id')!, next);
    node.setAttribute('id', next);
  });
  if (!ids.size) return;
  for (const node of [root, ...Array.from(root.querySelectorAll('*'))]) {
    for (const attr of Array.from(node.attributes)) {
      if (attr.value.includes('url(#')) {
        node.setAttribute(attr.name, attr.value.replace(/url\(#([^)]+)\)/g, (w, id: string) => (ids.has(id) ? `url(#${ids.get(id)})` : w)));
      }
    }
  }
}

const paints = (root: Element) => [root, ...Array.from(root.querySelectorAll('*'))];

/** Turn the badge glyph into a transparent cutout (compose_svg `cutout_stencil`). */
function cutoutStencil(badge: Element, prefix: string) {
  const doc = badge.ownerDocument;
  if (!paints(badge).some((n) => n.getAttribute('fill') === GLYPH_PAINT || n.getAttribute('stroke') === GLYPH_PAINT)) return;
  const stencil = badge.cloneNode(true) as Element;
  stencil.removeAttribute('xmlns');
  prefixIds(stencil, `${prefix}-stencil`);
  for (const node of paints(stencil)) {
    for (const attr of ['fill', 'stroke']) {
      if (node.getAttribute(attr) === GLYPH_PAINT) node.setAttribute(attr, 'black');
      else if (node.getAttribute(attr) === 'currentColor') node.setAttribute(attr, 'none');
    }
  }
  for (const node of paints(badge)) {
    for (const attr of ['fill', 'stroke']) {
      if (node.getAttribute(attr) === GLYPH_PAINT) node.setAttribute(attr, 'none');
    }
  }
  const width = badge.getAttribute('width')!;
  const height = badge.getAttribute('height')!;
  const maskId = `${prefix}-stencil-cutout`;
  const defs = doc.createElementNS(SVG_NS, 'defs');
  const mask = doc.createElementNS(SVG_NS, 'mask');
  for (const [k, v] of Object.entries({
    id: maskId, maskUnits: 'userSpaceOnUse', maskContentUnits: 'userSpaceOnUse', 'mask-type': 'luminance',
    x: '0', y: '0', width, height,
  })) mask.setAttribute(k, v);
  const rect = doc.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('width', width);
  rect.setAttribute('height', height);
  rect.setAttribute('fill', 'white');
  mask.append(rect, stencil);
  defs.append(mask);
  const visible = doc.createElementNS(SVG_NS, 'g');
  visible.setAttribute('mask', `url(#${maskId})`);
  const drawn = Array.from(badge.children).filter((n) => n.localName !== 'defs');
  badge.append(defs);
  visible.append(...drawn);
  badge.append(visible);
}

/** The badge alone, glyph cut out, for picker tiles. Paints with `currentColor`. */
export function modifierTileSvg(modifier: ModifierAsset): string {
  const badge = parse(modifier.svg);
  prefixIds(badge, `ft-${modifier.name}`);
  cutoutStencil(badge, `ft-${modifier.name}`);
  return new XMLSerializer().serializeToString(badge);
}

/**
 * Modifier size range, as a scale of the library's badge (1 = as authored).
 * A modifier may cover at most a quarter of the icon: 12×12 of the 24×24 grid.
 * Authored badges are 10×10 (or 14×7), so 1.2 is the largest step that fits.
 */
export const MODIFIER_SCALE = { min: 0.75, max: 1.2, step: 0.05, default: 1 } as const;
/** Edge of a library badge on the 24px grid (most are 10×10). */
export const MODIFIER_BADGE = 10;
/** Largest badge area: a quarter of the 24px grid. */
const MAX_BADGE_AREA = (24 * 24) / 4;

/**
 * Compose a canonical icon with a modifier at a corner. Returns a 24px source
 * SVG with the same CSS color roles as authored compositions, ready for
 * `buildSvg`. `scale` resizes the badge and the gap cut around it together,
 * anchored at the badge's outer corner; at 1 the output matches the library's
 * own compositions exactly. `modifierRole` gives Regular and Solid badges the
 * `--fos-modifier` color role too (falling back to the icon's color), so the
 * badge can be recolored on its own; the duo styles always have it.
 */
export function composeSvg(base: string, modifier: ModifierAsset, corner: Corner, style: StyleId, scale = 1, modifierRole = false): string {
  const placement = modifier.positions[corner];
  if (!placement) throw new LocalizedError('error.badCorner', { modifier: modifier.label, corner: CORNER_LABELS[corner].toLowerCase() });
  const prefix = `fm-${modifier.name}-${corner}`;
  const doc = document.implementation.createDocument(SVG_NS, 'svg', null);
  const result = doc.documentElement;
  for (const [k, v] of Object.entries({ width: '24', height: '24', viewBox: '0 0 24 24', fill: 'none' })) result.setAttribute(k, v);

  const baseRoot = doc.importNode(parse(base), true) as Element;
  baseRoot.removeAttribute('xmlns');
  prefixIds(baseRoot, `${prefix}-base`);
  const duo = isDuo(style);
  result.setAttribute('color', (duo && baseRoot.getAttribute('color')) || 'currentColor');
  if (duo) baseRoot.setAttribute('color', 'currentColor');

  const badge = doc.importNode(parse(modifier.svg), true) as Element;
  // Scale about the badge's outer corner, so it stays tucked into the icon's corner.
  const w = Number(badge.getAttribute('width')) || 10;
  const h = Number(badge.getAttribute('height')) || 10;
  const ax = corner.endsWith('right') ? placement.x + w : placement.x;
  const ay = corner.startsWith('bottom') ? placement.y + h : placement.y;
  // Never more than a quarter of the icon, whatever the caller asks for.
  scale = Math.min(scale, Math.sqrt(MAX_BADGE_AREA / (w * h)), MODIFIER_SCALE.max);
  scale = Math.max(scale, MODIFIER_SCALE.min);
  const scaled = Math.abs(scale - 1) > 1e-6;
  const transform = `translate(${ax} ${ay}) scale(${scale}) translate(${-ax} ${-ay})`;

  const clipId = `${prefix}-clearance`;
  const defs = doc.createElementNS(SVG_NS, 'defs');
  const clearancePaths = (fill?: string) => placement.clearance.map((path) => {
    const p = doc.createElementNS(SVG_NS, 'path');
    const rule = path.evenodd ? 'evenodd' : 'nonzero';
    p.setAttribute('d', path.d);
    p.setAttribute('fill-rule', rule);
    if (fill) p.setAttribute('fill', fill);
    else p.setAttribute('clip-rule', rule);
    return p;
  });
  const masked = doc.createElementNS(SVG_NS, 'g');
  if (!scaled) {
    const clip = doc.createElementNS(SVG_NS, 'clipPath');
    clip.setAttribute('id', clipId);
    clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
    clip.append(...clearancePaths());
    defs.append(clip);
    masked.setAttribute('clip-path', `url(#${clipId})`);
  } else {
    // The clearance (C) is where the icon shows within the 24px square (S); the
    // gap around the badge is S minus C. Scaled by T, the visible area is S
    // minus T(S minus C): white everywhere, black over T(S), white again over T(C).
    const mask = doc.createElementNS(SVG_NS, 'mask');
    for (const [k, v] of Object.entries({
      id: clipId, maskUnits: 'userSpaceOnUse', maskContentUnits: 'userSpaceOnUse', 'mask-type': 'luminance',
      x: '0', y: '0', width: '24', height: '24',
    })) mask.setAttribute(k, v);
    const square = (fill: string) => {
      const r = doc.createElementNS(SVG_NS, 'rect');
      for (const [k, v] of Object.entries({ x: '0', y: '0', width: '24', height: '24', fill })) r.setAttribute(k, v);
      return r;
    };
    const zone = doc.createElementNS(SVG_NS, 'g');
    zone.setAttribute('transform', transform);
    zone.append(square('black'), ...clearancePaths('white'));
    mask.append(square('white'), zone);
    defs.append(mask);
    masked.setAttribute('mask', `url(#${clipId})`);
  }
  masked.append(baseRoot);

  badge.removeAttribute('xmlns');
  prefixIds(badge, `${prefix}-glyph`);
  cutoutStencil(badge, prefix);
  badge.setAttribute('x', String(placement.x));
  badge.setAttribute('y', String(placement.y));
  badge.setAttribute('color', duo ? `var(--fos-modifier, ${modifier.color})` : modifierRole ? 'var(--fos-modifier, currentColor)' : 'currentColor');

  let glyph: Element = badge;
  if (scaled) {
    glyph = doc.createElementNS(SVG_NS, 'g');
    glyph.setAttribute('transform', transform);
    glyph.append(badge);
  }
  result.append(defs, masked, glyph);
  return new XMLSerializer().serializeToString(result);
}
