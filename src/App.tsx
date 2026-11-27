import { use } from 'react';
import { lazyPage, loadPage } from './lib/lazy-page';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { Layout } from './components/Layout';
import { Tooltips } from './components/Tooltips';
import { ToastProvider } from './components/ui';
import { DEFAULT_LOCALE, I18nProvider, localizePath, type Translation } from './i18n';
import { docsPageFor } from './i18n/content';
import { catalogMeta } from './lib/catalog-meta';
import { STYLE_PATHS } from './lib/icon-pages';
import { PlanProvider } from './lib/plan';
import { ThemeProvider } from './lib/theme';
import { isCatalogEditor, type CatalogLocation } from './lib/catalog-routing';
import NotFoundPage from './pages/NotFoundPage';
// The prerenderer reuses the app shell's styles before lazy routes load.
import './pages/pricing.css';

const CategoryPage = lazyPage(() => import('./pages/CategoryPage'));
const ChangelogPage = lazyPage(() => import('./pages/ChangelogPage'));
const AiAgentsPage = lazyPage(() => import('./pages/AiAgentsPage'));
const FrameworkPage = lazyPage(() => import('./pages/FrameworkPage'));
const IconPage = lazyPage(() => import('./pages/IconPage'));
const PricingPage = lazyPage(() => import('./pages/PricingPage'));
const StylePage = lazyPage(() => import('./pages/StylePage'));
let editorModule: typeof import('./pages/IconsPage') | undefined;
let pendingEditor: Promise<typeof import('./pages/IconsPage')> | undefined;
const loadEditor = () => pendingEditor ??= loadPage(() => import('./pages/IconsPage')).then((module) => (editorModule = module));

export function preloadCatalogEditor(location: CatalogLocation) {
  return isCatalogEditor(location) ? loadEditor() : undefined;
}

function CatalogEditor() {
  const { default: Editor } = editorModule ?? use(loadEditor());
  return <Editor />;
}

function CatalogRoute({ page }: { page: 'home' | 'brands' | 'category' | 'icon' }) {
  const location = useLocation();
  if (page === 'home' || page === 'brands' || isCatalogEditor(location)) return <CatalogEditor />;
  return page === 'category' ? <CategoryPage /> : <IconPage />;
}

export interface AppProps {
  /** The page's language; its routes live under /<locale> (none for the default). */
  locale?: string;
  /** That language's messages (English is built in). */
  messages?: Translation;
}

/** Routes and providers without a router, so the build can prerender them (see entry-server). */
export function AppShell({ locale = DEFAULT_LOCALE, messages }: AppProps) {
  const base = localizePath('/', locale);
  const DocsPage = docsPageFor(locale);
  return (
    <I18nProvider locale={locale} messages={messages}>
      <ThemeProvider>
        <ToastProvider>
          <PlanProvider>
            <Tooltips />
            <Routes>
              <Route path={base} element={<Layout />}>
                <Route index element={<CatalogRoute page="home" />} />
                <Route path="brands" element={<CatalogRoute page="brands" />} />
                <Route path="docs" element={<DocsPage />} />
                <Route path="changelog" element={<ChangelogPage />} />
                <Route path="pricing" element={<PricingPage />} />
                {/* Crawlable landing pages (src/lib/icon-pages.ts); prerendered by scripts/postbuild.mjs. */}
                <Route path="icons/:name" element={<CatalogRoute page="icon" />} />
                <Route path="categories/time-weather" element={<Navigate to={localizePath('/categories/time-calendar', locale)} replace />} />
                <Route path="categories/:slug" element={<CatalogRoute page="category" />} />
                <Route path="react-icons" element={<FrameworkPage framework="react" />} />
                <Route path="vue-icons" element={<FrameworkPage framework="vue" />} />
                <Route path="figma-icons" element={<FrameworkPage framework="figma" />} />
                <Route path="ai-agents" element={<AiAgentsPage />} />
                {catalogMeta.styles.map((style) => (
                  <Route key={style} path={STYLE_PATHS[style].slice(1)} element={<StylePage key={style} style={style} />} />
                ))}
                <Route path="*" element={<NotFoundPage />} />
              </Route>
              {/* Outside this language's prefix (e.g. a mistyped language): still a 404 page. */}
              <Route path="*" element={<Layout />}>
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </PlanProvider>
        </ToastProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}

export function App(props: AppProps) {
  return (
    <BrowserRouter>
      <AppShell {...props} />
    </BrowserRouter>
  );
}
