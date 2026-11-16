import { useState, type MouseEvent } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Inspector, SidePane, type InspectorProps } from '../components/Inspector';
import {
  Breadcrumbs, CodeTabs, CopyCode, Glyph, IconLinkGrid, KeywordTags, LandingSection, primaryButton, secondaryButton, useStyleVars,
} from '../components/LandingParts';
import { Segmented, UiIcon, useToast } from '../components/ui';
import { errorText } from '../i18n/errors';
import { LocalLink, useI18n } from '../i18n';
import { useArtwork } from '../lib/artwork';
import { catalog, iconsByName, STYLE_META, styleFromSlug, type StyleId } from '../lib/catalog';
import { copyText, downloadBlob, svgToPng } from '../lib/export';
import {
  categoryPath, displayName, editorPath, iconPath, relatedIcons, svgFilePath,
} from '../lib/icon-pages';
import { CONTAINER, usePaneHost } from '../lib/layout';
import { DEFAULT_LOOK, exportColors, type Look } from '../lib/look';
import { buildSvg } from '../lib/svg';
import { useMediaQuery } from '../lib/theme';
import { FIGMA_URL } from '../lib/links';
import { componentName } from '../lib/react-snippet';
import NotFoundPage from './NotFoundPage';

/**
 * A link to the editor on the home page that, on a plain click, opens the
 * editor beside this page instead. The link stays for crawlers, new tabs,
 * and visits without JavaScript.
 */
const openInPlace = (open: () => void) => (e: MouseEvent) => {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  open();
};

/** Sizes icons are usually set at, shown 1:1 so the drawing can be judged where it ships. */
const backLink = '-ml-2 mb-4 inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-muted transition hover:bg-sunken hover:text-ink';

const ACTUAL_SIZES = [
  { px: 16, className: 'size-4' },
  { px: 20, className: 'size-5' },
  { px: 24, className: 'size-6' },
  { px: 32, className: 'size-8' },
] as const;
/** Edge length of the PNG download: large enough for slides and docs, small enough to stay crisp-looking. */
const PNG_PIXELS = 256;

