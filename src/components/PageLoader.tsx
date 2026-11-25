import markRegular from '../brand/mark-regular.svg?raw';
import { useI18n } from '../i18n';

/**
 * Shown while a page's code downloads: the Fos "F" bouncing on a soft shadow.
 * It fades in after a short delay (see .page-loader in index.css), so fast
 * loads don't flash it. With reduced motion the mark stays still.
 */
export function PageLoader() {
  const { t } = useI18n();
  return (
    <div role="status" className="page-loader flex min-h-[50vh] flex-col items-center justify-center gap-1">
      <span className="page-loader-mark glyph size-10 text-brand" aria-hidden="true" dangerouslySetInnerHTML={{ __html: markRegular }} />
      <span className="page-loader-shadow" aria-hidden="true" />
      <span className="sr-only">{t('site.pageLoading')}</span>
    </div>
  );
}
