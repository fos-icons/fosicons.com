// Check that the app hydrates the prerendered pages without a mismatch.
//
// src/main.tsx hydrates a page's prerendered HTML instead of rebuilding it.
// Production React leaves mismatched attributes stale without a word (and
// rebuilds whole subtrees on mismatched text), so this loads the built pages
// in Chromium with a development build of the client swapped in, which
// reports every difference, as a first-time visitor on a phone and as
// returning visitors on a desktop with saved settings.
//
// Usage: pnpm run build && pnpm run check:hydration
// Needs Playwright's Chromium: `pnpm exec playwright install chromium` once.
/* global window, document -- used only inside callbacks that run in the page */
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
if (!existsSync(join(dist, 'index.html'))) {
  console.error('No build in dist/. Run `pnpm run build` first.');
  process.exit(1);
}

const ROUTES = [
  '/', '/brands', '/docs', '/pricing', '/ai-agents',
  '/react-icons', '/vue-icons', '/figma-icons', '/regular-icons', '/duotone-icons',
  '/categories/time-calendar', '/icons/home', '/icons/calendar',
];

const VISITORS = {
  'first-time, phone': { viewport: { width: 390, height: 844 }, colorScheme: 'light', storage: {} },
  'returning, desktop': {
    viewport: { width: 1440, height: 900 },
    colorScheme: 'light',
    storage: {
      'fos-theme': 'dark', 'fos-pane-width': '500', 'fos-pane-collapsed': '1',
      'fos:code-tab': 'vue', 'fos-learned-tips': '["modifier","color"]',
    },
  },
  'first-time, desktop, dark system theme': { viewport: { width: 1280, height: 800 }, colorScheme: 'dark', storage: {} },
};

/** React's hydration reports, in development and (as error codes) in production. */
const MISMATCH = /hydrat|didn't match|Minified React error #(418|419|421|422|423|425)\b/i;

// A development build of the client: same chunks, with React's warnings.
const cache = join(root, 'node_modules/.cache');
mkdirSync(cache, { recursive: true });
const devOut = mkdtempSync(join(cache, 'fos-hydration-'));
process.env.NODE_ENV = 'development';
const { build } = await import('vite');
await build({ root, mode: 'development', logLevel: 'error', build: { outDir: devOut, emptyOutDir: true, minify: false } });
const entryOf = (html) => html.match(/<script type="module"[^>]*src="\/(assets\/[^"]+\.js)"/)?.[1];
const prodEntry = entryOf(readFileSync(join(dist, 'index.html'), 'utf8'));
const devEntry = entryOf(readFileSync(join(devOut, 'index.html'), 'utf8'));
if (!prodEntry || !devEntry) throw new Error('Could not find the app entry script in index.html');

// Serve dist/ as Vercel does (clean URLs), with the development entry and its chunks.
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const isFile = (file) => existsSync(file) && statSync(file).isFile();
function resolve(pathname) {
  if (pathname.startsWith('/assets/') && isFile(join(devOut, pathname))) return join(devOut, pathname);
  const file = join(dist, pathname);
  for (const candidate of [file, join(file, 'index.html'), `${file}.html`]) if (isFile(candidate)) return candidate;
  return null;
}
const server = createServer((req, res) => {
  const file = resolve(decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  res.statusCode = file ? 200 : 404;
  res.setHeader('content-type', TYPES[extname(file ?? '.html')] ?? 'application/octet-stream');
  const body = readFileSync(file ?? join(dist, '404.html'));
  // Point the page at the development entry, under its own name, so its
  // chunks share one copy of the app.
  res.end(extname(file ?? '.html') === '.html' ? body.toString('utf8').replaceAll(`/${prodEntry}`, `/${devEntry}`) : body);
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const browser = await chromium.launch();
try {
  for (const [visitor, { viewport, colorScheme, storage }] of Object.entries(VISITORS)) {
    for (const route of ROUTES) {
      const context = await browser.newContext({ viewport, colorScheme, serviceWorkers: 'block' });
      await context.addInitScript((saved) => {
        for (const [key, value] of Object.entries(saved)) localStorage.setItem(key, value);
      }, storage);
      const page = await context.newPage();
      const problems = [];
      let requestedCatalog = false;
      page.on('request', (request) => {
        if (/^\/assets\/catalog-data-[\w-]+\.js$/.test(new URL(request.url()).pathname)) requestedCatalog = true;
      });
      page.on('console', (message) => { if (MISMATCH.test(message.text())) problems.push(message.text()); });
      page.on('pageerror', (error) => { if (MISMATCH.test(error.message)) problems.push(error.message); });
      // Remember a prerendered element, to confirm hydration kept the DOM.
      await page.addInitScript(() => {
        document.addEventListener('DOMContentLoaded', () => { window.__prerendered = document.querySelector('#root main'); });
      });
      await page.goto(origin + route, { waitUntil: 'networkidle' });
      // Outlined Suspense boundaries reveal (and hydrate) a moment after load.
      await page.waitForTimeout(1000);
      const state = await page.evaluate(() => ({
        stamped: !!document.getElementById('root')?.dataset.prerendered,
        kept: !!window.__prerendered && document.getElementById('root').contains(window.__prerendered),
      }));
      if (!state.stamped) problems.push('The page is not stamped as prerendered, so it does not hydrate.');
      else if (!state.kept) problems.push('The prerendered DOM was replaced instead of hydrated.');
      const needsCatalog = route === '/' || route === '/brands' || /^\/(icons|categories)\//.test(route);
      if (requestedCatalog !== needsCatalog) {
        problems.push(needsCatalog ? 'The full catalog was not requested.' : 'The route unnecessarily requested the full catalog.');
      }
      console.log(`${problems.length ? '✗' : '✓'} ${route} (${visitor})`);
      if (problems.length) failures.push({ route, visitor, problems });
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.close();
  rmSync(devOut, { recursive: true, force: true });
}

for (const { route, visitor, problems } of failures) {
  console.error(`\n${route} (${visitor}):`);
  for (const problem of problems) console.error(`  ${problem.split('\n').slice(0, 40).join('\n  ')}`);
}
console.log(failures.length ? `\n${failures.length} page load(s) did not hydrate cleanly.` : '\nEvery page hydrated without a mismatch.');
process.exit(failures.length ? 1 : 0);
