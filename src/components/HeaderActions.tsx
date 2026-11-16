import { useEffect, useId, useRef, useState } from 'react';
import { LocalLink, useI18n } from '../i18n';
import { errorText } from '../i18n/errors';
import { downloadBlob } from '../lib/export';
import { buildFullSet, fullSetName } from '../lib/download-all';
import { FEEDBACK_URL, FIGMA_URL, LIBRARY_URL } from '../lib/links';
import { Button, ButtonAnchor, ButtonLink, UiIcon, useToast } from './ui';

/** Phone menu rows: full-width ghost buttons, icon and label aligned left. */
const menuItem = 'w-full justify-start';
/** Plain text links for the header bar. */
const linkBase = 'whitespace-nowrap rounded text-sm font-medium underline-offset-4 transition hover:underline disabled:cursor-wait disabled:opacity-60';
const textLink = `${linkBase} text-muted hover:text-ink`;

/** Builds and downloads the full free set; shared by the bar and the phone menu. */
function useDownloadAll() {
  const toast = useToast();
  const i18n = useI18n();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const name = fullSetName();
      downloadBlob(await buildFullSet(), name);
      toast('success', i18n.t('header.downloaded', { file: name }));
    } catch (error) {
      toast('error', errorText(error, i18n, 'error.download'));
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

/**
 * The home page's two calls to action under its intro: get started with the
 * library (primary) and download the whole set (secondary).
 */
export function HeroActions({ className = '' }: { className?: string }) {
  const download = useDownloadAll();
  const { t } = useI18n();
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <ButtonAnchor href={LIBRARY_URL} external variant="primary" size="lg">{t('header.getStarted')}</ButtonAnchor>
      <Button size="lg" icon="download" onClick={download.run} disabled={download.busy} aria-describedby="download-all-desc" className="disabled:cursor-wait">
        {download.busy ? t('header.preparing') : t('header.download')}
      </Button>
      <span id="download-all-desc" className="sr-only">{t('header.downloadDescription')}</span>
    </div>
  );
}

export function HeaderActions() {
  const { t } = useI18n();
  const NEW_TAB = <span className="sr-only">{t('site.newTab')}</span>;
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); toggleRef.current?.focus(); }
    };
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <nav aria-label={t('header.main')} className="hidden items-center gap-5 md:flex">
        <LocalLink to="/docs" className={textLink}>{t('header.docs')}</LocalLink>
        {FIGMA_URL && (
          <a href={FIGMA_URL} target="_blank" rel="noreferrer" className={textLink}>
            {t('header.figma')}{NEW_TAB}
          </a>
        )}
        <a href={FEEDBACK_URL} target="_blank" rel="noreferrer" className={textLink}>
          {t('header.feedback')}{NEW_TAB}
        </a>
      </nav>

      <div ref={wrapRef} className="relative md:hidden">
        <button
          ref={toggleRef}
          type="button"
          aria-label={t('header.menu')}
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex size-9 items-center justify-center rounded-lg text-ink transition hover:bg-sunken"
        >
          <UiIcon name={open ? 'x' : 'menu'} />
        </button>
        <nav
          id={menuId}
          aria-label={t('header.main')}
          hidden={!open}
          className="absolute right-0 top-11 z-40 w-60 space-y-1 rounded-2xl border border-line bg-surface p-2 shadow-lg"
        >
          <ButtonLink to="/docs" onClick={close} variant="ghost" icon="book-open" className={menuItem}>{t('header.docs')}</ButtonLink>
          {FIGMA_URL && (
            <ButtonAnchor href={FIGMA_URL} external onClick={close} variant="ghost" className={menuItem}>{t('header.figma')}</ButtonAnchor>
          )}
          <ButtonAnchor href={FEEDBACK_URL} external onClick={close} variant="ghost" icon="message-smile-square" className={menuItem}>
            {t('header.feedback')}
          </ButtonAnchor>
        </nav>
      </div>
    </>
  );
}
