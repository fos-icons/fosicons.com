// jsdom lacks matchMedia; the app reads it for theme and layout.
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  }) as MediaQueryList;
}

// jsdom does not lay out or scroll the page.
window.scrollTo = () => {};
Element.prototype.scrollIntoView ??= () => {};

// Node 25+ has its own Web Storage globals. Without --localstorage-file they
// are undefined, and they hide jsdom's. Point tests back at jsdom's storage.
const dom = (globalThis as { jsdom?: { window: Window } }).jsdom?.window;
for (const key of ['localStorage', 'sessionStorage'] as const) {
  if (dom && !globalThis[key]) {
    Object.defineProperty(globalThis, key, { value: dom[key], configurable: true, writable: true });
  }
}

// Page tests reach any cell right away; tests/icon-grid.test.tsx covers progressive mounting.
import { setProgressiveGrid } from '../src/components/IconGrid';
setProgressiveGrid(false);
