import { Suspense, useEffect, useId, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Glyph } from '../components/LandingParts';
import { Button, ButtonLink, UiIcon } from '../components/ui';
import { LocalLink, useI18n } from '../i18n';
import { useSizedArtwork } from '../lib/artwork';
import { useHostedBilling } from '../lib/billing-actions';
import { isPaidPlan, PAID_PLANS, type PaidPlan } from '../lib/billing-plans';
import type { StyleId } from '../lib/catalog';
import { CONTAINER } from '../lib/layout';
import { lazyPage } from '../lib/lazy-page';
import { billingMode, hasOpenSubscription, usePlan } from '../lib/plan';

const plans = [
  { id: 'free', highlights: ['regular', 'find', 'customize', 'singleExport'] },
  { id: 'pro', highlights: ['styles', 'duoColors', 'zip'] },
  { id: 'advanced', highlights: ['modifiers', 'placement', 'modifierExports'] },
] as const;

const BillingAccount = billingMode ? lazyPage(() => import('./BillingAccount')) : null;

type PlanId = (typeof plans)[number]['id'];
const planLevel: Record<PlanId, number> = { free: 0, pro: 1, advanced: 2 };
const featureGroups = [
  { id: 'library', minimum: 'free', features: ['regular', 'find', 'categories'] },
  { id: 'library', minimum: 'pro', features: ['solid', 'duocolor', 'duotone'] },
  { id: 'customize', minimum: 'free', features: ['sizeColor', 'stroke'] },
  { id: 'customize', minimum: 'pro', features: ['duoColors'] },
  { id: 'export', minimum: 'free', features: ['svg', 'png', 'pngScales', 'clipboard'] },
  { id: 'export', minimum: 'pro', features: ['svgZip', 'pngZip'] },
  { id: 'modifiers', minimum: 'advanced', features: ['modifierPicker', 'modifierPlacement', 'modifierColor', 'modifierSingle', 'modifierZip'] },
  { id: 'agents', minimum: 'free', features: ['agentLookup', 'agentSnippets'] },
] as const satisfies readonly { id: string; minimum: PlanId; features: readonly string[] }[];
const groups = [...new Set(featureGroups.map(({ id }) => id))];

function Specimen({ style, name = 'calendar', className = '' }: { style: StyleId; name?: string; className?: string }) {
  const id = useId();
  const [art] = useSizedArtwork(style, [name], [64]);
  return <Glyph svg={art[name]} idPrefix={`pricing-${id}-`} className={className} />;
}

/** The same calendar, gaining what each plan adds: one style, four styles, then a modifier. */
function PlanArtwork({ plan }: { plan: PlanId }) {
  return (
    <div className="pricing-specimen" aria-hidden="true">
      {plan === 'free' ? (
        <Specimen style="regular" className="pricing-specimen-one" />
      ) : plan === 'pro' ? (
        <div className="pricing-specimen-styles">
          <Specimen style="regular" />
          <Specimen style="filled" />
          <Specimen style="duocolor" />
          <Specimen style="duotone" />
        </div>
      ) : (
        <Specimen style="duotone" name="calendar-add" className="pricing-specimen-one" />
      )}
    </div>
  );
}

const questions = ['annual', 'modifiers', 'license', 'agents'] as const;

/**
 * A paid plan's main action. Signed out, it opens sign-in for that plan; on
 * Free, it goes straight to Checkout; with a subscription, it shows the
 * current plan or opens the billing portal, so nobody pays twice.
 */
function PlanAction({ plan, ready, onChoose }: { plan: PaidPlan; ready: boolean; onChoose: (plan: PaidPlan) => void }) {
  const { t } = useI18n();
  const { session, subscription, loading } = usePlan();
  const billing = useHostedBilling(session?.token);
  const name = t(`pricing.plan.${plan}`);
  const errorId = useId();

  if (session && subscription && hasOpenSubscription(subscription)) {
    if (subscription.plan === plan) {
      return <span className="pricing-status pricing-status--current"><span aria-hidden="true" />{t('pricing.currentPlan')}</span>;
    }
    return (
      <>
        <Button size="lg" disabled={billing.pending !== null} onClick={() => void billing.open('portal')}>{t('billing.manage')}</Button>
        {billing.error && <p role="alert" className="pricing-action-error">{t(billing.error)}</p>}
      </>
    );
  }
  return (
    <>
      <Button
        variant="primary" size="lg" iconEnd="arrow-right"
        disabled={!ready || loading || billing.pending !== null}
        aria-describedby={billing.error ? errorId : undefined}
        onClick={() => (session ? void billing.open('checkout', plan) : onChoose(plan))}
      >
        {t('pricing.get', { plan: name })}
      </Button>
      {billing.error && <p id={errorId} role="alert" className="pricing-action-error">{t(billing.error)}</p>}
    </>
  );
}

