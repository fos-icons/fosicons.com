import { Component, type ReactNode } from 'react';
import { useI18n } from '../i18n';
import { CONTAINER } from '../lib/layout';
import { Button, ButtonLink } from './ui';

export class PageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? <PageError /> : this.props.children;
  }
}

function PageError() {
  const { t } = useI18n();
  return (
    <div className={`${CONTAINER} py-12 sm:py-20`}>
      <div role="alert">
        <h1 className="text-3xl font-semibold">{t('error.pageTitle')}</h1>
        <p className="mt-3 text-muted">{t('error.pageBody')}</p>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => window.location.reload()}>{t('error.pageReload')}</Button>
        <ButtonLink to="/">{t('header.browse')}</ButtonLink>
      </div>
    </div>
  );
}
