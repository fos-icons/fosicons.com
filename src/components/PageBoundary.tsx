import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useI18n } from '../i18n';
import { CONTAINER } from '../lib/layout';
import { isChunkLoadError } from '../lib/lazy-page';
import { Button, ButtonLink } from './ui';

/**
 * Catches errors while rendering a page, so the header and footer stay usable.
 * A page whose code couldn't be downloaded (see lib/lazy-page) gets its own
 * message; anything else is logged to the console for debugging.
 */
export class PageBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state: { error: unknown } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error: error ?? new Error('Unknown error') };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[PageBoundary]', error, info.componentStack);
  }

  render() {
    return this.state.error ? <PageError offline={isChunkLoadError(this.state.error)} /> : this.props.children;
  }
}

function PageError({ offline }: { offline: boolean }) {
  const { t } = useI18n();
  return (
    <div className={`${CONTAINER} py-12 sm:py-20`}>
      <div role="alert">
        <h1 className="text-3xl font-semibold">{t('error.pageTitle')}</h1>
        <p className="mt-3 max-w-xl text-muted">{t(offline ? 'error.pageDownload' : 'error.pageBody')}</p>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => window.location.reload()}>{t('error.pageReload')}</Button>
        <ButtonLink to="/">{t('header.browse')}</ButtonLink>
      </div>
    </div>
  );
}
