import { useEffect, useMemo, useState } from 'react';
import { chunksFor, loadIconChunk, type StyleId } from './catalog';

/**
 * Icon artwork for the landing pages (icon, category, framework).
 *
 * The build prerenders those pages with their artwork inline and embeds the
 * same SVGs as JSON (#fos-artwork), which main.tsx primes before the first
 * render, so the app's first paint matches the static HTML exactly. Anything
 * not primed (client-side navigation) is fetched by chunk.
 */
type Store = Partial<Record<StyleId, Record<string, string>>>;
const primed: Store = {};
/** Every (style, name) a render asked for; the build embeds these. */
let used: Map<StyleId, Set<string>> | null = null;

export function primeArtwork(store: Store) {
  for (const [style, svgs] of Object.entries(store) as [StyleId, Record<string, string>][]) {
    primed[style] = { ...primed[style], ...svgs };
  }
}

/** Start recording which artwork a (server) render uses. */
export function trackArtwork() {
  used = new Map();
}

/** The artwork recorded since trackArtwork(), taken from the primed store. */
export function takeTrackedArtwork(): Store {
  const out: Store = {};
  for (const [style, names] of used ?? []) {
    const svgs: Record<string, string> = {};
    for (const name of names) {
      const svg = primed[style]?.[name];
      if (svg) svgs[name] = svg;
    }
    out[style] = svgs;
  }
  used = null;
  return out;
}

const pick = (style: StyleId, names: readonly string[]) => {
  const out: Record<string, string> = {};
  for (const name of names) {
    const svg = primed[style]?.[name];
    if (svg) out[name] = svg;
  }
  return out;
};

/** SVG source for these icons in one style; missing entries fill in as chunks load. */
export function useArtwork(style: StyleId, names: readonly string[]): Record<string, string> {
  const key = names.join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const list = useMemo(() => names, [key]);
  if (used) {
    const set = used.get(style) ?? new Set<string>();
    for (const name of list) set.add(name);
    used.set(style, set);
  }
  const [loaded, setLoaded] = useState<{ key: string; svgs: Record<string, string> }>(() => ({ key: `${style}:${key}`, svgs: pick(style, list) }));
  const current = loaded.key === `${style}:${key}` ? loaded.svgs : pick(style, list);

  useEffect(() => {
    const missing = list.filter((name) => !primed[style]?.[name]);
    let live = true;
    setLoaded({ key: `${style}:${key}`, svgs: pick(style, list) });
    if (!missing.length) return;
    Promise.all(chunksFor(missing).map((chunk) => loadIconChunk(style, chunk))).then((chunks) => {
      if (!live) return;
      primeArtwork({ [style]: Object.assign({}, ...chunks) });
      setLoaded({ key: `${style}:${key}`, svgs: pick(style, list) });
    }, () => { /* the page still works without previews */ });
    return () => { live = false; };
  }, [style, key, list]);

  return current;
}

/**
 * Prefix every id (and reference to it) so several icons can share one
 * document. String-based, so it also runs during the build's prerender.
 */
export function scopeIds(svg: string, prefix: string): string {
  if (!svg.includes(' id="')) return svg;
  const ids = [...svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  let out = svg;
  for (const id of ids) {
    const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out
      .replace(new RegExp(` id="${esc}"`, 'g'), ` id="${prefix}${id}"`)
      .replace(new RegExp(`url\\(#${esc}\\)`, 'g'), `url(#${prefix}${id})`)
      .replace(new RegExp(`href="#${esc}"`, 'g'), `href="#${prefix}${id}"`);
  }
  return out;
}
