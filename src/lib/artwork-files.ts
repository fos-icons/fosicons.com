import { LocalizedError } from '../i18n/errors';
import { ICON_CHUNK } from './artwork-chunk';
import { catalogMeta, lock, STYLE_META, type StyleId } from './catalog-meta';

export { ICON_CHUNK };
export const artworkDirectory = `icon-artwork/${lock.artworkVersion}/icons`;
export const artworkKey = (style: StyleId, size: number = catalogMeta.grid) =>
  size === catalogMeta.grid ? style : `${style}@${size}`;

const RELOAD_KEY = 'fos-artwork-reload';

/** A missing immutable artwork URL can be an old tab after a deploy. Reload once per snapshot. */
function recoverFromStaleArtwork(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_KEY) === lock.artworkVersion) return false;
    sessionStorage.setItem(RELOAD_KEY, lock.artworkVersion);
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

export async function fetchArtwork(file: string, style: StyleId, label = STYLE_META[style].label): Promise<Record<string, string>> {
  const res = await fetch(`${import.meta.env.BASE_URL}${artworkDirectory}/${file}`);
  if (res.status === 404) {
    if (recoverFromStaleArtwork()) return new Promise(() => {}); // the page is reloading
    throw new LocalizedError('error.artworkUpdated');
  }
  if (!res.ok) throw new LocalizedError('error.loadStyle', { style: label, status: String(res.status) });
  return res.json() as Promise<Record<string, string>>;
}

let chunkCache: Record<string, Promise<Record<string, string>>> = {};

/** The pinned swatchbook redraw kept its 24px mask bounds in larger artwork. */
export function repairOpticalArtwork(artwork: Record<string, string>, size: number): Record<string, string> {
  const svg = artwork.swatchbook;
  if (!svg || size <= catalogMeta.grid) return artwork;
  const corrected = svg.replace(
    /<mask\b[^>]*\bid="fos-swatchbook-[^"]+"[^>]*>\s*<rect\b[^>]*\/>/g,
    (mask) => mask.replace(/\b(width|height)="24"/g, (_, dimension: string) => `${dimension}="${size}"`),
  );
  return corrected === svg ? artwork : { ...artwork, swatchbook: corrected };
}

export function loadIconChunk(style: StyleId, chunk: number, size: number = catalogMeta.grid): Promise<Record<string, string>> {
  const key = `${size === catalogMeta.grid ? '' : `${size}/`}${style}/${chunk}`;
  chunkCache[key] ??= fetchArtwork(`${key}.json`, style)
    .then((artwork) => repairOpticalArtwork(artwork, size))
    .catch((error: unknown) => {
      delete chunkCache[key];
      throw error;
    });
  return chunkCache[key];
}

export function resetChunkCache() {
  chunkCache = {};
}
