import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/**
 * Pages load as separate chunks. A chunk can fail to download when the site
 * was redeployed after this tab loaded (the old chunk names are gone), when
 * the connection drops, or when a dev server restarts. Reloading fetches the
 * current HTML and chunk names, so do that once instead of showing an error.
 */

const RELOAD_KEY = 'fos:chunk-reload';
/** Don't reload again within this window: the reload didn't help, so show the error. */
const RELOAD_WINDOW_MS = 30_000;

/** Messages browsers use when a dynamic import or its CSS fails to load. */
const CHUNK_ERROR = /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Failed to load module script/i;

export function isChunkLoadError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'ChunkLoadError' || CHUNK_ERROR.test(error.message));
}

/**
 * Reload the page to pick up the current build, at most once per window.
 * Returns false (and does nothing) when it already tried, or can't tell.
 */
export function reloadForNewVersion(now = Date.now()): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY));
    if (last && now - last < RELOAD_WINDOW_MS) return false;
    window.sessionStorage.setItem(RELOAD_KEY, String(now));
  } catch {
    return false; // Without storage we can't prevent a reload loop.
  }
  window.location.reload();
  return true;
}

/** React.lazy that reloads once if the chunk can't be downloaded. */
export function lazyPage<T extends ComponentType<any>>(load: () => Promise<{ default: T }>): LazyExoticComponent<T> { // eslint-disable-line @typescript-eslint/no-explicit-any
  return lazy(() => loadPage(load));
}

export function loadPage<T>(load: () => Promise<T>): Promise<T> {
  return load().catch((error: unknown) => {
    // Keep the Suspense fallback up while the page reloads.
    if (isChunkLoadError(error) && reloadForNewVersion()) return new Promise<never>(() => {});
    throw error;
  });
}
