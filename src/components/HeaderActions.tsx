import { Suspense, useEffect, useId, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import { appExamples } from '../data/app-examples';
import { useDisclosure } from '../hooks/useDisclosure';
import { useI18n } from '../i18n';
import { lazyPage } from '../lib/lazy-page';
import { Button, IconButton, UiIcon } from './ui';

const FeedbackDialog = lazyPage(() => import('./FeedbackDialog'));

/** Phone menu rows: full-width controls, with labels aligned left. */
const menuItem = 'min-h-11 w-full justify-start';
/** Plain text links for the header bar. */
const linkBase = 'whitespace-nowrap rounded text-sm font-medium underline-offset-4 transition hover:underline disabled:cursor-wait disabled:opacity-60';
const textLink = `${linkBase} text-muted hover:text-ink`;
const currentLink = 'aria-[current=page]:text-brand';
const mainLinks = [
  { to: '/', label: 'header.browseNav' },
  { to: '/ai-agents', label: 'header.mcp' },
  { to: '/pricing', label: 'header.pricing' },
  { to: '/docs', label: 'header.docs' },
] as const;

function ExamplesMenu({ inline = false, onNavigate }: { inline?: boolean; onNavigate?: () => void }) {
  const { t } = useI18n();
  const id = useId();
  const { open, trigger, toggle, close, container } = useDisclosure();
  return (
    <div {...container} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={toggle}
        className={inline
          ? `flex items-center justify-between rounded-lg px-3 text-sm font-medium text-ink hover:bg-sunken ${menuItem}`
          : `${textLink} inline-flex min-h-11 items-center gap-1 aria-expanded:text-ink`}
      >
        {t('header.examples')}
        <UiIcon name="chevron-down" className={`size-3.5 shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div id={id} hidden={!open} className={inline
        ? 'my-1 ml-3 border-l border-line pl-2'
        : 'absolute end-0 top-full z-40 w-64 rounded-xl border border-line bg-surface p-2 shadow-md'}>
        {appExamples.length ? (
          <ul className="max-h-[min(24rem,60dvh)] overflow-y-auto">
            {appExamples.map(({ name, href, description }) => (
              <li key={href}>
                <a href={href} onClick={() => { close(); onNavigate?.(); }}
                  className="block rounded-lg px-3 py-2 text-sm wrap-anywhere text-ink hover:bg-sunken">
                  <span className="block font-medium">{name}</span>
                  {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
                </a>
              </li>
            ))}
          </ul>
        ) : <p className="px-3 py-2 text-sm text-muted">{t('header.examplesEmpty')}</p>}
      </div>
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
      <div className="hidden items-center gap-5 md:@min-[36rem]/site-header:flex">
        {mainLinks.map(({ to, label }) => (
          <NavLink key={to} to={path(to)} end={to === '/'} className={`${textLink} ${currentLink} inline-flex min-h-11 items-center`}>
            {t(label)}
          </NavLink>
        ))}
        <ExamplesMenu />
        {/* An icon, so the text links stay about the site; its label shows on hover and to screen readers. */}
        <IconButton icon="message-smile-square" label={t('header.feedback')} aria-haspopup="dialog" onClick={(event) => openFeedback(event.currentTarget)} className="-mx-2 text-muted hover:text-ink" />
      </div>

      <div ref={wrapRef} className="relative md:@min-[36rem]/site-header:hidden"
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
          {menuOpen && <ExamplesMenu inline onNavigate={close} />}
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