export default function PricingPage() {
  const { n, t, rich } = useI18n();
  const { session } = usePlan();
  /**
   * Whether the billing endpoint is up: it answers 401 to an anonymous status
   * read when it's configured, and 503 when it's off (e.g. a live build on a
   * preview deployment). `null` while checking.
   */
  const [available, setAvailable] = useState<boolean | null>(billingMode ? null : false);
  const [chosen, setChosen] = useState<PaidPlan | null>(null);
  const [search] = useSearchParams();
  /** Back from Stripe (`?billing=success` or `cancel`). */
  const returned = search.has('billing');
  useEffect(() => {
    if (!billingMode) return;
    const controller = new AbortController();
    void fetch('/api/billing/status', { signal: controller.signal })
      .then((response) => {
        if (!controller.signal.aborted) setAvailable(response.status === 401);
      }, () => {
        if (!controller.signal.aborted) setAvailable(false);
      });
    return () => controller.abort();
  }, []);
  const showAccount = available === true && (!!session || !!chosen || returned);
  const currency = (amount: number) => n(amount, {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0, minimumFractionDigits: 0,
  });

  return (
    <div className={`${CONTAINER} pricing`}>
      <header className="pricing-intro">
        <h1 id="pricing-title">{t('pricing.title')}</h1>
        <p>{t('pricing.intro')}</p>
      </header>

      {showAccount && BillingAccount && billingMode && (
        <Suspense fallback={null}><BillingAccount mode={billingMode} chosen={chosen} /></Suspense>
      )}

      <section className="pricing-board" aria-labelledby="pricing-title">
        <div className="pricing-board-head">
          <div className="pricing-lede">
            <h2 id="pricing-compare">{t('pricing.compare')}</h2>
            <p>{t('pricing.compareIntro')}</p>
            {available === false && <p className="pricing-launch">{t('pricing.launch')}</p>}
          </div>

          {plans.map(({ id, highlights }) => (
            <article key={id} className={`pricing-plan pricing-plan--${id}`} aria-labelledby={`pricing-${id}`}>
              <div className="pricing-plan-name">
                <h3 id={`pricing-${id}`}>{t(`pricing.plan.${id}`)}</h3>
                <PlanArtwork plan={id} />
              </div>
              <p className="pricing-price">
                <span className="pricing-price-amount">
                  <strong>{currency(isPaidPlan(id) ? PAID_PLANS[id].firstYear : 0)}</strong>
                </span>
                <span className="pricing-price-term">{t(isPaidPlan(id) ? 'pricing.firstYear' : 'pricing.noCharge')}</span>
                {isPaidPlan(id) && (
                  <span className="pricing-renewal">{t('pricing.renewsAt', { price: currency(PAID_PLANS[id].renewal) })}</span>
                )}
              </p>
              <p className="pricing-summary">{t(`pricing.summary.${id}`)}</p>
              <div className="pricing-action">
                {isPaidPlan(id) ? (
                  available === false
                    ? <span className="pricing-status"><span aria-hidden="true" />{t('pricing.comingSoon')}</span>
                    : <PlanAction plan={id} ready={available === true} onChoose={setChosen} />
                ) : (
                  <ButtonLink to="/?style=regular" variant="primary" size="lg" iconEnd="arrow-right">{t('pricing.browse')}</ButtonLink>
                )}
              </div>
              <ul className="pricing-highlights">
                {highlights.map((feature) => (
                  <li key={feature}>
                    <UiIcon name="badge-verified" className="size-6" />
                    <span>{rich(`pricing.highlight.${feature}`, { strong: (text) => <strong>{text}</strong> })}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <table className="pricing-matrix" aria-labelledby="pricing-compare">
          <colgroup>
            <col className="pricing-matrix-label" />
            {plans.map(({ id }) => <col key={id} />)}
          </colgroup>
          <thead>
            <tr>
              <th scope="col">{t('pricing.feature')}</th>
              {plans.map(({ id }) => <th key={id} scope="col" className={`pricing-cell--${id}`}>{t(`pricing.plan.${id}`)}</th>)}
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group}>
              <tr className="pricing-matrix-group">
                <th scope="rowgroup" colSpan={plans.length + 1}>{t(`pricing.group.${group}`)}</th>
              </tr>
              {featureGroups.filter(({ id }) => id === group).flatMap(({ minimum, features }) =>
                features.map((feature) => (
                  <tr key={feature}>
                    <th scope="row">{t(`pricing.feature.${feature}`)}</th>
                    {plans.map(({ id }) => {
                      const included = planLevel[id] >= planLevel[minimum];
                      return (
                        <td key={id} className={`pricing-cell--${id}`} data-included={included || undefined}>
                          <span className="sr-only">{t(included ? 'pricing.included' : 'pricing.notIncluded')}</span>
                          <UiIcon name={included ? 'badge-verified' : 'minus'} className="size-5" />
                        </td>
                      );
                    })}
                  </tr>
                )),
              )}
            </tbody>
          ))}
        </table>
        <p className="pricing-library-note">
          {rich('pricing.libraryNote', {
            figma: (text) => <LocalLink to="/docs#figma">{text}</LocalLink>,
            packages: (text) => <LocalLink to="/docs">{text}</LocalLink>,
          })}
        </p>
      </section>

      <section className="pricing-faq" aria-labelledby="pricing-faq">
        <h2 id="pricing-faq">{t('pricing.faq')}</h2>
        <div>
          {questions.map((question) => (
            <details key={question}>
              <summary>
                {t(`pricing.faq.${question}.question`)}
                <UiIcon name="chevron-down" className="size-4 shrink-0" />
              </summary>
              <p>{rich(`pricing.faq.${question}.answer`, {
                license: (text) => <LocalLink to="/docs#licensing">{text}</LocalLink>,
              })}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
