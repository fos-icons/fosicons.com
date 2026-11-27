import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type MouseEvent, type ReactNode, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Inspector, type InspectorProps } from '../components/Inspector';
import {
  Breadcrumbs, CodeTabs, Glyph, IconLinkGrid, KeywordTags, LandingSection,
} from '../components/LandingParts';
import { Button, ButtonAnchor, buttonClass, ButtonLink, Segmented, SlashHint, UiIcon, useToast } from '../components/ui';
import { errorText } from '../i18n/errors';
import { LocalLink, useI18n } from '../i18n';
import { useSizedArtwork } from '../lib/artwork';
import { animatedNames, catalog, chunksFor, FREE_ICON_STYLE, iconsByName, loadAnimated, opticalSize, opticalStroke, relatedIcons, STYLE_META, styleFromSlug, type StyleId } from '../lib/catalog';
import { copyText, downloadBlob, svgToPng } from '../lib/export';
import {
  categoryPath, displayName, editorPath, iconPath, svgFilePath,
} from '../lib/icon-pages';
import { CONTAINER, useHeaderSlot } from '../lib/layout';
import { DEFAULT_LOOK, exportColors, gridVars, isCustomized, strokeAdjustable, strokeOf } from '../lib/look';
import { rememberIconStyle, useIconLook, useIconStyle } from '../lib/icon-preferences';
import { buildSvg, hasModifierRole, hasSecondaryRole, isDuo, prepareGridSvg } from '../lib/svg';
import { useMediaQuery, useTheme } from '../lib/theme';
import { FIGMA_URL } from '../lib/links';
import { angularSnippet, componentName, solidSnippet, svelteSnippet } from '../lib/react-snippet';
import { useSlashToFocus } from '../hooks/useSlashToFocus';
import NotFoundPage from './NotFoundPage';
import { UpgradePrompt } from '../components/UpgradePrompt';
import { usePlan } from '../lib/plan';
import { useModifiers } from '../components/ModifierPicker';
import { composeSvg, CORNERS, editablePreset, initialCorner, modifierPx, modifierScaleFor, modifiersFor, type Corner } from '../lib/modifiers';
import { resolveModifier } from '../lib/phrase';
import { svgBlob } from '../lib/export';
import { ANIMATED_SLUG } from '../lib/url-state';

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
  const tag = 'inline-flex h-6 shrink-0 items-center gap-0.5 rounded-md bg-tag-soft pl-2 pr-0.5 text-xs font-medium text-tag';
  const tagX = 'inline-flex size-5 shrink-0 items-center justify-center rounded hover:bg-tag/10';
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
            <span className="inline-flex h-6 min-w-0 max-w-[38%] shrink-0 items-center gap-0.5 rounded-md bg-modifier-soft pl-2 pr-0.5 text-xs font-medium text-modifier">
              <span className="truncate">{modLabel(modifier)}</span>
              <button type="button" onClick={() => onModifier(null)} aria-label={t('iconPage.removeModifier', { modifier: modLabel(modifier) })} className="inline-flex size-5 shrink-0 items-center justify-center rounded hover:bg-modifier/15">
                <UiIcon name="x" className="size-3" />
              </button>
            </span>
          )}
          <input
            ref={ref}
            type="search"
            name="q"
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
          {!query && <SlashHint className="max-md:hidden" />}
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

const ACTUAL_SIZES: readonly number[] = [16, 20, 24, 32, 48, 64];
const MAX_ACTUAL_SAMPLE = ACTUAL_SIZES[ACTUAL_SIZES.length - 1];
/** Fallback artwork size for the animated preview while the animation loads. */
const ANIMATED_PREVIEW_PIXELS = 144;
/**
 * The optical sizes the page draws from: each view uses the artwork drawn for
 * the size nearest its own, as the grid and downloads do. The canonical 24px
 * artwork comes first so it is available as a fallback.
 */
const PAGE_SIZES = [catalog.grid, ...catalog.sizes.filter((size) => size !== catalog.grid)];
const PAGE_LOOK = { ...DEFAULT_LOOK, size: catalog.grid };
const svgGrid = (svg?: string) => Number(svg?.match(/^\s*<svg\b[^>]*\bviewBox="0 0 (\d+) \1"/)?.[1] ?? 0);

type PreviewStyle = StyleId | typeof ANIMATED_SLUG;

