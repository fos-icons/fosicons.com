import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Inspector, SidePane, type InspectorProps } from '../components/Inspector';
import {
  Breadcrumbs, CodeTabs, CopyCode, Glyph, IconLinkGrid, KeywordTags, LandingSection, useStyleVars,
} from '../components/LandingParts';
import { Button, ButtonAnchor, buttonClass, ButtonLink, Segmented, UiIcon, useToast } from '../components/ui';
import { errorText } from '../i18n/errors';
import { LocalLink, useI18n } from '../i18n';
import { useArtwork } from '../lib/artwork';
import { catalog, iconsByName, STYLE_META, styleFromSlug, type StyleId } from '../lib/catalog';
import { copyText, downloadBlob, svgToPng } from '../lib/export';
import {
  categoryPath, displayName, editorPath, iconPath, relatedIcons, svgFilePath,
} from '../lib/icon-pages';
import { CONTAINER, useHeaderSlot, usePaneHost } from '../lib/layout';
import { DEFAULT_LOOK, exportColors, type Look } from '../lib/look';
import { buildSvg } from '../lib/svg';
import { useMediaQuery } from '../lib/theme';
import { FIGMA_URL } from '../lib/links';
import { componentName } from '../lib/react-snippet';
import { useSlashToFocus } from './IconsPage';
import NotFoundPage from './NotFoundPage';
import { useModifiers } from '../components/ModifierPicker';
import { composeSvg, CORNERS, initialCorner, modifiersFor, type Corner } from '../lib/modifiers';
import { resolveModifier } from '../lib/phrase';
import { svgBlob } from '../lib/export';

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
/** Pulled left so its arrow lines up with the breadcrumbs below. */
const backLink = '-ml-2 mb-4 px-2';

/**
 * Icon pages visited this session, for the header search's back and forward
 * arrows. Opening an icon any other way drops what was ahead, like browser
 * history; the arrows only move along the trail.
 */
const trail: { names: string[]; at: number } = { names: [], at: -1 };
function visitIcon(name: string, viaTrail: boolean) {
  if (viaTrail) {
    const i = trail.names.lastIndexOf(name);
    if (i >= 0) { trail.at = i; return; }
  }
  if (trail.names[trail.at] === name) return;
  trail.names = [...trail.names.slice(0, trail.at + 1), name];
  trail.at = trail.names.length - 1;
}

/**
 * The header search on an icon page (desktop), styled like the docs search.
 * The current icon, and any modifier on it, sit in the field as removable
 * tags. Typing a modifier this icon supports ("add", "plus", "lock") offers to
 * put it on the icon; Enter does. Anything else searches the grid. Backspace in
 * the empty field removes the last tag: the modifier, then the icon, which goes
 * back to the icon list. Arrows step through the icons visited before.
 */
