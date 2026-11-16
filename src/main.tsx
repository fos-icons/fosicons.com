import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { primeArtwork } from './lib/artwork';
import { loadMessages, splitLocale } from './i18n';
import './styles/index.css';

// The app replaces the prerendered HTML: stop its entrance animation first,
// then enable interaction motion once the first render has painted.
const html = document.documentElement;
html.setAttribute('data-hydrated', '');
requestAnimationFrame(() => requestAnimationFrame(() => html.setAttribute('data-motion', '')));

// Landing pages embed the artwork they were prerendered with; use it so the
// first render matches the static HTML instead of waiting for a fetch.
const embedded = document.getElementById('fos-artwork');
if (embedded?.textContent) {
  try { primeArtwork(JSON.parse(embedded.textContent)); } catch { /* fetched on demand instead */ }
}

// The language comes from the URL (/fr/…); load its messages before the first render.
const { locale } = splitLocale(window.location.pathname);
loadMessages(locale).then((messages) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App locale={locale} messages={messages} />
    </StrictMode>,
  );
});

// Installable app and offline support (production only; see public/sw.js).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* the site works without it */ });
  });
}
