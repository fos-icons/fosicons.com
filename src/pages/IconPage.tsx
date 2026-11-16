import { useParams } from 'react-router-dom';
import {
  Breadcrumbs, CopyCode, Glyph, IconLinkGrid, LandingSection, primaryButton, secondaryButton, useStyleVars,
} from '../components/LandingParts';
import { UiIcon } from '../components/ui';
import { LocalLink, useI18n } from '../i18n';
import { useArtwork } from '../lib/artwork';
import { catalog, iconsByName, type StyleId } from '../lib/catalog';
import {
  categoryPath, displayAliases, displayName, editorPath, relatedIcons, svgFilePath,
} from '../lib/icon-pages';
import { CONTAINER } from '../lib/layout';
import { FIGMA_URL } from '../lib/links';
import { componentName } from '../lib/react-snippet';
import NotFoundPage from './NotFoundPage';

function StylePreview({ name, style }: { name: string; style: StyleId }) {
  const { t } = useI18n();
  const svg = useArtwork(style, [name])[name];
  const vars = useStyleVars(style);
  const styleLabel = t(`style.${style}`);
  return (
    <li className="flex flex-col rounded-2xl border border-line bg-surface" style={vars}>
      <LocalLink
        to={`${editorPath(name)}${style === catalog.styles[0] ? '' : `&style=${style === 'filled' ? 'solid' : style}`}`}
        className="flex flex-1 items-center justify-center rounded-t-2xl px-6 py-8 transition hover:bg-sunken"
      >
        <Glyph svg={svg} idPrefix={`p-${style}-`} className="size-20 sm:size-24" label={t('iconPage.preview', { name: displayName(name), style: styleLabel })} />
      </LocalLink>
      <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2">
        <span className="text-sm font-medium">{styleLabel}</span>
        <a
          href={svgFilePath(style, name)}
          download={`${name}-${style}.svg`}
          className="inline-flex size-8 items-center justify-center rounded-lg text-muted transition hover:bg-sunken hover:text-ink"
          aria-label={t('iconPage.download', { style: styleLabel })}
          title={t('iconPage.download', { style: styleLabel })}
        >
          <UiIcon name="download" className="size-4" />
        </a>
      </div>
    </li>
  );
}

export default function IconPage() {
  const { name = '' } = useParams();
  const icon = iconsByName.get(name);
  const { t, label, list, n } = useI18n();
  const svg = useArtwork(catalog.styles[0], icon ? [icon.name] : [])[name];
  if (!icon) return <NotFoundPage />;

  const title = displayName(icon.name);
  const category = label('category', icon.category, icon.category);
  const categoryCount = catalog.categories.find((c) => c.name === icon.category)?.count ?? 0;
  const styles = list(catalog.styles.map((s) => t(`style.${s}`)));
  const components = catalog.styles.map((s) => componentName(icon.name, s));
  const [component] = components;
  const related = relatedIcons(icon);
  const aliases = displayAliases(icon);

  const react = `import { ${component} } from '@fos-icons/react';\n\nexport function Example() {\n  return <${component} size={24} />;\n}`;
  const vue = `<script setup>\nimport { ${component} } from '@fos-icons/vue';\n</script>\n\n<template>\n  <${component} :size="24" />\n</template>`;

  return (
    <div className={`${CONTAINER} pb-24 pt-8 sm:pt-10`}>
      <Breadcrumbs
        items={[
          { label: t('iconPage.allIcons'), to: '/' },
          { label: category, to: categoryPath(icon.category) },
          { label: icon.name },
        ]}
      />

      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-14">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">{t('iconPage.heading', { name: title })}</h1>
          <p className="mt-4 max-w-xl text-base text-muted sm:text-lg">
            {t('iconPage.intro', { name: title.toLowerCase(), styles, license: catalog.license })}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <LocalLink to={editorPath(icon.name)} className={primaryButton}>
              <UiIcon name="palette" className="size-4" /> {t('iconPage.customize')}
            </LocalLink>
            <a href={svgFilePath(catalog.styles[0], icon.name)} download={`${icon.name}.svg`} className={secondaryButton}>
              <UiIcon name="download" className="size-4" /> {t('iconPage.download', { style: t(`style.${catalog.styles[0]}`) })}
            </a>
          </div>

          <dl className="mt-8 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
            <dt className="text-muted">{t('iconPage.category')}</dt>
            <dd><LocalLink to={categoryPath(icon.category)} className="text-brand underline-offset-2 hover:underline">{category}</LocalLink></dd>
            {icon.tags.length > 0 && (<>
              <dt className="text-muted">{t('iconPage.tags')}</dt>
              <dd>{list(icon.tags)}</dd>
            </>)}
            {aliases.length > 0 && (<>
              <dt className="text-muted">{t('iconPage.aliases')}</dt>
              <dd>{list(aliases)}</dd>
            </>)}
            <dt className="text-muted">{t('iconPage.license')}</dt>
            <dd><LocalLink to="/docs#licensing" className="underline-offset-2 hover:underline">{t('iconPage.licenseValue', { license: catalog.license })}</LocalLink></dd>
          </dl>
        </div>

        <section aria-labelledby="icon-styles">
          <h2 id="icon-styles" className="sr-only">{t('iconPage.styles')}</h2>
          <ul className="grid grid-cols-2 gap-3">
            {catalog.styles.map((style) => <StylePreview key={style} name={icon.name} style={style} />)}
          </ul>
        </section>
      </div>

      <div className="mt-14 space-y-12">
        <LandingSection id="use" title={t('iconPage.use', { name: title.toLowerCase() })}>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-medium text-muted">{t('iconPage.react')}</h3>
              <CopyCode code={react} lang="tsx" what={t('iconPage.react')} />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium text-muted">{t('iconPage.vue')}</h3>
              <CopyCode code={vue} lang="vue" what={t('iconPage.vue')} />
            </div>
          </div>
          <p className="mt-4 text-sm text-muted">
            {t('iconPage.componentNames')}{' '}
            {components.map((c, i) => <span key={c}>{i > 0 && ', '}<code className="rounded bg-sunken px-1 py-0.5 text-ink">{c}</code></span>)}
          </p>
          {svg && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-medium text-muted">SVG</h3>
              <CopyCode code={svg} lang="svg" what="SVG" />
            </div>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="text-muted">{t('iconPage.figmaBody', { name: icon.name })}</span>
            {FIGMA_URL && (
              <a href={FIGMA_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand underline-offset-2 hover:underline">
                {t('iconPage.openFigma')} <UiIcon name="link-external" className="size-3.5" />
                <span className="sr-only">{t('site.newTab')}</span>
              </a>
            )}
            <LocalLink to="/docs" className="text-brand underline-offset-2 hover:underline">{t('iconPage.docs')}</LocalLink>
          </div>
        </LandingSection>

        {related.length > 0 && (
          <LandingSection id="related" title={t('iconPage.related', { category: category.toLowerCase() })}>
            <IconLinkGrid icons={related} />
            <p className="mt-4 text-sm">
              <LocalLink to={categoryPath(icon.category)} className="text-brand underline-offset-2 hover:underline">
                {t('iconPage.allInCategory', { count: n(categoryCount), category: category.toLowerCase() })}
              </LocalLink>
            </p>
          </LandingSection>
        )}
      </div>
    </div>
  );
}
