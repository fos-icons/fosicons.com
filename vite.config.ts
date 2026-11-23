/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import { handleFeedbackRequest } from './api/feedback';
import { FEEDBACK_PATH } from './src/lib/feedback';
import sourceLock from './src/data/source-lock.json';

function versionedArtwork(): Plugin {
  return {
    name: 'fos-versioned-artwork',
    apply: 'serve',
    configureServer(server) {
      const prefix = `/icon-artwork/${sourceLock.manifestSha256}/icons/`;
      server.middlewares.use((req, _res, next) => {
        if (req.url?.startsWith(prefix)) req.url = `/icons/${req.url.slice(prefix.length)}`;
        next();
      });
    },
  };
}

/** Dev only: serve /svg/<style>/<name>.svg from the artwork snapshot (the build writes real files; see scripts/postbuild.mjs). */
function svgFiles(): Plugin {
  const cache: Record<string, Record<string, string>> = {};
  return {
    name: 'fos-svg-files',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const match = /^\/svg\/(regular|preview)\/([a-z0-9-]+)\.svg$/.exec(req.url?.split('?')[0] ?? '');
        if (!match) return next();
        const [, variant, name] = match;
        const style = variant === 'preview' ? 'regular' : variant;
        cache[style] ??= JSON.parse(readFileSync(new URL(`./public/icons/${style}.json`, import.meta.url), 'utf8'));
        const svg = cache[style][name];
        if (!svg) return next();
        try {
          const preview = variant === 'preview' ? (await server.ssrLoadModule('/src/lib/look.ts')).defaultGridSvg(svg) : svg;
          res.setHeader('Content-Type', 'image/svg+xml');
          res.end(preview);
        } catch (error) {
          next(error);
        }
      });
    },
  };
}

/** Dev only: serve the web app manifest the build writes (src/lib/manifest.ts), instead of the HTML fallback. */
function webManifest(): Plugin {
  return {
    name: 'fos-web-manifest',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.split('?')[0] !== '/manifest.webmanifest') return next();
        try {
          const { webManifest } = await server.ssrLoadModule('/src/lib/manifest.ts');
          res.setHeader('Content-Type', 'application/manifest+json');
          res.end(JSON.stringify(webManifest('Fos Icons (development)'), null, 2));
        } catch (error) {
          next(error);
        }
      });
    },
  };
}

function feedbackEndpoint(): Plugin {
  return {
    name: 'fos-feedback',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.split('?')[0] !== FEEDBACK_PATH) return next();
        try {
          await handleFeedbackRequest(req, res, false);
        } catch (error) {
          next(error);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), versionedArtwork(), svgFiles(), webManifest(), feedbackEndpoint()],
  build: { target: 'es2022', chunkSizeWarningLimit: 700 },
  // Large data (the catalog) ships as JSON.parse('…'), which browsers parse faster than object literals.
  json: { stringify: true },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    // Page tests render the full grid (1,000+ cells) in jsdom; CI runners are slower than 5s for some.
    testTimeout: 20_000,
  },
});
