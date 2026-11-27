import { Suspense, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Outlet, useLocation, useNavigationType } from 'react-router';
import { LocalLink, useI18n } from '../i18n';
import { splitLocale } from '../i18n/config';
import markRegular from '../brand/mark-regular.svg?raw';
import { animatedNames, catalogMeta as catalog } from '../lib/catalog-meta';
import { isCatalogEditor } from '../lib/catalog-routing';
import { FRAMEWORK_PATHS, STYLE_PATHS } from '../lib/icon-pages';
import { CONTAINER, DOCS_GRID, HeaderSlotContext, PaneHostContext, SITE_FRAME } from '../lib/layout';
import { NPM_URL, ORG_URL, X_URL } from '../lib/links';
import { useDocumentMeta } from '../lib/useDocumentMeta';
import { HeaderActions } from './HeaderActions';
import { LanguageMenu } from './LanguageMenu';
import { PageBoundary } from './PageBoundary';
import { PageLoader } from './PageLoader';
import { UiIcon } from './ui';

/**
 * A link drawn as the library's brand logo (public/brands, synced from the
 * library). A CSS mask paints the file in the text color, so it follows the
 * theme and hover like the text links beside it.
 */
function BrandLink({ href, brand, label, newTab }: { href: string; brand: string; label: string; newTab: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={label}
      className="inline-flex size-8 items-center justify-center rounded-md text-muted transition hover:bg-sunken hover:text-ink"
    >
      <span aria-hidden="true" className="brand-mark size-[18px]" style={{ '--brand-mark': `url(/brands/${brand}-filled.svg)` } as CSSProperties} />
      <span className="sr-only">{label}{newTab}</span>
    </a>
  );
}

const footerLink = 'inline-flex items-center gap-1 rounded text-muted underline-offset-2 transition hover:text-ink hover:underline';

