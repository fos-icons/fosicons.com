import { Analytics } from '@vercel/analytics/react';
import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './App';
import { prepareAnalyticsEvent } from './lib/analytics';
import { primeArtwork } from './lib/artwork';
import { reloadForNewVersion } from './lib/lazy-page';
import { loadMessages, splitLocale } from './i18n';
import { canHydrate } from './lib/hydration';
import './styles/index.css';

// Stop the prerendered page's entrance animation once the app runs, then
// enable interaction motion once the first render has painted.
const html = document.documentElement;
html.setAttribute('data-hydrated', '');
requestAnimationFrame(() => requestAnimationFrame(() => html.setAttribute('data-motion', '')));

// Landing pages embed the artwork they were prerendered with; use it so the
// first render matches the static HTML instead of waiting for a fetch.
const embedded = document.getElementById('fos-artwork');
if (embedded?.textContent) {
  try { primeArtwork(JSON.parse(embedded.textContent)); } catch { /* fetched on demand instead */ }
}

// A preloaded chunk or stylesheet from an older build is gone after a deploy:
// reload once for the current build instead of failing (see lib/lazy-page).
window.addEventListener('vite:preloadError', (event) => {
  if (reloadForNewVersion()) event.preventDefault();
});

// The language comes from the URL (/fr/…); load its messages before the first render.
const { locale } = splitLocale(window.location.pathname);
loadMessages(locale).then((messages) => {
  const root = document.getElementById('root')!;
  // Exactly the tree the build prerenders (src/entry-server.tsx), so hydration matches it.
  const app = (
    <StrictMode>
      <App locale={locale} messages={messages} />
    </StrictMode>
  );
  // Keep the prerendered DOM when it was rendered for this exact URL, so the
  // browser doesn't rebuild and restyle the page (and its largest paint
  // stays the one visitors saw). Anything else, such as 404.html at an
  // unknown path or a URL with options in its query, renders from scratch.
  // `pnpm run check:hydration` loads the built pages and fails on any mismatch.
  if (canHydrate(root)) hydrateRoot(root, app);
  else createRoot(root).render(app);
  // Analytics draws nothing; its own root keeps it out of the hydrated tree.
  if (import.meta.env.PROD && window.location.hostname === 'www.fosicons.com') {
    createRoot(document.createElement('div')).render(<Analytics mode="production" beforeSend={prepareAnalyticsEvent} />);
  }
});

// Installable app and offline support (production only; see public/sw.js).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* the site works without it */ });
  });
}
