import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigationType } from 'react-router-dom';
import { LocalLink, useI18n } from '../i18n';
import { splitLocale } from '../i18n/config';
import markRegular from '../brand/mark-regular.svg?raw';
import { catalog } from '../lib/catalog';
import { categoryPath, FRAMEWORK_PATHS } from '../lib/icon-pages';
import { CONTAINER, HeaderSlotContext, PaneHostContext } from '../lib/layout';
import { LIBRARY_URL, NPM_URL } from '../lib/links';
import { useDocumentMeta } from '../lib/useDocumentMeta';
import { HeaderActions } from './HeaderActions';
import { LanguageMenu } from './LanguageMenu';
import { ThemeToggle } from './ThemeToggle';
import { UiIcon } from './ui';

const footerLink = 'inline-flex items-center gap-1 rounded text-muted underline-offset-2 transition hover:text-ink hover:underline';

export function Layout() {
  const [paneHost, setPaneHost] = useState<HTMLElement | null>(null);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  useDocumentMeta();
  const { t, label } = useI18n();
  const { pathname, hash } = useLocation();
  const iconPage = splitLocale(pathname).path.startsWith('/icons/');
  const navigationType = useNavigationType();
  // A link to another page starts at its top (the router keeps the old scroll
  // otherwise). Back/forward, links to a #section, and query-only updates
  // (a style switch) keep the current position.
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    if (navigationType !== 'POP' && !hash) window.scrollTo(0, 0);
  }, [pathname, navigationType, hash]);
  return (
    <PaneHostContext.Provider value={paneHost}>
    <HeaderSlotContext.Provider value={headerSlot}>
      <div className="flex min-h-dvh">
        <div className="flex min-w-0 flex-1 flex-col">
          <a href="#main" className="sr-only z-50 rounded-lg bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
            {t('site.skipToContent')}
          </a>
          {/* Icon pages keep the header (and its search) in view as frosted glass; elsewhere it scrolls away. */}
          <header className={`border-b border-line ${iconPage ? 'header-glass' : ''}`}>
            <div className={`${CONTAINER} flex h-14 items-center gap-2`}>
              <LocalLink to="/" className="flex shrink-0 items-center gap-2 rounded-lg pr-1 text-ink" aria-label={t('site.home')}>
                <span className="glyph size-7 text-ink" aria-hidden="true" dangerouslySetInnerHTML={{ __html: markRegular }} />
                <span className="whitespace-nowrap font-display text-[20px] font-semibold tracking-tight">{t('site.name')}</span>
              </LocalLink>
              <div ref={setHeaderSlot} className="hidden min-w-0 flex-1 justify-center px-6 empty:hidden md:flex" />
              <div className="ml-auto flex items-center gap-2 md:gap-5">
                <HeaderActions />
                {/* With the desktop side pane open, the toggle lives in the pane's bar. */}
                <ThemeToggle className="-mr-2 [:root:has(#side-pane-body)_&]:hidden" />
              </div>
            </div>
          </header>
          <main id="main" tabIndex={-1} className="flex-1 outline-none">
            {/* Re-keyed per page so moving between pages eases in (see .route-enter). */}
            <div key={pathname} className="route-enter page-enter">
              <Outlet />
            </div>
          </main>
          <footer className="border-t border-line">
            {/* Every page links to every category and framework page, so crawlers reach each icon page. */}
            <div className={`${CONTAINER} grid gap-6 border-b border-line py-8 text-sm md:grid-cols-[auto_1fr] md:gap-16`}>
              <nav aria-label={t('footer.browse')}>
                <h2 className="font-medium text-ink">{t('footer.browse')}</h2>
                <ul className="mt-3 space-y-2">
                  <li><LocalLink to={FRAMEWORK_PATHS.react} className={footerLink}>{t('footer.reactIcons')}</LocalLink></li>
                  <li><LocalLink to={FRAMEWORK_PATHS.vue} className={footerLink}>{t('footer.vueIcons')}</LocalLink></li>
                  <li><LocalLink to={FRAMEWORK_PATHS.figma} className={footerLink}>{t('footer.figmaIcons')}</LocalLink></li>
                </ul>
              </nav>
              <nav aria-label={t('footer.categories')}>
                <h2 className="font-medium text-ink">{t('footer.categories')}</h2>
                <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
                  {catalog.categories.map((c) => (
                    <li key={c.name}><LocalLink to={categoryPath(c.name)} className={footerLink}>{label('category', c.name, c.name)}</LocalLink></li>
                  ))}
                </ul>
              </nav>
            </div>
            <div className={`${CONTAINER} flex flex-col gap-3 py-6 text-sm text-muted md:flex-row md:items-center md:justify-between`}>
              <nav aria-label={t('footer.nav')} className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <LocalLink to="/docs#privacy" className={footerLink}>{t('footer.privacy')}</LocalLink>
                <LocalLink to="/docs#licensing" className={footerLink}>{t('footer.license')}</LocalLink>
                <LanguageMenu />
              </nav>
              <nav aria-label={t('footer.elsewhere')} className="flex items-center gap-3">
                <a href={LIBRARY_URL} target="_blank" rel="noreferrer" className={footerLink}>
                  {t('footer.github')} <UiIcon name="link-external" className="size-3.5" />
                  <span className="sr-only">{t('site.newTab')}</span>
                </a>
                <span aria-hidden="true" className="text-line-strong">|</span>
                <a href={NPM_URL} target="_blank" rel="noreferrer" className={footerLink}>
                  {t('footer.npm')} <UiIcon name="link-external" className="size-3.5" />
                  <span className="sr-only">{t('site.newTab')}</span>
                </a>
              </nav>
            </div>
          </footer>
        </div>
        <div ref={setPaneHost} className="hidden shrink-0 lg:block" />
      </div>
    </HeaderSlotContext.Provider>
    </PaneHostContext.Provider>
  );
}
