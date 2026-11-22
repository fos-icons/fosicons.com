import { LocalLink, useI18n } from '../i18n';
import { copyText, downloadBlob, svgBlob } from '../lib/export';
import { TeachingTip } from './TeachingTip';
import { RailActions, RailContext } from './QuickTools';
import { iconPath } from '../lib/icon-pages';
import { errorText, LocalizedError } from '../i18n/errors';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import {
  catalog, modifierFamily, opticalStroke, STYLE_META, type IconEntry, type StyleId,
} from '../lib/catalog';
import { angularSnippet, reactSnippet, solidSnippet, svelteSnippet, vueSnippet, type SnippetOptions } from '../lib/react-snippet';
import { artworkSize, resolveLook, strokeAdjustable, strokeOf, type Look } from '../lib/look';
import { BASE_STROKE, buildSvg, hasModifierRole, hasSecondaryRole, isDuo } from '../lib/svg';
import { PANE_WIDTH, usePaneWidth } from '../lib/pane-width';
import { useMediaQuery, useTheme } from '../lib/theme';
import { CodeTabs, KeywordTags } from './LandingParts';
import { ExportPanel } from './ExportPanel';
import { ModifierPicker, useModifiers, type ModifierChoice } from './ModifierPicker';
import {
  authoredModifierPx, autoModifierPx, composeSvg, initialCorner, modifierPx, modifierPxRange, modifierScaleFor, modifiersFor, type Corner,
} from '../lib/modifiers';
import { ColorField, CustomizeControls, Section, SizeControl, StrokeControl } from './Customize';
import { IconButton, RangeSlider, Segmented, UiIcon, useToast } from './ui';



export interface InspectorProps {
  icon: IconEntry;
  style: StyleId;
  styles: readonly StyleId[];
  source: string | undefined;
  look: Look;
  onLookChange: (patch: Partial<Look>) => void;
  onStyleChange: (style: StyleId) => void;
  onClose: () => void;
  /** Brand assets: no React package, no duo controls, no stroke control. */
  kind?: 'core' | 'brand';
  headingId: string;
  /** The modifier being tried (from the URL), by library name; its corner, or null for the default. */
  badgeRequest?: { name: string; corner: Corner | null } | null;
  /** Called when the user picks or clears a modifier, or moves it. */
  onBadgeChange?: (choice: { name: string; corner: Corner } | null) => void;
}


/** Largest size the panel's square preview draws at 1:1; bigger sizes are shown at this size. */
const THUMB_MAX = 64;

