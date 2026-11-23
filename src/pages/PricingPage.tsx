import { useId } from 'react';
import { Glyph } from '../components/LandingParts';
import { ButtonLink, UiIcon } from '../components/ui';
import { LocalLink, useI18n } from '../i18n';
import { useSizedArtwork } from '../lib/artwork';
import type { StyleId } from '../lib/catalog';
import { CONTAINER } from '../lib/layout';

const plans = [
  { id: 'free', price: 0, standardPrice: null, highlights: ['regular', 'find', 'customize', 'singleExport'] },
  { id: 'pro', price: 49, standardPrice: 69, highlights: ['styles', 'duoColors', 'zip', 'agents'] },
  { id: 'advanced', price: 99, standardPrice: 129, highlights: ['modifiers', 'placement', 'modifierExports', 'modifierAgents'] },
] as const;

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
  { id: 'agents', minimum: 'pro', features: ['agentLookup', 'agentSnippets'] },
  { id: 'agents', minimum: 'advanced', features: ['modifierAgents'] },
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

export default function PricingPage() {
  const { n, t, rich } = useI18n();
  const currency = (amount: number) => n(amount, {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0, minimumFractionDigits: 0,
  });

  return (
    <div className={`${CONTAINER} pricing`}>
      <header className="pricing-intro">
        <h1 id="pricing-title">{t('pricing.title')}</h1>
        <p>{t('pricing.intro')}</p>
      </header>

      <section className="pricing-board" aria-labelledby="pricing-title">
        <div className="pricing-board-head">
          <div className="pricing-lede">
            <h2 id="pricing-compare">{t('pricing.compare')}</h2>
            <p>{t('pricing.compareIntro')}</p>
            <p className="pricing-launch">{t('pricing.launch')}</p>
          </div>

          {plans.map(({ id, price, standardPrice, highlights }) => (
            <article key={id} className={`pricing-plan pricing-plan--${id}`} aria-labelledby={`pricing-${id}`}>
              <div className="pricing-plan-name">
                <PlanArtwork plan={id} />
                <h3 id={`pricing-${id}`}>{t(`pricing.plan.${id}`)}</h3>
              </div>
              <p className="pricing-price">
                <span className="pricing-price-amount">
                  <strong>{currency(price)}</strong>
                  {standardPrice !== null && <del aria-hidden="true">{currency(standardPrice)}</del>}
                </span>
                <span className="pricing-price-term">{t(price ? 'pricing.perYear' : 'pricing.noCharge')}</span>
                {standardPrice !== null && (
                  <span className="sr-only">{t('pricing.standardAnnualPrice', { price: currency(standardPrice) })}</span>
                )}
              </p>
              <p className="pricing-summary">{t(`pricing.summary.${id}`)}</p>
              <div className="pricing-action">
                {price ? (
                  <span className="pricing-status"><span aria-hidden="true" />{t('pricing.comingSoon')}</span>
                ) : (
                  <ButtonLink to="/?style=regular" variant="primary" size="lg" iconEnd="arrow-right">{t('pricing.browse')}</ButtonLink>
                )}
              </div>
              <ul className="pricing-highlights">
                {highlights.map((feature) => (
                  <li key={feature}>
                    <UiIcon name="check" className="size-4 shrink-0" />
                    <span>{t(`pricing.highlight.${feature}`)}</span>
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
                          <UiIcon name={included ? 'check' : 'minus'} className="size-4" />
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
