import type { StyleId } from './catalog';

export const DUO_STYLES: readonly StyleId[] = ['duocolor', 'duotone'];
export const isDuo = (style: StyleId) => DUO_STYLES.includes(style);

export interface SvgColorOptions {
  /** Foreground for Regular/Filled; primary for the duo styles. */
  primary: string;
  /** Duocolor accents. Ignored by styles that have no secondary role. */
  secondary?: string;
  /** Filled glyph color for named presets that expose `--fos-modifier`. */
  modifier?: string;
  /** Opacity override for the authored Duotone tint, between zero and one. */
  duotoneTint?: number;
}

export interface SvgBuildOptions extends SvgColorOptions {
  /** Output width and height in px. The artwork is scaled, never redrawn. */
  size: number;
  /** Prefix for every internal ID, so several copies can share one document. */
  idPrefix?: string;
  /**
   * Stroke weight in 24px grid units. Every authored stroke is scaled by
   * `strokeWidth / sourceStroke`, so icons with intentionally heavier strokes
   * keep their proportions. Omit to keep the artwork's own strokes.
   */
  strokeWidth?: number;
  /**
   * The artwork's own stroke in 24px grid units: 1.25 for the 24px library
   * (the default), or an optical size's designed stroke (see `opticalStroke`).
   */
  sourceStroke?: number;
  /**
   * Leave colors as authored (`currentColor` and the `--fos-*` variables), so
   * the file still restyles in code; only size and stroke change.
   */
  keepColors?: boolean;
}

/** The library's standard stroke weight on its 24px grid. */
export const BASE_STROKE = 1.25;

const scaleStroke = (value: string, factor: number) => {
  const n = Number(value);
  return Number.isFinite(n) ? String(Math.round(n * factor * 1000) / 1000) : value;
};

const SVG_NS = 'http://www.w3.org/2000/svg';
const SHAPES = new Set(['path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon']);
/** A stroked shape with no width of its own (Figma omits stroke-width="1" in 16px artwork). */
const usesDefaultWidth = (node: Element) =>
  SHAPES.has(node.localName) && !!node.getAttribute('stroke') && node.getAttribute('stroke') !== 'none' && !node.getAttribute('stroke-width');
const DEFAULT_WIDTH_RE = /<(?:path|circle|ellipse|rect|line|polyline|polygon)\b(?![^>]*\sstroke-width=)[^>]*\sstroke="(?!none")/;
const TINT_ATTRIBUTES = ['opacity', 'fill-opacity'] as const;
const TINT_VALUE = /^0?\.(16|24)$/;
const TINT_TAG = /<(?:g|path|circle|ellipse|rect|polygon)\b[^>]*\b(?:fill-)?opacity="0?\.(?:16|24)"[^>]*>/g;

export function authoredDuotoneTint(source: string): number {
  const tag = source.match(TINT_TAG)?.[0];
  return Number(tag?.match(/(?:fill-)?opacity="0?\.(16|24)"/)?.[1] ?? 16);
}

/** Leave authored opacity in the SVG and let an ancestor override the live preview. */
export function prepareDuotoneSvg(source: string): string {
  return source.replace(TINT_TAG, (tag) => {
    const tint = tag.match(/\s(opacity|fill-opacity)="(0?\.(?:16|24))"/);
    if (!tint) return tag;
    const declaration = `${tint[1]}:var(--fos-duotone-tint,${tint[2]})`;
    return tag.includes(' style="')
      ? tag.replace(/ style="([^"]*)"/, (_, existing) => ` style="${existing};${declaration}"`)
      : tag.replace(/\/?>$/, (end) => ` style="${declaration}"${end}`);
  });
}

