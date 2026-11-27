import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { errorText } from '../i18n/errors';
import { copyText } from '../lib/export';
import { UiAnimatedCheck, UiIcon, useToast } from './ui';

export function CopyIconName({ name, compact = false }: { name: string; compact?: boolean }) {
  const i18n = useI18n();
  const toast = useToast();
  const [copied, setCopied] = useState(0);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(0), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <>
      <button
        type="button"
        aria-label={i18n.t('iconPage.copyName')}
        data-tooltip={i18n.t(copied ? 'code.copied' : 'iconPage.copyName')}
        className={`inline-flex shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-sunken hover:text-ink ${compact ? 'size-7' : 'size-11'}`}
        onClick={() => copyText(name).then(
          () => setCopied((count) => count + 1),
          (error) => toast('error', errorText(error, i18n, 'error.copy')),
        )}
      >
        {copied ? <UiAnimatedCheck key={copied} className={compact ? 'size-4 text-success' : 'size-5 text-success'} /> : <UiIcon name="copy" className={compact ? 'size-4' : undefined} />}
      </button>
      <span role="status" className="sr-only">{copied ? i18n.t('export.copiedName', { name }) : ''}</span>
    </>
  );
}