/** The icon in the chosen style: a large view, the style switcher, and the icon at real sizes. */
function PreviewStage({ name, style, svg, onStyleChange, onCopy }: {
  name: string;
  style: StyleId;
  svg: string | undefined;
  onStyleChange: (style: StyleId) => void;
  /** Copy the artwork on show; it sits with the preview, like a code block's Copy. */
  onCopy: () => void;
}) {
  const { t } = useI18n();
  const vars = useStyleVars(style);
  const title = displayName(name);
  return (
    <section aria-labelledby="icon-preview" className="flex flex-col rounded-2xl border border-line bg-surface" style={vars}>
      <h2 id="icon-preview" className="sr-only">{t('iconPage.styles')}</h2>
      <div className="flex items-center gap-2 p-3">
        <div className="min-w-0 flex-1">
          <Segmented
            fill
            label={t('icons.styleSwitcher')}
            value={style}
            options={catalog.styles.map((s) => ({ value: s, label: t(`style.${s}`) }))}
            onChange={onStyleChange}
          />
        </div>
        <button
          type="button"
          onClick={onCopy}
          disabled={!svg}
          title={t('iconPage.copySvg')}
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-muted transition hover:bg-sunken hover:text-ink disabled:opacity-50"
        >
          <UiIcon name="copy" className="size-4" />
          <span className="max-sm:sr-only">{t('iconPage.copySvg')}</span>
        </button>
      </div>
      <div className="flex min-h-56 flex-1 items-center justify-center px-6 py-10 sm:min-h-72">
        <Glyph svg={svg} idPrefix="stage-" className="size-28 sm:size-36" label={t('iconPage.preview', { name: title, style: t(`style.${style}`) })} />
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-line px-4 py-3">
        <span className="text-xs text-muted">{t('iconPage.actualSize')}</span>
        <ul className="flex items-end gap-5 sm:gap-7">
          {ACTUAL_SIZES.map(({ px, className }) => (
            <li key={px} className="flex flex-col items-center gap-1.5">
              <Glyph svg={svg} idPrefix={`a${px}-`} className={className} />
              <span className="text-[11px] tabular-nums text-faint">{px}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default function IconPage() {
  const { name = '' } = useParams();
  const icon = iconsByName.get(name);
  const i18n = useI18n();
  const { t, label, n, path } = i18n;
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  /** The icon list this page was opened from (the grid's Open icon page button), if any. */
  const from: unknown = (location.state as { from?: unknown } | null)?.from;
  const backTo = typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : null;
  /** The style shown in the preview, the actions, and the code below; ?style= keeps it in shared links. */
  const style = styleFromSlug(params.get('style')) ?? catalog.styles[0];
  const setStyle = (next: StyleId) => setParams((p) => {
    const q = new URLSearchParams(p);
    if (next === catalog.styles[0]) q.delete('style');
    else q.set('style', STYLE_META[next].slug);
    return q;
  }, { replace: true, preventScrollReset: true, state: location.state });
  const svg = useArtwork(style, icon ? [icon.name] : [])[name];
  const navigate = useNavigate();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const paneHost = usePaneHost();
  /** The style open in the editor beside the page; null when it is closed. It stays open across icon pages. */
  const [editing, setEditing] = useState<StyleId | null>(null);
  const [look, setLook] = useState<Look>(DEFAULT_LOOK);
  const [badge, setBadge] = useState<InspectorProps['badgeRequest']>(null);
  const editSvg = useArtwork(editing ?? catalog.styles[0], icon && editing ? [icon.name] : [])[name];
  if (!icon) return <NotFoundPage />;
  const openEditor = (style: StyleId) => { setBadge(null); setEditing(style); };
  const closeEditor = () => setEditing(null);

  const title = displayName(icon.name);
  const category = label('category', icon.category, icon.category);
  const categoryCount = catalog.categories.find((c) => c.name === icon.category)?.count ?? 0;
  const components = catalog.styles.map((s) => componentName(icon.name, s));
  const component = componentName(icon.name, style);
  const styleLabel = t(`style.${style}`);
  const fileBase = `${icon.name}-${STYLE_META[style].slug}`;
  const editorLink = `${editorPath(icon.name)}${style === catalog.styles[0] ? '' : `&style=${STYLE_META[style].slug}`}`;

  const copySvg = () => {
    if (!svg) return;
    copyText(svg).then(() => toast('success', t('iconPage.copied', { what: 'SVG' })), (e) => toast('error', errorText(e, i18n, 'error.copy')));
  };
  const downloadPng = () => {
    if (!svg) return;
    // Light-theme ink: a PNG usually lands on a white slide or doc, whatever theme the site is in.
    const file = buildSvg(svg, { ...exportColors(svg, style, DEFAULT_LOOK, 'light'), size: PNG_PIXELS });
    svgToPng(file, PNG_PIXELS).then(
      (png) => downloadBlob(png, `${fileBase}.png`),
      (e) => toast('error', errorText(e, i18n, 'error.png')),
    );
  };
  const related = relatedIcons(icon);

  const react = `import { ${component} } from '@fos-icons/react';\n\nexport function Example() {\n  return <${component} size={24} />;\n}`;
  const vue = `<script setup>\nimport { ${component} } from '@fos-icons/vue';\n</script>\n\n<template>\n  <${component} :size="24" />\n</template>`;

  return (
    <div className={`${CONTAINER} pb-24 pt-6 sm:pt-8`}>
      {backTo ? (
        <Link
          to={backTo}
          // Going back in history also restores the list's scroll position.
          onClick={openInPlace(() => navigate(-1))}
          className={backLink}
        >
          <UiIcon name="arrow-left" className="size-4" /> {t('iconPage.back')}
        </Link>
      ) : (
        <LocalLink to="/" className={backLink}>
          <UiIcon name="arrow-left" className="size-4" /> {t('iconPage.back')}
        </LocalLink>
      )}
      <Breadcrumbs
        items={[
          { label: t('iconPage.allIcons'), to: '/' },
          { label: category, to: categoryPath(icon.category) },
          { label: icon.name },
        ]}
      />

      {/* Phones read heading, preview, then actions; from lg the preview spans the right column. */}
      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:grid-rows-[auto_1fr] lg:gap-x-14 lg:gap-y-8">
        <div>
          <h1 className="text-balance font-display text-4xl font-semibold tracking-tight sm:text-5xl">{t('iconPage.heading', { name: title })}</h1>
          <p className="mt-4 max-w-xl text-pretty text-base text-muted sm:text-lg">
            {t('iconPage.intro', { name: title.toLowerCase() })}
          </p>
          <KeywordTags icon={icon} className="mt-4" />
        </div>

        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <PreviewStage name={icon.name} style={style} svg={svg} onStyleChange={setStyle} onCopy={copySvg} />
        </div>

        <div className="lg:col-start-1 lg:row-start-2">
          <div className="flex flex-wrap gap-2">
            <a href={svgFilePath(style, icon.name)} download={`${fileBase}.svg`} className={primaryButton}>
              <UiIcon name="download" className="size-4" /> {t('iconPage.download', { style: styleLabel })}
            </a>
            <button type="button" onClick={downloadPng} disabled={!svg} className={`${secondaryButton} disabled:opacity-50`}>
              {t('iconPage.downloadPng')}
            </button>
          </div>
          <LocalLink
            to={editorLink}
            onClick={openInPlace(() => openEditor(style))}
            className="mt-4 inline-flex items-center gap-1.5 rounded text-sm font-medium text-brand underline-offset-2 hover:underline"
          >
            <UiIcon name="palette" className="size-4" /> {t('iconPage.customize')}
          </LocalLink>

          <dl className="mt-8 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 border-t border-line pt-6 text-sm">
            <dt className="text-muted">{t('iconPage.category')}</dt>
            <dd><LocalLink to={categoryPath(icon.category)} className="text-brand underline-offset-2 hover:underline">{category}</LocalLink></dd>
            <dt className="text-muted">{t('iconPage.license')}</dt>
            <dd><LocalLink to="/docs#licensing" className="underline-offset-2 hover:underline">{t('iconPage.licenseValue', { license: catalog.license })}</LocalLink></dd>
          </dl>
        </div>
      </div>

      <div className="mt-14 space-y-12">
        <LandingSection id="use" narrow title={t('iconPage.use', { name: title.toLowerCase() })}>
          <CodeTabs
            label={t('iconPage.framework')}
            tabs={[
              { id: 'react', label: t('iconPage.react'), code: react, lang: 'tsx' },
              { id: 'vue', label: t('iconPage.vue'), code: vue, lang: 'vue' },
            ]}
          />
          <p className="mt-3 text-sm text-muted">
            {t('iconPage.componentNames')}{' '}
            {components.map((c, i) => <span key={c}>{i > 0 && ', '}<code className="rounded bg-sunken px-1 py-0.5 text-ink">{c}</code></span>)}
          </p>
          {svg && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-medium text-muted">SVG</h3>
              <CopyCode code={svg} lang="svg" what="SVG" wrap />
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

      {editing && (
        <SidePane
          desktop={desktop}
          host={paneHost}
          collapsed={false}
          onCollapsedChange={(collapsed) => { if (collapsed) closeEditor(); }}
          sheetOpen
          onDismiss={closeEditor}
          headingId="pane-heading"
          focusKey={`${icon.name}:${editing}`}
        >
          <Inspector
            key={icon.name}
            icon={icon}
            style={editing}
            styles={catalog.styles}
            source={editSvg}
            look={look}
            onLookChange={(patch) => setLook((l) => ({ ...l, ...patch }))}
            onStyleChange={setEditing}
            onSelectIcon={(next) => navigate(path(iconPath(next)))}
            onClose={closeEditor}
            headingId="pane-heading"
            badgeRequest={badge}
            onBadgeChange={setBadge}
          />
        </SidePane>
      )}
    </div>
  );
}