const PAINT_ATTRS = ['fill', 'stroke', 'color', 'stop-color', 'flood-color', 'lighting-color'];
const VAR_RE = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+?)\s*)?\)$/;
const COLOR_RE = /^(#[0-9a-f]{3,4}|#[0-9a-f]{6}|#[0-9a-f]{8})$/i;

export const isHexColor = (value: string) => COLOR_RE.test(value.trim());

/** Does this artwork expose an independent modifier color role? */
export const hasModifierRole = (svg: string) => svg.includes('--fos-modifier');
/** Does this artwork use a secondary color role? */
export const hasSecondaryRole = (svg: string) => svg.includes('--fos-secondary');

function resolveVar(value: string, options: SvgColorOptions): string {
  const match = VAR_RE.exec(value.trim());
  if (!match) return value;
  const [, name, fallback] = match;
  switch (name) {
    case '--fos-primary':
      return options.primary;
    case '--fos-secondary':
      return options.secondary ?? fallback ?? options.primary;
    case '--fos-modifier':
      return options.modifier ?? fallback ?? options.primary;
    default:
      // e.g. --fos-glyph-color: use the library's own fallback.
      return fallback ? resolveVar(fallback, options) : options.primary;
  }
}

function parse(svg: string): SVGSVGElement {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = doc.documentElement;
  if (root.nodeName !== 'svg' || doc.getElementsByTagName('parsererror').length) {
    throw new Error('Invalid SVG source');
  }
  return root as unknown as SVGSVGElement;
}

function namespaceIds(root: Element, prefix: string) {
  const ids = new Map<string, string>();
  root.querySelectorAll('[id]').forEach((node, index) => {
    const next = `${prefix}-${index}`;
    ids.set(node.getAttribute('id')!, next);
    node.setAttribute('id', next);
  });
  if (!ids.size) return;
  const swap = (value: string) =>
    value.replace(/url\(#([^)]+)\)/g, (whole, id: string) => (ids.has(id) ? `url(#${ids.get(id)})` : whole));
  const all = [root, ...Array.from(root.querySelectorAll('*'))];
  for (const node of all) {
    for (const attr of Array.from(node.attributes)) {
      if (attr.value.includes('url(#')) node.setAttribute(attr.name, swap(attr.value));
      if ((attr.name === 'href' || attr.name === 'xlink:href') && attr.value.startsWith('#')) {
        const id = attr.value.slice(1);
        if (ids.has(id)) node.setAttribute(attr.name, `#${ids.get(id)}`);
      }
    }
  }
}

/**
 * Produce a standalone SVG: CSS custom properties and every `currentColor`
 * are resolved to concrete colors, so the file renders identically in any
 * viewer or design tool. Geometry and definitions are preserved. Duotone
 * tint is preserved unless an opacity override was supplied.
 */
export function buildSvg(source: string, options: SvgBuildOptions): string {
  const root = parse(source);
  const all = [root, ...Array.from(root.querySelectorAll('*'))];

  if (!options.keepColors) {
    for (const node of all) {
      for (const attr of PAINT_ATTRS) {
        const value = node.getAttribute(attr);
        if (value?.includes('var(')) node.setAttribute(attr, resolveVar(value, options));
      }
    }
    // The root color is the user's choice; nested `color` attributes are roles.
    root.setAttribute('color', options.primary);

    const walk = (node: Element, inherited: string) => {
      const own = node.getAttribute('color');
      const color = own && own !== 'currentColor' && own !== 'inherit' ? own : inherited;
      if (own) node.setAttribute('color', color);
      for (const attr of PAINT_ATTRS) {
        if (attr !== 'color' && node.getAttribute(attr) === 'currentColor') node.setAttribute(attr, color);
      }
      for (const child of Array.from(node.children)) walk(child, color);
    };
    walk(root, options.primary);
  }

  const tint = options.duotoneTint;
  if (tint !== undefined && Number.isFinite(tint) && tint >= 0 && tint <= 1) {
    for (const node of all) {
      if (node.closest('defs, mask, clipPath')) continue;
      for (const attr of TINT_ATTRIBUTES) {
        if (TINT_VALUE.test(node.getAttribute(attr) ?? '')) node.setAttribute(attr, String(tint));
      }
    }
  }

  const factor = options.strokeWidth === undefined ? 1 : options.strokeWidth / (options.sourceStroke ?? BASE_STROKE);
  if (Math.abs(factor - 1) > 1e-9) {
    for (const node of all) {
      const value = node.getAttribute('stroke-width');
      if (value) node.setAttribute('stroke-width', scaleStroke(value, factor));
    }
    // Strokes with no width of their own use SVG's 1-unit default (16px artwork).
    if (!root.getAttribute('stroke-width') && all.some(usesDefaultWidth)) root.setAttribute('stroke-width', scaleStroke('1', factor));
  }

  const size = String(Math.round(options.size * 100) / 100);
  root.setAttribute('width', size);
  root.setAttribute('height', size);
  if (!root.getAttribute('xmlns')) root.setAttribute('xmlns', SVG_NS);
  if (options.idPrefix) namespaceIds(root, options.idPrefix);
  return new XMLSerializer().serializeToString(root);
}

/** Reflect the artwork in its own viewBox while preserving paint references. */
export function flipSvg(source: string, horizontal: boolean, vertical: boolean): string {
  if (!horizontal && !vertical) return source;
  const root = parse(source);
  const viewBox = root.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
  if (viewBox?.length !== 4 || !viewBox.every(Number.isFinite)) return source;

  const [x, y, width, height] = viewBox;
  const tx = horizontal ? 2 * x + width : 0;
  const ty = vertical ? 2 * y + height : 0;
  const group = root.ownerDocument.createElementNS(SVG_NS, 'g');
  group.setAttribute('transform', `translate(${tx} ${ty}) scale(${horizontal ? -1 : 1} ${vertical ? -1 : 1})`);
  group.append(...Array.from(root.children).filter((child) => !['defs', 'style', 'title', 'desc', 'metadata'].includes(child.localName)));
  root.append(group);
  return new XMLSerializer().serializeToString(root);
}

/** Inline-only variant: keeps the CSS roles live, only namespacing IDs. */
export function scopeSvg(source: string, idPrefix: string): string {
  const root = parse(source);
  namespaceIds(root, idPrefix);
  return new XMLSerializer().serializeToString(root);
}

/**
 * Play an animated icon at `speed` (2 = twice as fast): every time in its
 * <style> (durations and delays) is divided by the speed. Icons without a
 * <style> come back unchanged.
 */
export function retimeAnimatedSvg(source: string, speed: number): string {
  if (speed === 1 || !(speed > 0)) return source;
  return source.replace(/<style>([\s\S]*?)<\/style>/, (_, css: string) =>
    `<style>${css.replace(/(?<![\w.-])(\d*\.?\d+)s(?![\w-])/g, (__, n: string) => `${Math.round((Number(n) / speed) * 1000) / 1000}s`)}</style>`);
}

/**
 * Grid-only variant: lets a `--stroke-scale` CSS variable on an ancestor
 * reweight every stroke live, without re-rendering each SVG. Exports never
 * use this; they go through `buildSvg`.
 */
export function prepareGridSvg(source: string, fallbackScale = '1'): string {
  const weighted = source.replace(
    /stroke-width="([\d.]+)"/g,
    (_, w: string) => `stroke-width="${w}" style="stroke-width:calc(${w}px * var(--stroke-scale, ${fallbackScale}))"`,
  );
  // Strokes with no width of their own inherit SVG's 1-unit default (16px artwork).
  return /^<svg[^>]*\sstroke-width=/.test(weighted) || !DEFAULT_WIDTH_RE.test(weighted)
    ? weighted
    : weighted.replace(/^<svg\b/, `<svg style="stroke-width:calc(1px * var(--stroke-scale, ${fallbackScale}))"`);
}