function PreviewCanvas({ svg, label, stageRef, offscreen, children, color }: {
  svg?: string;
  label: string;
  stageRef?: Ref<HTMLDivElement>;
  offscreen?: boolean;
  children?: ReactNode;
  color?: string;
}) {
  const grid = svgGrid(svg);
  return (
    <div className="icon-preview-canvas relative isolate flex flex-1 flex-col rounded-t-2xl">
      {grid > 0 && (
        <div aria-hidden="true" data-preview-grid={grid}
          className="icon-preview-grid pointer-events-none absolute inset-0 -z-10 rounded-[inherit]"
          style={{ '--grid-units': grid } as CSSProperties} />
      )}
      <div ref={stageRef} data-offscreen={offscreen || undefined}
        className="relative flex min-h-56 flex-1 items-center justify-center px-6 py-10 sm:min-h-72">
        <Glyph svg={svg} idPrefix="stage-" className="icon-preview-glyph" label={label} style={{ color }} />
        {children}
      </div>
    </div>
  );
}

function ActualSizePreviews({ svgAt, listRef, offscreen, color, exportSize }: {
  svgAt: (px: number) => string | undefined;
  listRef?: React.Ref<HTMLUListElement>;
  offscreen?: boolean;
  color?: string;
  exportSize?: number;
}) {
  const { t } = useI18n();
  const sizes = exportSize !== undefined && exportSize <= MAX_ACTUAL_SAMPLE && !ACTUAL_SIZES.includes(exportSize)
    ? [...ACTUAL_SIZES, exportSize].sort((a, b) => a - b)
    : ACTUAL_SIZES;
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-t border-line px-4 py-3">
      <div className="shrink-0 text-xs text-muted">
        <p>{t('iconPage.actualSize')}</p>
        {exportSize !== undefined && (
          <p className="mt-1 font-medium text-ink">{t('iconPage.exportSize', { size: exportSize })}</p>
        )}
      </div>
      <ul ref={listRef} aria-label={t('iconPage.actualSize')} data-offscreen={offscreen || undefined}
        className="ml-auto flex max-w-full flex-wrap items-end justify-end gap-x-3 gap-y-2">
        {sizes.map((px) => (
          <li key={px} aria-current={px === exportSize ? 'true' : undefined} className="flex flex-col items-center gap-1.5">
            <Glyph svg={svgAt(px)} idPrefix={`a${px}-`} className="shrink-0" style={{ color, width: px, height: px }} />
            <span className={`rounded px-1 text-[11px] tabular-nums ${px === exportSize ? 'bg-brand-soft font-semibold text-brand' : 'text-faint'}`}>{px}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AnimatedPreview({ name, svgAt, label }: {
  name: string;
  svgAt: (px: number) => string | undefined;
  label: string;
}) {
  const i18n = useI18n();
  const { t } = i18n;
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const stage = useRef<HTMLDivElement>(null);
  const samples = useRef<HTMLUListElement>(null);
  const [stageVisible, setStageVisible] = useState(false);
  const [samplesVisible, setSamplesVisible] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [paused, setPaused] = useState(false);
  const [svg, setSvg] = useState<string>();
  const [error, setError] = useState<unknown>(null);
  const [attempt, retry] = useState(0);

  useEffect(() => {
    let active = true;
    loadAnimated().then((artwork) => {
      if (!active) return;
      if (artwork[name]) setSvg(artwork[name]);
      else setError(new Error('Missing animated artwork'));
    }, (cause: unknown) => { if (active) setError(cause); });
    return () => { active = false; };
  }, [name, attempt]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      setStageVisible(true);
      setSamplesVisible(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      for (const { target, isIntersecting } of entries) {
        if (target === stage.current) setStageVisible(isIntersecting);
        if (target === samples.current) setSamplesVisible(isIntersecting);
      }
    });
    if (stage.current) observer.observe(stage.current);
    if (samples.current) observer.observe(samples.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const update = () => setHidden(document.hidden);
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  // The main SVG's icon-scoped style also drives the smaller copies.
  const sampleSvg = svg?.replace(/<style>[\s\S]*?<\/style>/, '');
  return (
    <div className="animated-preview flex flex-1 flex-col" data-paused={paused || hidden || undefined}>
      <PreviewCanvas stageRef={stage} offscreen={!stageVisible} svg={svg ?? svgAt(ANIMATED_PREVIEW_PIXELS)} label={label}>
        {svg && !reducedMotion && (
          <Button size="sm" variant="quiet" className="absolute bottom-2 end-2" onClick={() => setPaused(!paused)}>
            {t(paused ? 'iconPage.playAnimation' : 'iconPage.pauseAnimation')}
          </Button>
        )}
        {error !== null && (
          <div className="absolute inset-x-3 bottom-2 flex items-center justify-center gap-2 text-sm text-muted">
            <span role="alert">{errorText(error, i18n, 'iconPage.animationUnavailable')}</span>
            <Button size="sm" variant="quiet" onClick={() => { setError(null); retry(attempt + 1); }}>{t('icons.tryAgain')}</Button>
          </div>
        )}
      </PreviewCanvas>
      <ActualSizePreviews svgAt={(px) => sampleSvg ?? svgAt(px)} listRef={samples} offscreen={!samplesVisible} />
    </div>
  );
}

/** The icon in the chosen style: a large view, the style switcher, and the icon at real sizes. */
function PreviewStage({ name, style, canAnimate, svgAt, onStyleChange, exportSize, vars, color }: {
  name: string;
  style: PreviewStyle;
  canAnimate: boolean;
  /** The icon drawn from the optical size nearest `px`. */
  svgAt: (px: number) => string | undefined;
  onStyleChange: (style: PreviewStyle) => void;
  exportSize: number;
  vars: CSSProperties;
  color?: string;
}) {
  const { t } = useI18n();
  const animated = style === ANIMATED_SLUG;
  const label = t('iconPage.preview', { name: displayName(name), style: t(`style.${style}`) });
  const options = catalog.styles.map((s) => ({ value: s as PreviewStyle, label: t(`style.${s}`), badge: s === FREE_ICON_STYLE ? t('icons.free') : undefined }));
  if (canAnimate) options.push({ value: ANIMATED_SLUG, label: t('style.animated'), badge: undefined });
  return (
    <section aria-labelledby="icon-preview" className="icon-preview-panel relative isolate flex flex-col rounded-2xl border border-line bg-surface" style={vars}>
      <h2 id="icon-preview" className="sr-only">{t('iconPage.styles')}</h2>
      <div className="icon-preview-toolbar absolute inset-x-0 top-0 z-10 flex items-center px-3">
        <div className="min-w-0 flex-1">
          <Segmented
            fill
            size={canAnimate ? 'sm' : 'md'}
            label={t('icons.styleSwitcher')}
            value={style}
            options={options}
            onChange={onStyleChange}
          />
        </div>
      </div>
      {animated ? <AnimatedPreview key={name} name={name} svgAt={svgAt} label={label} /> : (
        <>
          <PreviewCanvas svg={svgAt(exportSize)} label={label} color={color} />
          <ActualSizePreviews svgAt={svgAt} color={color} exportSize={exportSize} />
        </>
      )}
    </section>
  );
}

export default function IconPage() {
  const { name = '' } = useParams();
  const icon = iconsByName.get(name);
  const { can } = usePlan();
  /**
   * Modifiers are Advanced. Without it, a modifier in the link is ignored (the
   * page says how to get it), and a library icon that carries one opens as
   * itself rather than as its base plus an editable modifier.
   */
  const modifiersUnlocked = can('modifiers');
  const preset = modifiersUnlocked ? editablePreset(icon) : null;
  const inspected = preset?.base ?? icon;
  const i18n = useI18n();
  const { t, label, n, path } = i18n;
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  /** The icon list this page was opened from (the grid's Open icon page button), if any. */
  const previous = location.state as { from?: unknown; catalogBackTo?: unknown } | null;
  const from = previous?.from;
  const backTo = typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : null;
  const canAnimate = animatedNames.has(name);
  const animated = canAnimate && params.get('style') === ANIMATED_SLUG;
  const preferredStyle = useIconStyle();
  const styleParam = params.get('style');
  const style = styleFromSlug(styleParam) ?? (styleParam === null ? preferredStyle : catalog.styles[0]);
  const setStyle = (next: PreviewStyle) => {
    if (next !== ANIMATED_SLUG) rememberIconStyle(next);
    setParams((p) => {
      const q = new URLSearchParams(p);
      if (next === catalog.styles[0]) q.delete('style');
      else q.set('style', next === ANIMATED_SLUG ? next : STYLE_META[next].slug);
      if (next === ANIMATED_SLUG) { q.delete('modifier'); q.delete('corner'); }
      return q;
    }, { replace: true, preventScrollReset: true, state: location.state });
  };
  const sized = useSizedArtwork(style, inspected ? [inspected.name] : [], PAGE_SIZES, chunksFor);
  const svg = sized[0][inspected?.name ?? name];
  const navigate = useNavigate();
  /** The header search slot shows from md up, like the docs page. */
  const wide = useMediaQuery('(min-width: 768px)');
  const headerSlot = useHeaderSlot();
  const [look, changeLook] = useIconLook(PAGE_LOOK);
  const { resolved: theme } = useTheme();
  const [badgeAdjust, setBadgeAdjust] = useState(1);
  const badgeScale = modifierScaleFor(look.size, modifierPx(look.size, badgeAdjust));
  /** A modifier on the icon (?modifier=, ?corner=), from the header search or the editor; kept in shared links. */
  const modifierParam = params.get('modifier');
  const cornerParam = params.get('corner');
  const badge: InspectorProps['badgeRequest'] = modifierParam
    ? { name: modifierParam, corner: (CORNERS as readonly string[]).includes(cornerParam ?? '') ? cornerParam as Corner : null }
    : preset?.badge ?? null;
  const setBadge = (choice: InspectorProps['badgeRequest']) => {
    const next = new URLSearchParams(params);
    if (choice) next.set('modifier', choice.name); else next.delete('modifier');
    if (choice?.corner) next.set('corner', choice.corner); else next.delete('corner');
    if (preset) navigate({ pathname: path(iconPath(preset.base.name)), search: next.toString() });
    else setParams(next, { replace: true, preventScrollReset: true, state: location.state });
  };
  const canModify = !animated && !!inspected && !inspected.composition && modifiersUnlocked;
  const modifiers = useModifiers(canModify);
  const available = useMemo(() => (inspected && canModify && modifiers.list ? modifiersFor(inspected.name, modifiers.list) : []), [inspected, canModify, modifiers.list]);
  const applied = badge ? available.find((m) => m.name === badge.name) ?? null : null;
  /** The artwork the page shows, copies, and downloads: the icon, plus any modifier on it. */
  const iconName = inspected?.name ?? name;
  /** The same, at each optical size in PAGE_SIZES (24 first). */
  const shownBySize = useMemo(() => sized.map((svgs) => {
    const source = svgs[iconName];
    if (!source || !applied) return source;
    try {
      const corner = badge?.corner && applied.positions[badge.corner] ? badge.corner : initialCorner(applied);
      return composeSvg(source, applied, corner, style, badgeScale, true);
    } catch {
      return source;
    }
  }), [sized, iconName, applied, badge?.corner, style, badgeScale]);
  const shown = shownBySize[0];
  /** Drawn from the optical size nearest `px`; the 24px artwork until that size loads. */
  const shownAt = (px: number) => shownBySize[PAGE_SIZES.indexOf(opticalSize(px))] ?? shown;
  const viaTrail = !!(location.state as { trail?: boolean } | null)?.trail;
  useEffect(() => { if (icon) visitIcon(icon.name, viaTrail); }, [icon, viaTrail]);
  if (!icon) return <NotFoundPage />;
  const vars = gridVars(modifiersUnlocked ? look : { ...look, modifierColor: null }, animated ? FREE_ICON_STYLE : style, theme);
  const previewVars = { ...vars, '--stroke-scale': undefined };
  const previewAt = (px: number) => {
    const source = shownAt(px);
    if (!source || animated || !strokeAdjustable(style) || look.strokeWidth === null && px !== look.size) return source;
    return prepareGridSvg(source, String(strokeOf(look) / opticalStroke(svgGrid(source) || catalog.grid)));
  };
  const trailAt = trail.names[trail.at] === icon.name ? trail.at : trail.names.lastIndexOf(icon.name);
  const prevIcon = trailAt > 0 ? trail.names[trailAt - 1] : null;
  const nextIcon = trailAt >= 0 && trailAt < trail.names.length - 1 ? trail.names[trailAt + 1] : null;

  const title = displayName(icon.name);
  const category = label('category', icon.category, icon.category);
  const categoryCount = catalog.categories.find((c) => c.name === icon.category)?.count ?? 0;
  const components = catalog.styles.map((s) => componentName(icon.name, s));
  const component = componentName(icon.name, style);
  const styleLabel = t(`style.${style}`);
  const premium = style !== FREE_ICON_STYLE && !can('styles');
  const fileBase = `${icon.name}${applied ? `-${applied.name}` : ''}-${STYLE_META[style].slug}`;
  const custom = look.size !== PAGE_LOOK.size || isCustomized({ ...look, size: DEFAULT_LOOK.size });
  const needsDuoColors = shown && (isDuo(style) && hasModifierRole(shown) || style === 'duotone' && hasSecondaryRole(shown));
  const resolveSvg = custom || Boolean(applied) || Boolean(needsDuoColors);
  const build = (size: number) => {
    const source = shownAt(size);
    if (!source) return null;
    return buildSvg(source, {
      ...exportColors(source, style, look, custom ? theme : 'light', modifiersUnlocked ? look.modifierColor : null),
      size,
      strokeWidth: custom && strokeAdjustable(style) ? strokeOf(look) : undefined,
      sourceStroke: opticalStroke(svgGrid(source) || catalog.grid),
    });
  };
  const copySvg = () => {
    if (premium || !shown) return;
    const file = resolveSvg ? build(look.size) : shown;
    if (!file) return;
    copyText(file).then(() => toast('success', t('iconPage.copied', { what: 'SVG' })), (e) => toast('error', errorText(e, i18n, 'error.copy')));
  };
  const downloadPng = () => {
    if (premium) return;
    const size = look.size;
    const file = build(size);
    if (!file) return;
    svgToPng(file, size).then(
      (png) => downloadBlob(png, `${fileBase}.png`),
      (e) => toast('error', errorText(e, i18n, 'error.png')),
    );
  };
  const related = relatedIcons(icon);

  const react = `import { ${component} } from '@fos-icons/react';\n\nexport function Example() {\n  return <${component} size={24} />;\n}`;
  const vue = `<script setup>\nimport { ${component} } from '@fos-icons/vue';\n</script>\n\n<template>\n  <${component} :size="24" />\n</template>`;
  const svelte = svelteSnippet(icon.name, style, { size: 24, color: null });
  const image = `<img src="/icons/${icon.name}-animated.svg" width="24" height="24" alt=""`;
  const jsxExample = `export function Example() {\n  return ${image} />;\n}`;

  // Removing the icon from the header search returns to the list it came from
  // (keeping that search and style, without the selection), or to all icons.
  const listWithoutIcon = (() => {
    const browse = previous?.catalogBackTo;
    if (typeof browse === 'string' && browse.startsWith('/') && !browse.startsWith('//')) return browse;
    if (!backTo) return null;
    const url = new URL(backTo, 'https://fosicons.com');
    for (const key of ['icon', 'modifier', 'corner']) url.searchParams.delete(key);
    return `${url.pathname}${url.search}`;
  })();
  const leave = () => navigate(listWithoutIcon ?? path('/'), { state: { catalogEditor: true } });
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
      {/* Catalog visits have an explicit return link on every screen. */}
      <div className={inHeader && !backTo ? 'hidden' : undefined}>
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

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:grid-rows-[auto_1fr] lg:gap-x-14 lg:gap-y-6">
        <div>
          <h1 className="text-balance font-display text-3xl font-semibold tracking-tight sm:text-4xl">{t('iconPage.heading', { name: title })}</h1>
          <p className="mt-4 max-w-xl text-pretty text-base text-muted sm:text-lg">
            {t(canAnimate ? 'iconPage.introAnimated' : 'iconPage.intro', { name: title.toLowerCase() })}
          </p>
          <KeywordTags icon={icon} className="mt-4" />
        </div>

        <div className="min-w-0 lg:sticky lg:top-[calc(var(--site-header-height)+1rem)] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <PreviewStage name={icon.name} style={animated ? ANIMATED_SLUG : style} canAnimate={canAnimate} svgAt={previewAt} onStyleChange={setStyle} exportSize={look.size} vars={previewVars as CSSProperties} color={vars['--glyph-color']} />
          <div className="mt-4">
            {animated ? (
              <>
                <ButtonLink to={`${editorPath(icon.name)}&style=${ANIMATED_SLUG}`} variant="primary" size="lg" icon="palette">
                  {t('iconPage.customizeAnimation')}
                </ButtonLink>
                {!can('animated') && <UpgradePrompt feature="animated" fallback={t('export.premiumSoon')} className="mt-2 text-sm text-muted" />}
              </>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {premium || resolveSvg ? (
                    <Button variant="primary" size="lg" icon="download" disabled={premium || !shown} onClick={() => {
                      const file = premium ? null : build(look.size);
                      if (file) downloadBlob(svgBlob(file), `${fileBase}.svg`);
                    }}>
                      {t('iconPage.download', { style: styleLabel })}
                    </Button>
                  ) : (
                    <ButtonAnchor href={svgFilePath(style, icon.name)} download={`${fileBase}.svg`} variant="primary" size="lg" icon="download">
                      {t('iconPage.download', { style: styleLabel })}
                    </ButtonAnchor>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button size="lg" onClick={downloadPng} disabled={premium || !svg}>{t('iconPage.downloadPng')}</Button>
                    <Button size="lg" icon="copy" onClick={copySvg} disabled={premium || !shown}>{t('iconPage.copySvg')}</Button>
                  </div>
                </div>
                {premium && <UpgradePrompt feature="styles" fallback={t('export.premiumSoon')} className="mt-2 text-sm text-muted" />}
                {badge && !modifiersUnlocked && inspected?.composition && <UpgradePrompt feature="modifiers" className="mt-2 text-sm text-muted" />}
              </>
            )}
          </div>
        </div>

        {!animated && inspected && (
          <section aria-label={t('iconPage.customize')} className="@container lg:col-start-1 lg:row-start-2 [&>div>section]:px-0">
            <Inspector
              key={icon.name}
              inlineControls
              icon={inspected}
              style={style}
              styles={catalog.styles}
              source={sized[PAGE_SIZES.indexOf(opticalSize(look.size))][iconName] ?? svg}
              look={look}
              onLookChange={changeLook}
              onStyleChange={setStyle}
              onClose={leave}
              headingId="icon-customize"
              badgeRequest={badge}
              onBadgeChange={setBadge}
              modifierAdjustment={{ value: badgeAdjust, onChange: setBadgeAdjust }}
            />
          </section>
        )}
      </div>

      <div className="mt-14 space-y-12">
        <LandingSection id="use" narrow className="code-stone" title={t('iconPage.use', { name: title.toLowerCase() })}>
          <CodeTabs
            label={t('iconPage.framework')}
            tabs={[
              { id: 'react', label: t('iconPage.react'), code: animated ? jsxExample : react, lang: 'tsx' },
              { id: 'vue', label: t('iconPage.vue'), code: animated ? `<template>\n  ${image} />\n</template>` : vue, lang: 'vue' },
              { id: 'svelte', label: t('iconPage.svelte'), code: animated ? `${image} />` : svelte, lang: 'svelte' },
              { id: 'solid', label: t('iconPage.solid'), code: animated ? jsxExample : solidSnippet(icon.name, style, { size: 24, color: null }), lang: 'tsx' },
              { id: 'angular', label: t('iconPage.angular'), code: animated
                ? `import { Component } from '@angular/core';\n\n@Component({\n  selector: 'app-example',\n  template: \`${image}>\`,\n})\nexport class ExampleComponent {}`
                : angularSnippet(icon.name, style, { size: 24, color: null }), lang: 'ts' },
            ]}
          />
          {animated ? (
            <p className="mt-3 text-sm text-muted">{t('iconPage.animatedExample', { file: `${icon.name}-animated.svg` })}</p>
          ) : (
            <p className="mt-3 text-sm text-muted">
              {t('iconPage.componentNames')}{' '}
              {components.map((c, i) => <span key={c}>{i > 0 && ', '}<code className="rounded bg-sunken px-1 py-0.5 text-ink">{c}</code></span>)}
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="text-muted">{t('iconPage.figmaBody', { name: icon.name })}</span>
            {FIGMA_URL && (
              <a href={FIGMA_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand underline-offset-2 hover:underline">
                {t('iconPage.openFigma')} <UiIcon name="link-external" className="size-3.5" />
                <span className="sr-only">{t('site.newTab')}</span>
              </a>
            )}
            <LocalLink to="/docs#flutter" className="text-brand underline-offset-2 hover:underline">{t('iconPage.flutterDocs')}</LocalLink>
            <LocalLink to="/docs" className="text-brand underline-offset-2 hover:underline">{t('iconPage.docs')}</LocalLink>
          </div>
        </LandingSection>

        {related.length > 0 && (
          <LandingSection id="related" narrow title={t('iconPage.related', { category: category.toLowerCase() })}>
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