function HeaderIconSearch({
  name, modifiers, modifier, onModifier, onRemove, prev, next,
}: {
  name: string;
  /** Modifiers this icon can take. */
  modifiers: { name: string; label: string }[];
  /** The modifier on the icon, by library name. */
  modifier: string | null;
  onModifier: (name: string | null) => void;
  onRemove: () => void;
  prev: string | null;
  next: string | null;
}) {
  const { t, path, label } = useI18n();
  const navigate = useNavigate();
  const ref = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  useSlashToFocus(ref);
  const modLabel = (m: string) => label('modifier', m, modifiers.find((x) => x.name === m)?.label ?? m);
  const match = query.trim() ? resolveModifier(query.trim(), modifiers) : null;
  const suggestion = match && match !== modifier ? match : null;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    if (suggestion) { onModifier(suggestion); setQuery(''); return; }
    navigate(path(`/?${new URLSearchParams({ q })}`));
  };
  const step = (to: string | null) => to && navigate(path(iconPath(to)), { state: { trail: true } });
  const tag = 'inline-flex h-6 shrink-0 items-center gap-0.5 rounded-md bg-brand-soft pl-2 pr-0.5 text-xs font-medium text-brand';
  const tagX = 'inline-flex size-5 shrink-0 items-center justify-center rounded hover:bg-brand/10';
  return (
    <div className="flex w-full max-w-lg items-center gap-1">
      {/* < and >: the chevron turned to point back and forward. */}
      {([['prev', prev, 'rotate-90', t('iconPage.previousIcon')], ['next', next, '-rotate-90', t('iconPage.nextIcon')]] as const).map(([key, to, turn, text]) => (
        <button
          key={key}
          type="button"
          disabled={!to}
          onClick={() => step(to)}
          aria-label={to ? `${text}: ${to}` : text}
          title={to ? `${text}: ${to}` : text}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-ink transition hover:bg-sunken disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <UiIcon name="chevron-down" className={`size-4 ${turn}`} />
        </button>
      ))}
      <form role="search" onSubmit={submit} className="relative min-w-0 flex-1">
        <div className="flex h-9 w-full items-center gap-1.5 rounded-lg border border-line-strong bg-surface pl-3 pr-1.5 transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15">
          <UiIcon name="search" className="size-4 shrink-0 text-faint" />
          <span className={`${tag} max-w-[45%]`}>
            <span className="truncate">{name}</span>
            <button type="button" onClick={onRemove} aria-label={t('iconPage.removeIcon', { name })} title={t('iconPage.removeIcon', { name })} className={tagX}>
              <UiIcon name="x" className="size-3" />
            </button>
          </span>
          {modifier && (
            <span className="inline-flex h-6 shrink-0 items-center gap-0.5 rounded-md bg-modifier-soft pl-2 pr-0.5 text-xs font-medium text-modifier">
              <span className="truncate">{modLabel(modifier)}</span>
              <button type="button" onClick={() => onModifier(null)} aria-label={t('iconPage.removeModifier', { modifier: modLabel(modifier) })} className="inline-flex size-5 shrink-0 items-center justify-center rounded hover:bg-modifier/15">
                <UiIcon name="x" className="size-3" />
              </button>
            </span>
          )}
          <input
            ref={ref}
            type="search"
            aria-label={t('icons.searchIcons')}
            placeholder={modifier ? '' : t('iconPage.searchOther')}
            value={query}
            autoComplete="off"
            spellCheck={false}
            aria-describedby={suggestion ? 'icon-search-suggestion' : undefined}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !query) { e.preventDefault(); if (modifier) onModifier(null); else onRemove(); }
              if (e.key === 'Escape' && query) { e.preventDefault(); setQuery(''); }
            }}
            className="h-full min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:hidden"
          />
          {!query && <kbd aria-hidden="true" className="hidden shrink-0 rounded border border-line bg-sunken px-1.5 text-xs text-muted md:inline">/</kbd>}
        </div>
        {suggestion && (
          <button
            id="icon-search-suggestion"
            type="submit"
            className="absolute inset-x-0 top-full z-30 mt-1 flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-left text-sm text-ink shadow-lg hover:bg-sunken"
          >
            <UiIcon name="plus" className="size-4 text-modifier" />
            <span className="min-w-0 flex-1 truncate">{t('iconPage.addModifier', { modifier: modLabel(suggestion), name })}</span>
            <kbd aria-hidden="true" className="rounded border border-line bg-sunken px-1.5 text-xs text-muted">Enter</kbd>
          </button>
        )}
      </form>
    </div>
  );
}

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
        <Button variant="quiet" icon="copy" onClick={onCopy} disabled={!svg} title={t('iconPage.copySvg')} className="shrink-0 px-2.5">
          <span className="max-sm:sr-only">{t('iconPage.copySvg')}</span>
        </Button>
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
  /** The header search slot shows from md up, like the docs page. */
  const wide = useMediaQuery('(min-width: 768px)');
  const headerSlot = useHeaderSlot();
  const paneHost = usePaneHost();
  /** The style open in the editor beside the page; null when it is closed. It stays open across icon pages. */
  const [editing, setEditing] = useState<StyleId | null>(null);
  const [look, setLook] = useState<Look>(DEFAULT_LOOK);
  /** A modifier on the icon (?modifier=, ?corner=), from the header search or the editor; kept in shared links. */
  const modifierParam = params.get('modifier');
  const cornerParam = params.get('corner');
  const badge: InspectorProps['badgeRequest'] = modifierParam
    ? { name: modifierParam, corner: (CORNERS as readonly string[]).includes(cornerParam ?? '') ? cornerParam as Corner : null }
    : null;
  const setBadge = (choice: InspectorProps['badgeRequest']) => setParams((p) => {
    const q = new URLSearchParams(p);
    if (choice) q.set('modifier', choice.name); else q.delete('modifier');
    if (choice?.corner) q.set('corner', choice.corner); else q.delete('corner');
    return q;
  }, { replace: true, preventScrollReset: true, state: location.state });
  const canModify = !!icon && !icon.composition;
  const modifiers = useModifiers(canModify && (wide || !!badge));
  const available = useMemo(() => (icon && canModify && modifiers.list ? modifiersFor(icon.name, modifiers.list) : []), [icon, canModify, modifiers.list]);
  const applied = badge ? available.find((m) => m.name === badge.name) ?? null : null;
  /** The artwork the page shows, copies, and downloads: the icon, plus any modifier on it. */
  const shown = useMemo(() => {
    if (!svg || !applied) return svg;
    try {
      const corner = badge?.corner && applied.positions[badge.corner] ? badge.corner : initialCorner(applied);
      return composeSvg(svg, applied, corner, style);
    } catch {
      return svg;
    }
  }, [svg, applied, badge?.corner, style]);
  const viaTrail = !!(location.state as { trail?: boolean } | null)?.trail;
  useEffect(() => { if (icon) visitIcon(icon.name, viaTrail); }, [icon, viaTrail]);
  const editSvg = useArtwork(editing ?? catalog.styles[0], icon && editing ? [icon.name] : [])[name];
  if (!icon) return <NotFoundPage />;
  const openEditor = (style: StyleId) => setEditing(style);
  const trailAt = trail.names[trail.at] === icon.name ? trail.at : trail.names.lastIndexOf(icon.name);
  const prevIcon = trailAt > 0 ? trail.names[trailAt - 1] : null;
  const nextIcon = trailAt >= 0 && trailAt < trail.names.length - 1 ? trail.names[trailAt + 1] : null;
  const closeEditor = () => setEditing(null);

  const title = displayName(icon.name);
  const category = label('category', icon.category, icon.category);
  const categoryCount = catalog.categories.find((c) => c.name === icon.category)?.count ?? 0;
  const components = catalog.styles.map((s) => componentName(icon.name, s));
  const component = componentName(icon.name, style);
  const styleLabel = t(`style.${style}`);
  const fileBase = `${icon.name}${applied ? `-${applied.name}` : ''}-${STYLE_META[style].slug}`;
  const editorLink = `${editorPath(icon.name)}${style === catalog.styles[0] ? '' : `&style=${STYLE_META[style].slug}`}`;

  const copySvg = () => {
    if (!shown) return;
    copyText(shown).then(() => toast('success', t('iconPage.copied', { what: 'SVG' })), (e) => toast('error', errorText(e, i18n, 'error.copy')));
  };
  const downloadPng = () => {
    if (!shown) return;
    // Light-theme ink: a PNG usually lands on a white slide or doc, whatever theme the site is in.
    const file = buildSvg(shown, { ...exportColors(shown, style, DEFAULT_LOOK, 'light'), size: PNG_PIXELS });
    svgToPng(file, PNG_PIXELS).then(
      (png) => downloadBlob(png, `${fileBase}.png`),
      (e) => toast('error', errorText(e, i18n, 'error.png')),
    );
  };
  const related = relatedIcons(icon);

  const react = `import { ${component} } from '@fos-icons/react';\n\nexport function Example() {\n  return <${component} size={24} />;\n}`;
  const vue = `<script setup>\nimport { ${component} } from '@fos-icons/vue';\n</script>\n\n<template>\n  <${component} :size="24" />\n</template>`;

  // Removing the icon from the header search returns to the list it came from
  // (keeping that search and style, without the selection), or to all icons.
  const listWithoutIcon = (() => {
    if (!backTo) return null;
    const url = new URL(backTo, 'https://fosicons.com');
    for (const key of ['icon', 'modifier', 'corner']) url.searchParams.delete(key);
    return `${url.pathname}${url.search}`;
  })();
  const leave = () => (listWithoutIcon ? navigate(listWithoutIcon) : navigate(path('/')));
  const inHeader = headerSlot && wide;

  return (
    <div className={`${CONTAINER} pb-24 pt-6 sm:pt-8`}>
      {inHeader && createPortal(
        <HeaderIconSearch
          name={icon.name}
          modifiers={available}
          modifier={applied?.name ?? null}
          onModifier={(m) => setBadge(m ? { name: m, corner: null } : null)}
          onRemove={leave}
          prev={prevIcon}
          next={nextIcon}
        />,
        headerSlot,
      )}
      {/* Phones have no header search: a plain link back. */}
      <div className={inHeader ? 'hidden' : undefined}>
      {backTo ? (
        // A plain Link: backTo is already a full path. Going back in history also restores the list's scroll.
        <Link to={backTo} onClick={openInPlace(() => navigate(-1))} className={`${buttonClass({ variant: 'quiet', size: 'sm' })} ${backLink}`}>
          <UiIcon name="arrow-left" className="size-4" /> {t('iconPage.back')}
        </Link>
      ) : (
        <ButtonLink to="/" variant="quiet" size="sm" icon="arrow-left" className={backLink}>{t('iconPage.back')}</ButtonLink>
      )}
      </div>
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
          <PreviewStage name={icon.name} style={style} svg={shown} onStyleChange={setStyle} onCopy={copySvg} />
        </div>

        <div className="lg:col-start-1 lg:row-start-2">
          <div className="flex flex-wrap gap-2">
            {applied ? (
              // With a modifier, the file is composed here rather than the library's published one.
              <Button variant="primary" size="lg" icon="download" disabled={!shown} onClick={() => shown && downloadBlob(svgBlob(shown), `${fileBase}.svg`)}>
                {t('iconPage.download', { style: styleLabel })}
              </Button>
            ) : (
              <ButtonAnchor href={svgFilePath(style, icon.name)} download={`${fileBase}.svg`} variant="primary" size="lg" icon="download">
                {t('iconPage.download', { style: styleLabel })}
              </ButtonAnchor>
            )}
            <Button size="lg" onClick={downloadPng} disabled={!svg}>{t('iconPage.downloadPng')}</Button>
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
        <LandingSection id="use" narrow className="code-stone" title={t('iconPage.use', { name: title.toLowerCase() })}>
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
