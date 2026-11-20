/**
 * The web app manifest (makes the site installable, with public/sw.js). The
 * build writes it to dist/manifest.webmanifest with the home page's
 * description; the dev server serves the same JSON (vite.config.ts). No app
 * imports, so Vite's config can load it on its own.
 */
export function webManifest(description: string) {
  return {
    name: 'Fos Icons',
    short_name: 'Fos Icons',
    description,
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone'],
    background_color: '#fbfbfa',
    theme_color: '#fbfbfa',
    lang: 'en',
    dir: 'ltr',
    categories: ['design', 'developer', 'productivity', 'utilities'],
    icons: [
      { src: '/app/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/app/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/app/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
    shortcuts: [
      { name: 'Brand icons', url: '/brands', icons: [{ src: '/app/icon-192.png', sizes: '192x192' }] },
      { name: 'Docs', url: '/docs', icons: [{ src: '/app/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
