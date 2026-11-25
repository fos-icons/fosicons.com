import { useSyncExternalStore } from 'react';

/**
 * Whether the app can hydrate the prerendered HTML in `root` instead of
 * replacing it: only when the build rendered it for this exact URL
 * (scripts/postbuild.mjs stamps `data-prerendered`) and nothing in the query
 * changes what the page shows. tests/hydration.test.ts checks that the first
 * client render matches the prerendered pages.
 */
export function canHydrate(root: HTMLElement, location: Pick<Location, 'pathname' | 'search'> = window.location): boolean {
  const rendered = root.dataset.prerendered;
  return !!rendered && root.firstChild !== null && rendered === location.pathname && location.search === '';
}

const noSubscribe = () => () => {};

/**
 * A value only the browser knows (a saved setting, a media query), read so
 * that hydration still matches the prerendered HTML: React uses `server` for
 * the hydrating render, then re-renders with `read()` right away. A page
 * rendered from scratch gets `read()` from the start. `read` must return the
 * same value until it changes (a primitive, not a new object each call).
 */
export function useClientValue<T>(read: () => T, server: T, subscribe: (onChange: () => void) => () => void = noSubscribe): T {
  return useSyncExternalStore(subscribe, read, () => server);
}
