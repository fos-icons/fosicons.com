import { LocalLink, useI18n } from '../i18n';
import type { Feature } from '../lib/entitlements';
import { usePlan } from '../lib/plan';

/**
 * Says which plan unlocks a feature and links to Pricing. Where billing is off,
 * it shows `fallback` instead (the "coming soon" copy), or nothing.
 */
export function UpgradePrompt({ feature, fallback, className = 'text-xs leading-relaxed text-muted', id }: {
  feature: Feature;
  fallback?: string;
  className?: string;
  id?: string;
}) {
  const { t } = useI18n();
  const { enforced, loading } = usePlan();
  if (!enforced) return fallback ? <p id={id} className={className}>{fallback}</p> : null;
  // A subscriber's plan is still loading: don't flash an upgrade prompt at them.
  if (loading) return null;
  return (
    <p id={id} className={className} data-upgrade={feature}>
      {t(`upgrade.${feature}`)}{' '}
      <LocalLink to="/pricing" className="font-medium text-brand underline-offset-2 hover:underline">{t('upgrade.link')}</LocalLink>
    </p>
  );
}