export function Layout() {
  const [paneHost, setPaneHost] = useState<HTMLElement | null>(null);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  useDocumentMeta();
  const { t } = useI18n();
  const location = useLocation();
  const { pathname, hash } = location;
  const editor = isCatalogEditor(location);
  const pageKey = editor ? 'catalog' : pathname;
  const [entrance, setEntrance] = useState({ pageKey, animate: false });
  if (entrance.pageKey !== pageKey) setEntrance({ pageKey, animate: true });
  const pagePath = splitLocale(pathname).path;
  const iconPage = !editor && pagePath.startsWith('/icons/');
  const docsPage = pagePath.replace(/\/$/, '') === '/docs';
  // Long reading pages sit on the surface color, so their content needs no cards.
  const readingPage = docsPage || ['/ai-agents', '/changelog'].includes(pagePath.replace(/\/$/, ''));
  const navigationType = useNavigationType();
  const mainRef = useRef<HTMLElement>(null);
  // A link to another page starts at its top (the router keeps the old scroll
  // otherwise). Back/forward, links to a #section, and query-only updates
  // (a style switch) keep the current position.
  const lastPage = useRef(pageKey);
  useEffect(() => {
    if (lastPage.current === pageKey) return;
    lastPage.current = pageKey;
    if (navigationType !== 'POP' && !hash) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      mainRef.current?.focus({ preventScroll: true });
    }
  }, [pageKey, navigationType, hash]);
  const header = (
    <header className={`h-[var(--site-header-height)] shrink-0 border-b border-line ${iconPage ? 'header-glass' : ''}`}>
      <div className={`${CONTAINER} flex h-full items-center gap-2 ${docsPage ? `${DOCS_GRID} md:grid md:grid-cols-[var(--docs-nav-width)_minmax(0,1fr)_auto]` : ''}`}>
        <LocalLink to="/" className="flex shrink-0 items-center gap-2 rounded-lg pr-1 text-ink md:justify-self-start" aria-label={t('site.home')}>
          <span className="glyph size-7 text-ink" aria-hidden="true" dangerouslySetInnerHTML={{ __html: markRegular }} />
          <span className="whitespace-nowrap font-display text-[20px] font-semibold tracking-tight">{t('site.name')}</span>
        </LocalLink>
        <div ref={setHeaderSlot} className={`hidden min-w-0 empty:hidden md:flex ${docsPage ? 'md:col-start-2' : 'flex-1 justify-center px-2 lg:px-6'}`} />
        <div className={`ml-auto flex items-center gap-2 md:gap-5 ${docsPage ? 'md:col-start-3' : ''}`}>
          <HeaderActions />
        </div>
      </div>
    </header>
  );
  return (
    <PaneHostContext.Provider value={paneHost}>
    <HeaderSlotContext.Provider value={headerSlot}>
      <div className={`flex min-h-dvh flex-col [--site-header-height:calc(3.5rem+1px)] ${readingPage ? 'bg-surface' : ''}`}>
        <a href="#main" className="sr-only z-50 rounded-lg bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
          {t('site.skipToContent')}
        </a>
        {header}
        <div className={`${SITE_FRAME} grid flex-1 grid-cols-[minmax(0,1fr)_auto]`}>
          <div className="flex min-w-0 flex-col">
            <main ref={mainRef} id="main" tabIndex={-1} className="flex-1 outline-none">
              {/* Re-keyed per page so moving between pages eases in (see .route-enter). */}
              <div key={pageKey} className="route-enter page-enter" data-enter={entrance.animate || undefined}>
                <PageBoundary>
                  <Suspense fallback={<PageLoader />}>
                    <Outlet />
                  </Suspense>
                </PageBoundary>
              </div>
            </main>
            <footer className="border-t border-line">
              <div className={`${CONTAINER} border-b border-line py-7 text-sm`}>
                <nav aria-label={t('footer.browse')} className="grid gap-3 md:grid-cols-[auto_1fr] md:gap-x-8">
                  <h2 className="font-medium text-ink">{t('footer.browse')}</h2>
                  <ul className="grid grid-cols-2 gap-x-4 gap-y-2 sm:flex sm:flex-wrap sm:gap-x-5">
                    <li><LocalLink to={FRAMEWORK_PATHS.react} className={footerLink}>{t('footer.reactIcons')}</LocalLink></li>
                    <li><LocalLink to={FRAMEWORK_PATHS.vue} className={footerLink}>{t('footer.vueIcons')}</LocalLink></li>
                    <li><LocalLink to="/docs#flutter" className={footerLink}>{t('footer.flutterIcons')}</LocalLink></li>
                    <li><LocalLink to={FRAMEWORK_PATHS.figma} className={footerLink}>{t('footer.figmaIcons')}</LocalLink></li>
                    <li><LocalLink to="/ai-agents" className={footerLink}>{t('footer.aiAgents')}</LocalLink></li>
                    {catalog.styles.map((style) => (
                      <li key={style}><LocalLink to={STYLE_PATHS[style]} className={footerLink}>{t('footer.styleIcons', { style: t(`style.${style}`) })}</LocalLink></li>
                    ))}
                    {animatedNames.size > 0 && (
                      <li><LocalLink to="/?style=animated" className={footerLink}>{t('footer.styleIcons', { style: t('style.animated') })}</LocalLink></li>
                    )}
                  </ul>
                </nav>
              </div>
              <div className={`${CONTAINER} flex flex-col gap-3 py-6 text-sm text-muted md:flex-row md:items-center md:justify-between`}>
                <nav aria-label={t('footer.nav')} className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  <LocalLink to="/changelog" className={footerLink}>{t('changelog.title')}</LocalLink>
                  <LocalLink to="/docs#privacy" className={footerLink}>{t('footer.privacy')}</LocalLink>
                  <LocalLink to="/docs#terms" className={footerLink}>{t('footer.terms')}</LocalLink>
                  <LocalLink to="/docs#licensing" className={footerLink}>{t('footer.license')}</LocalLink>
                  <LanguageMenu />
                </nav>
                <nav aria-label={t('footer.elsewhere')} className="flex items-center gap-3">
                  <a href={NPM_URL} target="_blank" rel="noreferrer" className={footerLink}>
                    {t('footer.npm')} <UiIcon name="link-external" className="size-3.5" />
                    <span className="sr-only">{t('site.newTab')}</span>
                  </a>
                  <span aria-hidden="true" className="text-line-strong">|</span>
                  <div className="flex items-center gap-1">
                    <BrandLink href={ORG_URL} brand="github" label={t('footer.github')} newTab={t('site.newTab')} />
                    <BrandLink href={X_URL} brand="x" label={t('footer.x')} newTab={t('site.newTab')} />
                  </div>
                </nav>
              </div>
            </footer>
          </div>
          <div ref={setPaneHost} className={`hidden lg:block ${iconPage ? '[--inspector-top:var(--site-header-height)]' : ''}`} />
        </div>
      </div>
    </HeaderSlotContext.Provider>
    </PaneHostContext.Provider>
  );
}
