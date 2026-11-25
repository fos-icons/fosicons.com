import { LocalizedError } from '../i18n/errors';
import { catalogMeta, lock, STYLE_META, type StyleId } from './catalog-meta';

export const artworkDirectory = `icon-artwork/${lock.manifestSha256}/icons`;
/** Icons per artwork chunk; matches ICON_CHUNK in scripts/sync-icons.mjs. */
export const ICON_CHUNK = 96;
export const artworkKey = (style: StyleId, size: number = catalogMeta.grid) =>
  size === catalogMeta.grid ? style : `${style}@${size}`;

const RELOAD_KEY = 'fos-artwork-reload';

/** A missing immutable artwork URL can be an old tab after a deploy. Reload once per snapshot. */
function recoverFromStaleArtwork(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_KEY) === lock.manifestSha256) return false;
    sessionStorage.setItem(RELOAD_KEY, lock.manifestSha256);
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

export function loadIconChunk(style: StyleId, chunk: number, size: number = catalogMeta.grid): Promise<Record<string, string>> {
  const key = `${size === catalogMeta.grid ? '' : `${size}/`}${style}/${chunk}`;
  chunkCache[key] ??= fetchArtwork(`${key}.json`, style).catch((error: unknown) => {
    delete chunkCache[key];
    throw error;
  });
  return chunkCache[key];
}

export function resetChunkCache() {
  chunkCache = {};
}
