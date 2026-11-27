import { createPortal } from 'react-dom';
import markRegular from '../brand/mark-regular.svg?raw';
import { useI18n } from '../i18n';

/**
 * The cover hides the site immediately. The mark fades in after a short
 * delay so fast loads don't flash it. With reduced motion it stays still.
 */
export function PageLoader() {
  const { t } = useI18n();
  const cover = (
    <div role="status" className="page-loader fixed inset-0 z-[110] grid place-items-center bg-canvas">
      <div className="page-loader-visual flex flex-col items-center gap-1" aria-hidden="true">
        <span className="page-loader-mark glyph size-10 text-brand" dangerouslySetInnerHTML={{ __html: markRegular }} />
        <span className="page-loader-shadow" />
      </div>
      <span className="sr-only">{t('site.pageLoading')}</span>
    </div>
  );
  return typeof document === 'undefined' ? cover : createPortal(cover, document.body);
}
