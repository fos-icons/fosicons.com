import { lazy, Suspense, useEffect, useId, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LocalLink, useI18n } from '../i18n';
import { FIGMA_URL, ORG_URL } from '../lib/links';
import { Button, ButtonAnchor, ButtonLink, UiIcon } from './ui';

const FeedbackDialog = lazy(() => import('./FeedbackDialog'));

/** Phone menu rows: full-width ghost buttons, icon and label aligned left. */
const menuItem = 'min-h-11 w-full justify-start';
/** Plain text links for the header bar. */
const linkBase = 'whitespace-nowrap rounded text-sm font-medium underline-offset-4 transition hover:underline disabled:cursor-wait disabled:opacity-60';
const textLink = `${linkBase} text-muted hover:text-ink`;

/**
 * The home page's two calls to action under its intro: get started on the
 * GitHub organization (primary) and the docs (secondary).
 */
export function HeroActions({ className = '' }: { className?: string }) {
  const { t } = useI18n();
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <ButtonAnchor href={ORG_URL} external variant="primary" size="lg">{t('header.getStarted')}</ButtonAnchor>
      <ButtonLink to="/docs" size="lg">{t('header.documentation')}</ButtonLink>
    </div>
  );
}

export function HeaderActions({ docsPage = false }: { docsPage?: boolean }) {
  const { t, path } = useI18n();
  const { pathname } = useLocation();
  const NEW_TAB = <span className="sr-only">{t('site.newTab')}</span>;
  const [menuOpen, setOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const menuId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const feedbackTrigger = useRef<HTMLButtonElement | null>(null);
  const close = () => setOpen(false);
  const openFeedback = (trigger: HTMLButtonElement | null) => {
    feedbackTrigger.current = trigger;
    close();
    setFeedbackOpen(true);
  };

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close(); toggleRef.current?.focus(); }
    };
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [menuOpen]);

  return (
    <nav aria-label={t('header.main')} className="flex items-center gap-1 md:gap-5">
      {docsPage && <LocalLink to="/" className={`${textLink} hidden md:inline-flex`}>{t('header.browse')}</LocalLink>}
      <NavLink to={path('/docs')} onClick={close} className={`${textLink} inline-flex min-h-11 items-center px-2 aria-[current=page]:text-ink aria-[current=page]:underline md:px-0`}>
        {t('header.docs')}
      </NavLink>
      <div className="hidden items-center gap-5 md:flex">
        {!docsPage && FIGMA_URL && (
          <a href={FIGMA_URL} target="_blank" rel="noreferrer" className={textLink}>
            {t('header.figma')}{NEW_TAB}
          </a>
        )}
        <button type="button" aria-haspopup="dialog" onClick={(event) => openFeedback(event.currentTarget)} className={textLink}>
          {t('header.feedback')}
        </button>
      </div>

      <div ref={wrapRef} className="relative md:hidden"
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) close(); }}
      >
        <button
          ref={toggleRef}
          type="button"
          aria-label={t('header.menu')}
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => setOpen((open) => !open)}
          className="inline-flex size-11 items-center justify-center rounded-lg text-ink transition hover:bg-sunken"
        >
          <UiIcon name={menuOpen ? 'x' : 'menu'} />
        </button>
        <div
          id={menuId}
          hidden={!menuOpen}
          className="absolute end-0 top-full z-40 w-60 max-w-[calc(100vw-2rem)] space-y-1 rounded-xl border border-line bg-surface p-2 shadow-md"
        >
          <ButtonLink to="/" onClick={close} variant="ghost" icon="search" className={menuItem}>{t('header.browse')}</ButtonLink>
          {!docsPage && FIGMA_URL && (
            <ButtonAnchor href={FIGMA_URL} external onClick={() => { close(); toggleRef.current?.focus(); }} variant="ghost" iconEnd="link-external" className={menuItem}>{t('header.figma')}</ButtonAnchor>
          )}
          <Button aria-haspopup="dialog" onClick={() => openFeedback(toggleRef.current)} variant="ghost" className={menuItem}>
            {t('header.feedback')}
          </Button>
        </div>
      </div>
      {feedbackOpen && (
        <Suspense fallback={null}>
          <FeedbackDialog onClose={() => { setFeedbackOpen(false); feedbackTrigger.current?.focus(); }} />
        </Suspense>
      )}
    </nav>
  );
}
