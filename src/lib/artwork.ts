import { useEffect, useMemo, useState } from 'react';
import { artworkKey, loadIconChunk } from './artwork-files';
import { catalogMeta, type StyleId } from './catalog-meta';

/**
 * Icon artwork for the landing pages (icon, category, framework).
 *
 * The build prerenders those pages with their artwork inline and embeds the
 * same SVGs as JSON (#fos-artwork), which main.tsx primes before the first
 * render, so the app's first paint matches the static HTML exactly. Anything
 * not primed (client-side navigation) is fetched by chunk.
 *
 * The store is keyed by artworkKey(): the style, plus the optical size when
 * it isn't the canonical 24 (`regular`, `regular@48`).
 */
type Store = Record<string, Record<string, string>>;
const primed: Store = {};
/** Every (artwork key, name) a render asked for; the build embeds these. */
let used: Map<string, Set<string>> | null = null;

export function primeArtwork(store: Store) {
  for (const [key, svgs] of Object.entries(store)) {
    primed[key] = { ...primed[key], ...svgs };
  }
}

/** Start recording which artwork a (server) render uses. */
export function trackArtwork() {
  used = new Map();
}

/** The artwork recorded since trackArtwork(), taken from the primed store. */
export function takeTrackedArtwork(): Store {
  const out: Store = {};
  for (const [key, names] of used ?? []) {
    const svgs: Record<string, string> = {};
    for (const name of names) {
      const svg = primed[key]?.[name];
      if (svg) svgs[name] = svg;
    }
    out[key] = svgs;
  }
  used = null;
  return out;
}

const pick = (keys: readonly string[], names: readonly string[]) => keys.map((key) => {
  const out: Record<string, string> = {};
  for (const name of names) {
    const svg = primed[key]?.[name];
    if (svg) out[name] = svg;
  }
  return out;
});

function sampleChunksFor(names: readonly string[]): number[] {
  return [...new Set(names.flatMap((name) => {
    const chunk = catalogMeta.sampleChunks[name];
    return typeof chunk === 'number' ? [chunk] : [];
  }))];
}

/**
 * SVG source for these icons in one style at each optical size (the same
 * order as `sizes`); missing entries fill in as chunks load.
 */
export function useSizedArtwork(
  style: StyleId, names: readonly string[], sizes: readonly number[],
  chunksFor: (names: readonly string[]) => number[] = sampleChunksFor,
): Record<string, string>[] {
  const nameKey = names.join(',');
  const sizeKey = sizes.join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const list = useMemo(() => names, [nameKey]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const keys = useMemo(() => sizes.map((size) => artworkKey(style, size)), [style, sizeKey]);
  if (used) {
    for (const key of keys) {
      const set = used.get(key) ?? new Set<string>();
      for (const name of list) set.add(name);
      used.set(key, set);
    }
  }
  const id = `${keys.join(',')}:${nameKey}`;
  const [loaded, setLoaded] = useState<{ id: string; svgs: Record<string, string>[] }>(() => ({ id, svgs: pick(keys, list) }));
  const current = loaded.id === id ? loaded.svgs : pick(keys, list);

  useEffect(() => {
    let live = true;
    setLoaded({ id, svgs: pick(keys, list) });
    const loads = keys.flatMap((key, i) => {
      const missing = list.filter((name) => !primed[key]?.[name]);
      return missing.length
        ? [Promise.all(chunksFor(missing).map((chunk) => loadIconChunk(style, chunk, sizes[i])))
          .then((chunks) => primeArtwork({ [key]: Object.assign({}, ...chunks) }))]
        : [];
    });
    if (!loads.length) return;
    Promise.all(loads).then(() => {
      if (live) setLoaded({ id, svgs: pick(keys, list) });
    }, () => { /* the page still works without previews */ });
    return () => { live = false; };
    // `sizes` is captured through `keys`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style, id, keys, list, chunksFor]);

  return current;
}

/** SVG source for these icons in one style (24px artwork). */
export function useArtwork(style: StyleId, names: readonly string[], chunksFor?: (names: readonly string[]) => number[]): Record<string, string> {
  return useSizedArtwork(style, names, CANONICAL, chunksFor)[0];
}
const CANONICAL = [catalogMeta.grid] as const;

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
