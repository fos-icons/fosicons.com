import { lazy, Suspense, useEffect, useId, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n';
import { ORG_URL } from '../lib/links';
import { Button, ButtonAnchor, ButtonLink, UiIcon } from './ui';

const FeedbackDialog = lazy(() => import('./FeedbackDialog'));

/** Phone menu rows: full-width controls, with labels aligned left. */
const menuItem = 'min-h-11 w-full justify-start';
/** Plain text links for the header bar. */
const linkBase = 'whitespace-nowrap rounded text-sm font-medium underline-offset-4 transition hover:underline disabled:cursor-wait disabled:opacity-60';
const textLink = `${linkBase} text-muted hover:text-ink`;
const currentLink = 'aria-[current=page]:text-ink aria-[current=page]:underline';
const mainLinks = [
  { to: '/', label: 'header.browseNav' },
  { to: '/docs', label: 'header.docs' },
  { to: '/pricing', label: 'header.pricing' },
] as const;

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

export function HeaderActions() {
  const { t, path } = useI18n();
  const { pathname } = useLocation();
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
      <div className="hidden items-center gap-5 md:flex">
        {mainLinks.map(({ to, label }) => (
          <NavLink key={to} to={path(to)} end={to === '/'} className={`${textLink} ${currentLink} inline-flex min-h-11 items-center`}>
            {t(label)}
          </NavLink>
        ))}
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
          {mainLinks.map(({ to, label }) => (
            <NavLink key={to} to={path(to)} end={to === '/'} onClick={close} className={`flex items-center rounded-lg px-3 text-sm font-medium text-ink underline-offset-4 hover:bg-sunken ${menuItem} ${currentLink}`}>
              {t(label)}
            </NavLink>
          ))}
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
