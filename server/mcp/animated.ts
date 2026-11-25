/**
 * Animated icons for the MCP server: the curated set synced from the library,
 * and animate_icon, which runs the library's own compiler (animate-core.js,
 * copied verbatim by scripts/sync-icons.mjs) over Regular artwork.
 */
import animatedArtwork from '../../public/icons/animated.json' with { type: 'json' };
import regularArtwork from '../../public/icons/regular.json' with { type: 'json' };
import { animateSvg, MOTION_TYPES, parseParts, type AnimationSpec } from './animate-core.js';
import { UnknownIconError, checkIconNames, iconUrl } from './icons.js';

const animated = animatedArtwork as Record<string, string>;
const regular = regularArtwork as Record<string, string>;

export { MOTION_TYPES };

export const ANIMATED_NOTES = [
  'The CSS animation is inside the SVG. Inline it (or import the .svg as a component) so it inherits currentColor; through <img> it still plays but in black.',
  'Classes and keyframes are prefixed fa-<name>-, so several icons can share a page. Do not rename them or edit the paths.',
  'The still frame is the normal icon: it stops under prefers-reduced-motion. To play only on hover: .icon:not(:hover) svg * { animation: none !important }',
];

export function listAnimatedIcons() {
  return { icons: Object.keys(animated).map((name) => ({ name, url: iconUrl(name) })), motions: [...MOTION_TYPES] };
}

function known(name: string): string {
  if (!regular[name]) throw new UnknownIconError(name, checkIconNames([name])[0].suggestions ?? []);
  return regular[name];
}

export function getAnimatedIcon(name: string) {
  known(name);
  const svg = animated[name];
  if (!svg) return null;
  return { name, svg, notes: ANIMATED_NOTES };
}

export class AnimationSpecError extends Error {}

/** Describe an icon's parts (with `motions: []`), or compile an animation for it. */
export function animateIcon(name: string, spec: AnimationSpec) {
  const source = known(spec.source ?? name);
  const extras: Record<string, string> = {};
  for (const extra of spec.add ?? []) extras[extra.icon] = known(extra.icon);
  const parts = parseParts(source, { split: spec.split }).map((part, index) => {
    const numbers = part.d.match(/-?\d*\.?\d+/g)!.map(Number);
    const xs = numbers.filter((_, i) => i % 2 === 0).map((x) => x + part.translate[0]);
    const ys = numbers.filter((_, i) => i % 2 === 1).map((y) => y + part.translate[1]);
    const r = (n: number) => Math.round(n * 10) / 10;
    // A rough box for choosing parts and origins (H/V commands make it approximate).
    return { index, box: [r(Math.min(...xs)), r(Math.min(...ys)), r(Math.max(...xs)), r(Math.max(...ys))] };
  });
  try {
    const svg = animateSvg(name, source, spec, extras);
    return { name, svg, parts, notes: ANIMATED_NOTES };
  } catch (error) {
    throw new AnimationSpecError(error instanceof Error ? error.message : String(error));
  }
}
