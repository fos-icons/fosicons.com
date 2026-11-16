import { useEffect, useId, useRef, useState } from 'react';
import { LocalLink, useI18n } from '../i18n';
import { errorText } from '../i18n/errors';
import { downloadBlob } from '../lib/export';
import { buildFullSet, fullSetName } from '../lib/download-all';
import { FEEDBACK_URL, FIGMA_URL, LIBRARY_URL } from '../lib/links';
import { UiIcon, useToast } from './ui';

const base = 'inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition disabled:cursor-wait disabled:opacity-60';
const ghost = `${base} text-ink hover:bg-sunken`;
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
  const button = 'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-medium transition';
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <a href={LIBRARY_URL} target="_blank" rel="noreferrer" className={`${button} bg-brand text-brand-ink hover:brightness-110 active:brightness-95`}>
        {t('header.getStarted')}<span className="sr-only">{t('site.newTab')}</span>
      </a>
      <button
        type="button"
        onClick={download.run}
        disabled={download.busy}
        aria-describedby="download-all-desc"
        className={`${button} border border-line-strong bg-surface text-ink hover:bg-sunken disabled:cursor-wait disabled:opacity-60`}
      >
        <UiIcon name="download" className="size-4" />
        {download.busy ? t('header.preparing') : t('header.download')}
      </button>
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
          <LocalLink to="/docs" onClick={close} className={`${ghost} w-full justify-start`}>
            <UiIcon name="book-open" className="size-[18px]" />
            {t('header.docs')}
          </LocalLink>
          {FIGMA_URL && (
            <a href={FIGMA_URL} target="_blank" rel="noreferrer" onClick={close} className={`${ghost} w-full justify-start`}>
              {t('header.figma')}{NEW_TAB}
            </a>
          )}
          <a href={FEEDBACK_URL} target="_blank" rel="noreferrer" onClick={close} className={`${ghost} w-full justify-start`}>
            <UiIcon name="message-smile-square" className="size-[18px]" />
            {t('header.feedback')}{NEW_TAB}
          </a>
        </nav>
      </div>
    </>
  );
}