export function Inspector({
  icon, style, styles, source: librarySource, look, onLookChange, onStyleChange, onClose, kind = 'core', headingId,
  badgeRequest = null, onBadgeChange,
}: InspectorProps) {
  const toast = useToast();
  const i18n = useI18n();
  const { t, rich, label, path } = i18n;
  const { resolved: theme } = useTheme();
  const duo = isDuo(style);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const r = resolveLook(look, theme);
  const size = look.size;
  const desktop = useMediaQuery('(min-width: 1024px)');
  const thumbSize = Math.min(size, THUMB_MAX);
  const strokeWidth = strokeAdjustable(style, kind) ? strokeOf(look) : undefined;
  /** `source` is drawn from the optical size nearest `size`: its own stroke is the reference. */
  const sourceStroke = opticalStroke(artworkSize(look));

  /** Chosen modifier (badge) color, kept with the rest of the look so it carries across icons. */
  const modifier = look.modifierColor;
  const canTryModifiers = kind === 'core' && !icon.composition;
  const modifiers = useModifiers(canTryModifiers && !!librarySource);
  const available = useMemo(() => modifiers.list ? modifiersFor(icon.name, modifiers.list) : [], [icon.name, modifiers.list]);
  const badge = useMemo<ModifierChoice | null>(() => {
    if (!badgeRequest) return null;
    const modifier = available.find((m) => m.name === badgeRequest.name);
    if (!modifier) return null;
    const { corner } = badgeRequest;
    return { modifier, corner: corner && modifier.positions[corner] ? corner : initialCorner(modifier) };
  }, [available, badgeRequest]);
  const setBadge = (choice: ModifierChoice | null) => {
    onBadgeChange?.(choice && { name: choice.modifier.name, corner: choice.corner });
  };
  /**
   * Badge size follows the icon size (20px at 48px, 11px at 24px; see
   * `autoModifierPx`). The slider adjusts it in whole px; the adjustment is kept
   * as a ratio of the linked size (1 = linked), so it carries across icon sizes
   * and modifiers.
   */
  const [badgeAdjust, setBadgeAdjust] = useState(1);
  const linkedBadgePx = autoModifierPx(size);
  const badgeRange = modifierPxRange(size);
  const badgeSize = modifierPx(size, badgeAdjust);
  const badgeScale = modifierScaleFor(size, badgeSize);
  const pxText = (value: number) => t('customize.pxValue', { value });
  const composed = useMemo(() => {
    if (!badge || !librarySource) return { svg: librarySource, error: null };
    try {
      // modifierRole: the badge gets its own color role in every style, so it can be recolored.
      return { svg: composeSvg(librarySource, badge.modifier, badge.corner, style, badgeScale, true), error: null };
    } catch (e) {
      return { svg: librarySource, error: errorText(e, i18n, 'error.compose') };
    }
  }, [badge, librarySource, style, badgeScale, i18n]);
  /** The artwork every preview and export uses: the library icon, plus any modifier being tried. */
  const source = composed.svg;
  const [busy, setBusy] = useState(false);
  const codeTrigger = useRef<HTMLButtonElement>(null);

  const showSecondary = !!source && duo && hasSecondaryRole(source);
  const modifierDefault = source?.match(/var\(--fos-modifier,\s*(#[0-9a-fA-F]{3,8})\)/)?.[1]?.toUpperCase() ?? null;
  const showModifier = !!source && hasModifierRole(source);

  const colors = useMemo(() => ({
    primary: duo ? r.duo.primary : r.mono,
    secondary: showSecondary ? r.duo.secondary : undefined,
    modifier: showModifier ? (modifier ?? modifierDefault ?? undefined) : undefined,
  }), [duo, r.duo.primary, r.duo.secondary, r.mono, showSecondary, showModifier, modifier, modifierDefault]);

  const build = (px: number, idPrefix?: string) => {
    if (!source) throw new LocalizedError('error.loadingArtwork');
    return buildSvg(source, { ...colors, size: px, idPrefix, strokeWidth, sourceStroke });
  };

  const preview = useMemo(() => {
    if (!source) return null;
    try {
      return {
        actual: buildSvg(source, { ...colors, size: thumbSize, idPrefix: `${uid}-a`, strokeWidth, sourceStroke }),
      };
    } catch {
      return null;
    }
  }, [source, colors, thumbSize, uid, strokeWidth, sourceStroke]);

  const slug = STYLE_META[style].slug;
  const baseName = badge ? `${icon.name}-${badge.modifier.name}-${badge.corner}-${slug}` : `${icon.name}-${slug}`;
  const family = kind === 'core' ? modifierFamily(icon.name) : null;
  /** Modifiers the library authored on this base, by corner (single-modifier compositions). */
  const authored = useMemo(() => {
    const map = new Map<string, Set<Corner>>();
    const names = new Map<string, string>();
    for (const v of family?.variants ?? []) {
      const mods = v.composition!.modifiers;
      if (mods.length !== 1) continue;
      if (!map.has(mods[0].name)) map.set(mods[0].name, new Set());
      map.get(mods[0].name)!.add(mods[0].position as Corner);
      names.set(`${mods[0].name}:${mods[0].position}`, v.name);
    }
    return { map, names };
  }, [family]);
  const authoredMatch = badge ? authored.names.get(`${badge.modifier.name}:${badge.corner}`) : undefined;

  const run = async (action: () => Promise<void> | void, success: string) => {
    setBusy(true);
    try {
      await action();
      toast('success', success);
    } catch (error) {
      toast('error', errorText(error, i18n));
    } finally {
      setBusy(false);
    }
  };

  // Code examples. The packages ship one component per library icon, so a
  // modifier at a corner (and size) the library authored uses that icon's
  // component; any other combination falls back to the plain icon.
  // The packaged components draw the badge as authored, so they only match the
  // preview when the modifier size is exactly that.
  const packagedSize = Math.abs(badgeSize - authoredModifierPx(size)) < 1e-9;
  const packaged = badge && authoredMatch && packagedSize ? authoredMatch : null;
  const plainFallback = !!badge && !packaged;
  const snippetOptions: SnippetOptions = {
    size,
    // Regular/Solid: name a color only when it isn't simply the site's ink.
    color: duo || r.monoFollowsSite ? null : r.mono,
    primary: duo ? colors.primary : undefined,
    secondary: colors.secondary,
    modifier: showModifier && modifier ? modifier : undefined,
  };
  const snippetName = packaged ?? icon.name;
  /**
   * The packages ship the 24px design only, scaled to `size` with its 1.25px
   * (24px grid) stroke. Say how that differs from what the SVG download draws,
   * in real pixels at this size. Filled artwork at every size is the 24px
   * design scaled, so only stroked styles can differ.
   */
  const codeNote = (() => {
    if (strokeWidth === undefined) return null;
    const px = (gridUnits: number) => pxText(Math.round(((gridUnits * size) / catalog.grid) * 100) / 100);
    const artwork = artworkSize(look);
    const sameStroke = Math.abs(strokeWidth - BASE_STROKE) < 1e-6;
    const values = { size: pxText(size), artwork: pxText(artwork), packageStroke: px(BASE_STROKE), stroke: px(strokeWidth) };
    if (artwork !== catalog.grid) return t(sameStroke ? 'inspector.codeArtworkSameStroke' : 'inspector.codeArtwork', values);
    return sameStroke ? null : t('inspector.codeStroke', values);
  })();
  const snippets = kind === 'core'
    ? {
      react: reactSnippet(snippetName, style, snippetOptions),
      vue: vueSnippet(snippetName, style, snippetOptions),
      svelte: svelteSnippet(snippetName, style, snippetOptions),
      solid: solidSnippet(snippetName, style, snippetOptions),
      angular: angularSnippet(snippetName, style, snippetOptions),
    }
    : null;

  return (
    <div className="flex min-h-full flex-col">
      {/*
        The preview and icon name stay pinned while the controls scroll.
        The 72px square draws the icon at actual size up to THUMB_MAX.
      */}
      <div className="sticky top-0 z-10 flex items-center gap-3 bg-surface px-5 py-4 [dialog_&]:top-4">
        <figure className="group checkerboard relative flex size-18 shrink-0 items-center justify-center rounded-xl border border-line">
          {preview ? (
            <span
              role="img"
              aria-label={t('inspector.preview', { name: icon.name, style: t(`style.${style}`), size: thumbSize })}
              data-artwork
              className="glyph"
              style={{ width: thumbSize, height: thumbSize }}
              dangerouslySetInnerHTML={{ __html: preview.actual }}
            />
          ) : (
            <span className="size-8 animate-pulse rounded-lg bg-sunken" />
          )}
          {/* On hover, says what the preview shows. */}
          <figcaption
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-full z-20 mt-1.5 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] font-medium tabular-nums text-canvas opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100"
          >
            {size > THUMB_MAX ? t('inspector.shownAt', { size, max: THUMB_MAX }) : t('inspector.actualSize', { size })}
          </figcaption>
        </figure>
        <div className="min-w-0 flex-1">
          <h2 id={headingId} tabIndex={-1} className="truncate text-xl font-semibold outline-none">{icon.name}</h2>
          <p className="mt-0.5 truncate text-sm text-muted">
            {label('category', icon.category, icon.category)}
            {kind === 'core' && <> · <LocalLink to={iconPath(icon.name)} replace={false} className="text-brand underline-offset-2 hover:underline">{t('inspector.iconPage')}</LocalLink></>}
          </p>
        </div>
        <IconButton icon="x" label={t('inspector.clear')} onClick={onClose} className="-mr-2 self-start" />
      </div>
      {kind === 'core' && <KeywordTags icon={icon} size="sm" className="px-5 pb-4" />}

      <SizeControl look={look} onChange={onLookChange} />
      {/* Stroke sits with size: Auto stroke follows the size, so the two are adjusted together. */}
      <StrokeControl
        look={look}
        onChange={onLookChange}
        style={style}
        kind={kind}
      />

      {kind === 'core' && (
        <Section title={t('inspector.modifier')}>
          {!canTryModifiers ? null : modifiers.error ? (
            <p className="text-sm text-danger">{modifiers.error}</p>
          ) : !modifiers.list ? (
            <div className="h-24 animate-pulse rounded-xl bg-sunken" />
          ) : (
            <>
              <ModifierPicker
                modifiers={available}
                value={badge}
                onChange={setBadge}
                authored={authored.map}
                accessory={showModifier && (
                  // Compact modifier color beside None: a swatch, plus a reset once a color is picked.
                  <span className="flex items-center gap-1">
                    <input
                      type="color"
                      aria-label={t('inspector.modifierColor')}
                      title={modifier ? t('inspector.modifierColor') : modifierDefault ? t('inspector.libraryDefault', { color: modifierDefault }) : t('inspector.modifierSameAsIcon')}
                      value={(modifier ?? modifierDefault ?? colors.primary).length === 7 ? (modifier ?? modifierDefault ?? colors.primary) : '#000000'}
                      onChange={(e) => onLookChange({ modifierColor: e.target.value.toUpperCase() })}
                      className="squircle size-8 shrink-0 cursor-pointer border border-line-strong bg-surface p-1 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
                    />
                    {modifier && (
                      <IconButton icon="undo" label={t('inspector.modifierColorReset')} onClick={() => onLookChange({ modifierColor: null })} className="size-8 text-muted" />
                    )}
                  </span>
                )}
              />
              <TeachingTip tip="modifier" />
              {badge && (
                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted">{t('inspector.modifierSize')}</span>
                    <span className="flex items-center gap-2">
                      {badgeAdjust !== 1 && (
                        <button type="button" onClick={() => setBadgeAdjust(1)} className="font-medium text-brand hover:underline">
                          {t('inspector.modifierSizeReset')}
                        </button>
                      )}
                      <span className="font-mono tabular-nums text-ink">{pxText(badgeSize)}</span>
                    </span>
                  </div>
                  <RangeSlider
                    id={`${uid}-badge-size`}
                    label={t('inspector.modifierSize')}
                    min={badgeRange.min}
                    max={badgeRange.max}
                    step={1}
                    value={badgeSize}
                    valueText={t('inspector.modifierSizeValue', { size: pxText(badgeSize), icon: pxText(size) })}
                    onChange={(px) => setBadgeAdjust(px === linkedBadgePx ? 1 : px / linkedBadgePx)}
                    marks={[...new Set([badgeRange.min, linkedBadgePx, badgeRange.max])]}
                    format={pxText}
                  />
                </div>
              )}
              {composed.error && <p role="status" className="mt-3 text-xs text-danger">{composed.error}</p>}
            </>
          )}
          {/* Library icons that already carry a modifier have no picker: a full color field instead. */}
          {showModifier && (!modifiers.list || !badge) && (
            <div className="mt-4">
              <ColorField
                label={t('inspector.modifierColor')}
                value={modifier ?? modifierDefault ?? colors.primary}
                onChange={(v) => onLookChange({ modifierColor: v })}
                hint={modifier ? undefined : modifierDefault ? t('inspector.libraryDefault', { color: modifierDefault }) : t('inspector.modifierSameAsIcon')}
              />
              {modifier && (
                <button type="button" onClick={() => onLookChange({ modifierColor: null })} className="mt-1 text-xs font-medium text-brand hover:underline">
                  {t('inspector.modifierColorReset')}
                </button>
              )}
            </div>
          )}
        </Section>
      )}

      {/* On desktop the grid's own style switcher sits beside the pane; the phone sheet covers it. */}
      {!desktop && (
        <Section title={t('inspector.style')}>
          <Segmented
            label={t('icons.styleSwitcher')}
            size="sm"
            value={style}
            onChange={onStyleChange}
            options={styles.map((s) => ({ value: s, label: t(`style.${s}`), title: t(`style.${s}.description`) }))}
          />
        </Section>
      )}

      <CustomizeControls
        look={look}
        onChange={onLookChange}
        showSize={false}
        showStroke={false}
        style={style}
        kind={kind}
        footnote={(
          <>
            {style === 'duocolor' && !showSecondary && (
              <p className="text-xs leading-relaxed text-faint">{t('inspector.singleContour')}</p>
            )}
          </>
        )}
      />

      <RailActions>{(expand) => (
        <>
          <IconButton icon="download" label={t('pane.downloadSvg')} disabled={!source || busy} onClick={() => {
            const file = `${baseName}.svg`;
            void run(() => downloadBlob(svgBlob(build(size)), file), t('export.downloaded', { file }));
          }} />
          <IconButton icon="copy" label={t('pane.copySvg')} disabled={!source || busy} onClick={() => {
            void run(() => copyText(build(size)), t('export.copiedSvg'));
          }} />
          {snippets && <IconButton icon="code" label={t('pane.openCode')} onClick={() => {
            expand();
            requestAnimationFrame(() => {
              const trigger = codeTrigger.current;
              if (trigger?.getAttribute('aria-expanded') === 'false') trigger.click();
              trigger?.focus();
            });
          }} />}
        </>
      )}</RailActions>

      <ExportPanel
        name={icon.name}
        baseName={baseName}
        size={size}
        build={(px) => build(px)}
        disabled={!source || busy}
        run={run}
      />

      {snippets && (
        <Section collapsible defaultOpen={false} triggerRef={codeTrigger} title={t('inspector.code')}>
          <div className="code-stone">
            <CodeTabs
              label={t('iconPage.framework')}
              tabs={[
                { id: 'react', label: t('iconPage.react'), code: snippets.react, lang: 'tsx' },
                { id: 'vue', label: t('iconPage.vue'), code: snippets.vue, lang: 'vue' },
                { id: 'svelte', label: t('iconPage.svelte'), code: snippets.svelte, lang: 'svelte' },
                { id: 'solid', label: t('iconPage.solid'), code: snippets.solid, lang: 'tsx' },
                { id: 'angular', label: t('iconPage.angular'), code: snippets.angular, lang: 'ts' },
              ]}
            />
          </div>
          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-faint">
            {codeNote && <li>{codeNote}</li>}
            {plainFallback && (
              <li>
                {authoredMatch
                  ? t('inspector.codeModifierSize', {
                    modifier: label('modifier', badge.modifier.name, badge.modifier.label),
                    authored: pxText(Math.round(authoredModifierPx(size) * 10) / 10),
                    size: pxText(badgeSize),
                  })
                  : t('inspector.codeModifier', { modifier: label('modifier', badge.modifier.name, badge.modifier.label) })}
              </li>
            )}
            <li>
              {rich('inspector.codeInstall', {
                link: (text) => <a className="text-brand underline underline-offset-2" href={path('/docs')}>{text}</a>,
              })}
            </li>
          </ul>
        </Section>
      )}
      <div className="h-4" />
    </div>
  );
}

/**
 * Desktop: a persistent, collapsible side pane rendered into the layout's
 * pane slot (full height, beside the page). Mobile: a modal bottom sheet.
 */
export function SidePane({
  desktop, host, collapsed, onCollapsedChange, sheetOpen, onDismiss, headingId, focusKey, expandTo, expandBackTo, quickControls, children,
}: {
  desktop: boolean;
  host: HTMLElement | null;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  /** Mobile only: whether the sheet is showing. */
  sheetOpen: boolean;
  /** Escape / backdrop: clear the selection or close the sheet. */
  onDismiss: () => void;
  headingId: string;
  /** Focus the pane heading whenever this changes to a non-null value. */
  focusKey: string | null;
  /** Desktop only: a page that shows the pane's subject in full (the selected icon's page). */
  expandTo?: string;
  expandBackTo?: string;
  quickControls?: ReactNode;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { t } = useI18n();
  const { pathname, search } = useLocation();
  const [width, setWidth] = usePaneWidth();
  const [resizing, setResizing] = useState(false);
  const [railHost, setRailHost] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (desktop || !dialog) return;
    if (sheetOpen && !dialog.open) dialog.showModal();
    if (!sheetOpen && dialog.open) dialog.close();
  }, [sheetOpen, desktop]);

  useEffect(() => {
    if (focusKey === null) return;
    requestAnimationFrame(() => document.getElementById(headingId)?.focus({ preventScroll: true }));
  }, [focusKey, headingId]);

  if (desktop) {
    if (!host) return null;
    return createPortal(
      <aside
        aria-label={t('pane.label')}
        onKeyDown={(e) => { if (e.key === 'Escape' && !collapsed) { e.stopPropagation(); onDismiss(); } }}
        style={{ width: collapsed ? undefined : width }}
        className={`sticky top-0 flex h-dvh shrink-0 flex-col overflow-hidden border-l border-line bg-surface ${
          resizing ? '' : 'transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]'
        } ${collapsed ? 'w-14' : ''}`}
      >
        {!collapsed && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={t('pane.resize')}
            aria-controls="side-pane-body"
            aria-valuemin={PANE_WIDTH.min}
            aria-valuemax={PANE_WIDTH.max}
            aria-valuenow={width}
            aria-valuetext={t('customize.pxValue', { value: width })}
            title={t('pane.resizeHint')}
            tabIndex={0}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              const startX = e.clientX;
              const startWidth = width;
              const handle = e.currentTarget;
              handle.setPointerCapture(e.pointerId);
              setResizing(true);
              // The pane sits on the right, so dragging left widens it.
              const move = (ev: PointerEvent) => setWidth(startWidth + (startX - ev.clientX), false);
              const end = (ev: PointerEvent) => {
                setWidth(startWidth + (startX - ev.clientX));
                setResizing(false);
                handle.removeEventListener('pointermove', move);
                handle.removeEventListener('pointerup', end);
                handle.removeEventListener('pointercancel', end);
              };
              handle.addEventListener('pointermove', move);
              handle.addEventListener('pointerup', end);
              handle.addEventListener('pointercancel', end);
            }}
            onDoubleClick={() => setWidth(PANE_WIDTH.default)}
            onKeyDown={(e) => {
              const next = e.key === 'ArrowLeft' ? width + PANE_WIDTH.step
                : e.key === 'ArrowRight' ? width - PANE_WIDTH.step
                  : e.key === 'Home' ? PANE_WIDTH.min
                    : e.key === 'End' ? PANE_WIDTH.max
                      : e.key === 'Enter' ? PANE_WIDTH.default : null;
              if (next === null) return;
              e.preventDefault();
              setWidth(next);
            }}
            className="group absolute inset-y-0 left-0 z-20 w-2 -translate-x-1/2 cursor-col-resize touch-none outline-none"
          >
            <span className={`absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 transition-colors group-hover:bg-brand group-focus-visible:bg-brand ${resizing ? 'bg-brand' : ''}`} />
          </div>
        )}
        <div className={`flex h-[57px] shrink-0 items-center border-b border-line px-2.5 ${collapsed ? 'justify-center' : ''}`}>
          <IconButton
            icon="layout-sidebar-right"
            label={collapsed ? t('pane.expand') : t('pane.collapse')}
            aria-expanded={!collapsed}
            aria-controls="side-pane-body"
            onClick={() => onCollapsedChange(!collapsed)}
          />
          {!collapsed && expandTo && (
            <LocalLink
              to={expandTo}
              replace={false}
              // The page's back link returns here, with the search and selection intact.
              state={{ from: `${pathname}${search}`, catalogBackTo: expandBackTo }}
              aria-label={t('pane.openPage')}
              title={t('pane.openPage')}
              className="ml-auto inline-flex size-9 items-center justify-center rounded-lg text-ink transition hover:bg-sunken"
            >
              {/* Mirrored so the arrows point to the top-right and bottom-left corners. */}
              <UiIcon name="expand" className="size-5 -scale-x-100" />
            </LocalLink>
          )}
        </div>
        {collapsed && quickControls && (
          <div className="flex flex-col items-center gap-1 py-2">
            {quickControls}
            <div ref={setRailHost} className="flex flex-col items-center gap-1" />
          </div>
        )}
        <div
          id="side-pane-body"
          hidden={collapsed}
          style={{ width }}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          <RailContext.Provider value={collapsed && railHost ? { host: railHost, expand: () => onCollapsedChange(false) } : null}>
            {children}
          </RailContext.Provider>
        </div>
      </aside>,
      host,
    );
  }
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={headingId}
      onCancel={(e) => { e.preventDefault(); onDismiss(); }}
      onClick={(e) => { if (e.target === dialogRef.current) onDismiss(); }}
      className="sheet m-0 mt-auto max-h-[88dvh] w-full max-w-none overflow-y-auto rounded-t-3xl border-t border-line bg-surface p-0 text-ink"
    >
      <div className="sticky top-0 z-10 flex justify-center bg-surface pb-1 pt-2" aria-hidden="true">
        <span className="h-1 w-10 rounded-full bg-line-strong" />
      </div>
      {sheetOpen && children}
    </dialog>
  );
}
