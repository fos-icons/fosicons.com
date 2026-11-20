import { useI18n } from '../i18n';
import { errorText } from '../i18n/errors';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import { QuickPopover } from '../components/QuickTools';
import { CustomizePanel, SizeControl, StrokeControl } from '../components/Customize';
import { HeroActions } from '../components/HeaderActions';
import { GridHelp, IconGrid } from '../components/IconGrid';
import { Inspector, SidePane } from '../components/Inspector';
import { useModifiers } from '../components/ModifierPicker';
import { NoResults } from '../components/NoResults';
import { SelectionPanel } from '../components/SelectionPanel';
import { Button, Segmented, UiIcon } from '../components/ui';
import { BRANDS_CATEGORY, brandCatalogEntries, brandEntries, isBrand, isColorMark, loadBrandMarks } from '../lib/brands';
import { catalog, chunksFor, ICONS_ROUNDED, iconsByName, loadIconChunk, loadStyle, STYLE_META, type StyleId } from '../lib/catalog';
import { compareBrowseCategories, orderBrowseIcons } from '../lib/browse-order';
import { iconPath } from '../lib/icon-pages';
import { CONTAINER, usePaneHost } from '../lib/layout';
import { DEFAULT_LOOK, gridVars, strokeAdjustable, type Look } from '../lib/look';
import { modifiersFor } from '../lib/modifiers';
import { hasConnector, parseModifierPhrase } from '../lib/phrase';
import { createIndex, search, suggest } from '../lib/search';
import { prepareGridSvg } from '../lib/svg';
import { useMediaQuery, useTheme } from '../lib/theme';
import {
  parseState, serializeState, type CatalogState, type UrlStateConfig, type View,
} from '../lib/url-state';

/** Core icons and brand marks share one catalog; marks are the Brands category. */
const allEntries = [...catalog.icons, ...brandCatalogEntries];
const coreIndex = createIndex(allEntries);
const browseIndex = createIndex(orderBrowseIcons(allEntries));
const browseCategories = [...catalog.categories, ...(brandCatalogEntries.length ? [{ name: BRANDS_CATEGORY, count: brandCatalogEntries.length }] : [])]
  .sort((a, b) => compareBrowseCategories(a.name, b.name));
const brandsByName = new Map(brandCatalogEntries.map((b) => [b.name, b]));
const config: UrlStateConfig = {
  styles: catalog.styles,
  core: { categories: browseCategories.map((c) => c.name), icons: new Set([...iconsByName.keys(), ...brandsByName.keys()]) },
  /** Brand names, so URL parsing can refuse modifiers on a mark. */
  brands: { categories: [], icons: new Set(brandsByName.keys()) },
};
const COLLAPSE_KEY = 'fos-pane-collapsed';

/** Search ghost text: the prompt first, then rotating tips for every trick. */
const DESKTOP_TIPS = ['icons.tip.modifier', 'icons.tip.multi', 'icons.tip.slash', 'icons.tip.arrows', 'icons.tip.pane', 'icons.tip.esc', 'icons.tip.share'] as const;
const MOBILE_TIPS = ['icons.tip.customize', 'icons.tip.category', 'icons.tip.shareShort'] as const;

/** Focus the search box with "/" unless the user is typing somewhere. */
export function useSlashToFocus(ref: React.RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], dialog[open]')) return;
      if (document.querySelector('dialog[open]')) return;
      event.preventDefault();
      ref.current?.focus();
      ref.current?.select();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ref]);
}

const TIP_INTERVAL_MS = 4500;

/**
 * Ghost text that rotates through tips while the field is empty and not
 * focused. The first entry is the plain search prompt. Tips are visual
 * hints only; the field's accessible name comes from `label`.
 */
function useRotatingTip(tips: string[], paused: boolean) {
  const [index, setIndex] = useState(0);
  const count = tips.length;
  useEffect(() => {
    if (paused || count < 2) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), TIP_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [paused, count]);
  return { tip: tips[index % Math.max(count, 1)] ?? '', index };
}

export function SearchField({
  value, onChange, inputRef, tips, label,
}: { value: string; onChange: (v: string) => void; inputRef: React.RefObject<HTMLInputElement | null>; tips: string[]; label: string }) {
  const [focused, setFocused] = useState(false);
  const { t } = useI18n();
  const { tip, index } = useRotatingTip(tips, focused || !!value);
  return (
    <div className="relative">
      <UiIcon name="search" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-faint" />
      <input
        ref={inputRef}
        type="search"
        aria-label={label}
        value={value}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => { if (e.key === 'Escape' && value) { e.preventDefault(); onChange(''); } }}
        className="h-12 w-full rounded-2xl border border-line-strong bg-surface pl-12 pr-24 text-base text-ink shadow-[0_1px_2px_rgb(0_0_0/0.04)] outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15 [&::-webkit-search-cancel-button]:hidden"
      />
      {!value && (
        <span
          key={index}
          aria-hidden="true"
          data-testid="search-tip"
          className="search-tip pointer-events-none absolute inset-y-0 left-12 right-24 flex items-center truncate text-base text-faint"
        >
          <span className="truncate">{tip}</span>
        </span>
      )}
      <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1">
        {value ? (
          <button type="button" aria-label={t('icons.clearSearch')} onClick={() => { onChange(''); inputRef.current?.focus(); }} className="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-sunken hover:text-ink">
            <UiIcon name="x" className="size-[18px]" />
          </button>
        ) : (
          <kbd aria-hidden="true" className="hidden rounded-md border border-line bg-sunken px-1.5 py-0.5 text-xs text-muted sm:inline">/</kbd>
        )}
      </div>
    </div>
  );
}

function readCollapsed() {
  try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
}

function BrandsEmpty() {
  const { t, path } = useI18n();
  return (
    <section aria-labelledby="brands-empty" className="rounded-2xl border border-dashed border-line-strong px-6 py-14 text-center">
      <h2 id="brands-empty" className="text-lg font-semibold">{t('brands.emptyTitle')}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted">
        {t('brands.emptyBody')}
      </p>
      <p className="mt-5 text-sm">
        <a className="text-brand underline underline-offset-2" target="_blank" rel="noreferrer" href="https://github.com/fos-icons/fos-icons/blob/main/BRANDS.md">
          {t('brands.policy')}
        </a>
        <span className="mx-2 text-faint">·</span>
        <a className="text-brand underline underline-offset-2" href={path('/docs#licensing')}>{t('brands.licensing')}</a>
      </p>
    </section>
  );
}

export function IconsPage() {
  const i18n = useI18n();
  const { t, rich, label, list } = i18n;
  const [params, setParams] = useSearchParams();
  const state = useMemo(() => parseState(params.toString(), config), [params]);
  const [svgs, setSvgs] = useState<Record<string, Record<string, string>>>({});
  const [artworkErrors, setArtworkErrors] = useState<Record<string, string | undefined>>({});
  const [attempt, setAttempt] = useState(0);
  const [look, setLook] = useState<Look>(DEFAULT_LOOK);
  const [collapsed, setCollapsedState] = useState(readCollapsed);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  /** Two or more icons picked with Shift/⌘/Ctrl-click: a set to customize and download together. */
  const [multi, setMulti] = useState<string[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const desktop = useMediaQuery('(min-width: 1024px)');
  const paneHost = usePaneHost();
  const { resolved: theme } = useTheme();
  useSlashToFocus(searchRef);

  /** Brands are a category of the one catalog now, not a separate view. */
  const brandsView = false;
  const kind = 'core' as const;
  const drawStyle: StyleId = state.style === 'brands' ? catalog.styles[0] : state.style;
  const svgKey = drawStyle;

  const error = artworkErrors[svgKey];
  const reportArtworkError = useCallback((key: string, cause: unknown) => {
    setArtworkErrors((errors) => ({ ...errors, [key]: errorText(cause, i18n, 'icons.loadError') }));
  }, [i18n]);

  const update = useCallback((patch: Partial<CatalogState>, replace = false) => {
    // A modifier belongs to the icon it was tried on: opening another icon drops it.
    const reset = 'icon' in patch && !('modifier' in patch) ? { modifier: null, corner: null } : {};
    setParams(serializeState({ ...state, ...reset, ...patch }, config), { replace, preventScrollReset: true });
  }, [setParams, state]);

  const setCollapsed = useCallback((next: boolean) => {
    setCollapsedState(next);
    try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0'); } catch { /* per-viewer convenience only */ }
  }, []);
  const changeLook = useCallback((patch: Partial<Look>) => setLook((l) => ({ ...l, ...patch })), []);


  // Core artwork loads in chunks as icons near the viewport (see IconGrid's
  // onNeed); brands are few and load at once. Without IntersectionObserver
  // (old browsers, tests) the whole style loads in one request instead.
  const lazyArtwork = !brandsView && typeof IntersectionObserver !== 'undefined';
  const mergedChunks = useRef(new Set<string>());
  const [brandsInView, setBrandsInView] = useState(false);
  const need = useCallback((names: Iterable<string>) => {
    if (!lazyArtwork) return;
    const list = [...names];
    if (list.some(isBrand)) setBrandsInView(true);
    for (const chunk of chunksFor(list)) {
      const key = `${drawStyle}/${chunk}`;
      if (mergedChunks.current.has(key)) continue;
      loadIconChunk(drawStyle, chunk)
        .then((data) => {
          if (mergedChunks.current.has(key)) return;
          mergedChunks.current.add(key);
          setSvgs((s) => ({ ...s, [drawStyle]: { ...s[drawStyle], ...data } }));
        })
        .catch((e: unknown) => reportArtworkError(drawStyle, e));
    }
  }, [lazyArtwork, drawStyle, attempt, reportArtworkError]); // eslint-disable-line react-hooks/exhaustive-deps -- a retry re-asks for what's in view

  useEffect(() => {
    if (lazyArtwork) return;
    let cancelled = false;
    loadStyle(drawStyle)
      .then((data) => { if (!cancelled) setSvgs((s) => ({ ...s, [svgKey]: data })); })
      .catch((e: unknown) => { if (!cancelled) reportArtworkError(svgKey, e); });
    return () => { cancelled = true; };
  }, [lazyArtwork, drawStyle, svgKey, attempt, reportArtworkError]);

  /** A new deploy replaced this page's artwork: only a reload can fetch it. */
  const artworkUpdated = error === t('error.artworkUpdated');
  const retryArtwork = () => {
    if (artworkUpdated) { window.location.reload(); return; }
    setArtworkErrors((errors) => ({ ...errors, [svgKey]: undefined }));
    setAttempt((a) => a + 1);
  };

  // "clock with sparkle": search for the icon part and open the best match with that modifier.
  // The modifier list is large: load it only for a connector, or a multi-word search with no plain match ("edit clock").
  const bareCandidate = useMemo(
    () => !brandsView && /\S\s+\S/.test(state.q) && search(coreIndex, state.q, state.category).length === 0,
    [brandsView, state.q, state.category],
  );
  const phraseModifiers = useModifiers(!brandsView && (hasConnector(state.q) || bareCandidate));
  const phrase = useMemo(
    () => (!brandsView && phraseModifiers.list
      ? parseModifierPhrase(state.q, phraseModifiers.list, (q) => search(coreIndex, q, state.category).length)
      : null),
    [brandsView, phraseModifiers.list, state.q, state.category],
  );
  const searchQ = phrase?.iconQuery ?? state.q;

  const browsingCore = !brandsView && !searchQ.trim();
  const index = browsingCore ? browseIndex : coreIndex;
  const results = useMemo(() => search(index, searchQ, state.category), [index, searchQ, state.category]);
  const elsewhere = useMemo(
    () => (state.category && searchQ && results.length === 0 ? search(index, searchQ).length : 0),
    [index, searchQ, state.category, results.length],
  );
  const noResults = !!searchQ.trim() && results.length === 0;
  const suggestions = useMemo(() => (noResults ? suggest(index, searchQ) : []), [noResults, index, searchQ]);
  const otherCatalog = 0;

  /** The icon a modifier phrase opens: the best result that can take that modifier. */
  const phraseTarget = useMemo(() => {
    if (!phrase || !phraseModifiers.list) return null;
    const list = phraseModifiers.list;
    return results.find((i) => !i.composition && modifiersFor(i.name, list).some((m) => m.name === phrase.modifier)) ?? null;
  }, [phrase, phraseModifiers.list, results]);
  const phraseLabel = phrase && phraseModifiers.list?.find((m) => m.name === phrase.modifier);
  const appliedPhrase = useRef<string | null>(null);
  useEffect(() => {
    if (!phrase || !phraseTarget) return;
    const key = `${phraseTarget.name}|${phrase.modifier}|${phrase.corner}`;
    if (appliedPhrase.current === key) return;
    // Wait for a pause in typing, so "clock with s…" doesn't flicker through modifiers.
    const timer = window.setTimeout(() => {
      appliedPhrase.current = key;
      setMulti([]);
      update({ icon: phraseTarget.name, modifier: phrase.modifier, corner: phrase.corner }, true);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [phrase, phraseTarget, update]);
  const badgeRequest = useMemo(
    () => (state.modifier ? { name: state.modifier, corner: state.corner } : null),
    [state.modifier, state.corner],
  );

  const selected = state.icon ? iconsByName.get(state.icon) ?? brandsByName.get(state.icon) ?? null : null;
  const selectedBrand = !!selected && isBrand(selected.name);

  // Brand marks load the first time one is on screen or open: their own colors
  // on Regular, and the one-color Solid marks on the other styles.
  const brandStyle = drawStyle === catalog.styles[0] ? 'regular' as const : 'filled' as const;
  const [brandMarkSets, setBrandMarkSets] = useState<Partial<Record<'regular' | 'filled', Record<string, string>>>>({});
  const brandMarks = brandMarkSets[brandStyle] ?? null;
  const brandsNeeded = selectedBrand || multi.some(isBrand) || brandsInView || (!lazyArtwork && results.some((r) => isBrand(r.name)));
  useEffect(() => {
    if (!brandsNeeded || brandMarks) return;
    let cancelled = false;
    loadBrandMarks(brandStyle)
      .then((marks) => { if (!cancelled) setBrandMarkSets((sets) => ({ ...sets, [brandStyle]: marks })); })
      .catch((e: unknown) => { if (!cancelled) reportArtworkError(svgKey, e); });
    return () => { cancelled = true; };
  }, [brandsNeeded, brandMarks, brandStyle, svgKey, attempt, reportArtworkError]);
  // The pane and selection need their artwork even when scrolled out of view.
  useEffect(() => { need([...multi, ...(selected ? [selected.name] : [])]); }, [need, multi, selected]);
  const coreSvgs = svgs[svgKey] ?? null;
  /** Artwork by name: this style's icons plus the brand marks, which ship in Regular only. */
  const styleSvgs = useMemo(
    () => (coreSvgs || brandMarks ? {
      ...coreSvgs,
      // Full-color marks get data-brand (a light tile in the dark theme); one-color
      // Solid marks use currentColor like the icons around them.
      ...Object.fromEntries(Object.entries(brandMarks ?? {}).map(([k, v]) => [k, isColorMark(k, brandStyle) ? v.replace('<svg', '<svg data-brand') : v])),
    } : null),
    [coreSvgs, brandMarks, brandStyle],
  );
  const gridSvgs = useMemo(
    () => (styleSvgs ? Object.fromEntries(Object.entries(styleSvgs).map(([k, v]) => [k, isBrand(k) ? v : prepareGridSvg(v)])) : null),
    [styleSvgs],
  );

  const multiActive = multi.length >= 2;
  const selectedSet = useMemo(
    () => new Set(multiActive ? multi : state.icon ? [state.icon] : []),
    [multiActive, multi, state.icon],
  );

  // A single icon chosen any other way (Back, a link, the modifier menu) ends a set.
  useEffect(() => {
    if (state.icon) setMulti([]);
  }, [state.icon]);

  /**
   * Plain click opens one icon (or closes it again). Shift/⌘/Ctrl-click
   * toggles an icon in the set; the set starts from the open icon.
   */
  const select = useCallback((name: string, additive: boolean) => {
    if (!additive) {
      setMulti([]);
      update({ icon: !multiActive && name === state.icon ? null : name });
      return;
    }
    const base = multiActive ? multi : state.icon ? [state.icon] : [];
    const next = base.includes(name) ? base.filter((n) => n !== name) : [...base, name];
    if (next.length >= 2) {
      setMulti(next);
      if (state.icon) update({ icon: null });
    } else {
      setMulti([]);
      update({ icon: next[0] ?? null });
    }
  }, [multi, multiActive, state.icon, update]);

  const close = useCallback(() => {
    const name = state.icon;
    update({ icon: null });
    requestAnimationFrame(() => {
      const cell = Array.from(document.querySelectorAll<HTMLButtonElement>('button[data-icon]')).find((b) => b.dataset.icon === name);
      (cell ?? searchRef.current)?.focus();
    });
  }, [state.icon, update]);

  const categories = browseCategories;
  const counted = t(brandsView ? 'icons.brandCount' : 'icons.count', { count: results.length });
  const query = searchQ.trim();
  const categoryName = state.category ? label('category', state.category, state.category) : '';
  const summary = query && categoryName ? t('icons.summaryForIn', { results: counted, query, category: categoryName })
    : query ? t('icons.summaryFor', { results: counted, query })
      : categoryName ? t('icons.summaryIn', { results: counted, category: categoryName })
        : counted;
  const viewOptions: { value: View; label: string; title?: string }[] = catalog.styles
    .map((s) => ({ value: s as View, label: t(`style.${s}`), title: t(`style.${s}.description`) }));
  const tips = brandsView
    ? [t('icons.searchBrands')]
    : [t(desktop ? 'icons.tip.search' : 'icons.tip.searchShort', { count: ICONS_ROUNDED }), ...(desktop ? DESKTOP_TIPS : MOBILE_TIPS).map((k) => t(k))];

  return (
    <div className={`${CONTAINER} pb-16 pt-8 sm:pt-12`}>
      <div className="mb-5 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {rich('icons.headline', { em: (text) => <span className="text-brand">{text}</span> })}
        </h1>
        <p className="mt-2 text-base text-muted">
          {t('icons.intro', { count: ICONS_ROUNDED, styles: list(catalog.styles.map((s) => t(`style.${s}`))) })}
        </p>
        <HeroActions className="mt-5" />
      </div>

      <div className="sticky top-0 z-20 -mx-4 bg-canvas/90 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-canvas/75 sm:-mx-6 sm:px-6">
        <SearchField
          inputRef={searchRef}
          label={brandsView ? t('icons.searchBrands') : t('icons.searchIcons')}
          tips={tips}
          value={state.q}
          onChange={(q) => update({ q }, true)}
        />
        {phrase && phraseTarget && phraseLabel && (
          <p className="mt-2 flex items-center gap-1.5 px-1 text-xs text-muted">
            <UiIcon name="sparkles" className="size-3.5 text-brand" />
            {t('icons.phraseHint', {
              icon: phraseTarget.name,
              modifier: label('modifier', phraseLabel.name, phraseLabel.label),
            })}
          </p>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Segmented
          fill
          label={t('icons.styleSwitcher')}
          value={drawStyle}
          onChange={(style) => update({ style })}
          options={viewOptions}
        />
        {(!brandsView || brandEntries.length > 0) && (
          <p className="sr-only" aria-live="polite" aria-atomic="true">{summary}</p>
        )}
        <div className="ml-auto flex items-center gap-3">
          {!desktop && (
            <Button icon="settings-sliders" onClick={() => setCustomizeOpen(true)}>{t('icons.customize')}</Button>
          )}
          {(!brandsView || brandEntries.length > 0) && (
            <div className="relative">
              <label htmlFor="category" className="sr-only">{t('icons.category')}</label>
              <select
                id="category"
                value={state.category ?? ''}
                onChange={(e) => update({ category: e.target.value || null })}
                className="h-9 appearance-none rounded-lg border border-line-strong bg-surface pl-3 pr-9 text-sm font-medium text-ink"
              >
                <option value="">{t('icons.allCategories')}</option>
                {categories.map((c) => (
                  <option key={c.name} value={c.name}>{t('icons.categoryOption', { name: label('category', c.name, c.name), count: c.count })}</option>
                ))}
              </select>
              <UiIcon name="chevron-down" className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            </div>
          )}
        </div>
      </div>

      {(state.category === BRANDS_CATEGORY || selectedBrand) && (
        <p className="mt-4 inline-flex items-center gap-2 rounded-lg bg-sunken px-3 py-1.5 text-sm font-medium text-ink">
          <UiIcon name="info-circle" className="size-4 text-muted" />
          {t('icons.brandDisclaimer')}
        </p>
      )}

      <div className="mt-6">
        <GridHelp />
        {brandsView && brandEntries.length === 0 ? (
          <BrandsEmpty />
        ) : error ? (
          <div role="alert" className="rounded-2xl border border-line bg-surface p-8 text-center">
            <p className="font-medium">{error}</p>
            <Button className="mt-4" onClick={retryArtwork}>{t(artworkUpdated ? 'icons.reload' : 'icons.tryAgain')}</Button>
          </div>
        ) : results.length ? (
          <div className="grid-colors" style={gridVars(look, drawStyle, theme, kind) as CSSProperties}>
            <IconGrid
              label={brandsView ? t('icons.brandGridLabel') : t('icons.gridLabel', { style: t(`style.${drawStyle}`) })}
              items={results}
              categoryTitle={browsingCore && !state.category ? (category) => label('category', category, category) : undefined}
              svgs={gridSvgs}
              selected={selectedSet}
              onSelect={select}
              onNeed={lazyArtwork ? need : undefined}
            />
          </div>
        ) : (
          <NoResults
            query={state.q}
            category={state.category}
            noun={t(brandsView ? 'noResults.nounBrands' : 'noResults.nounIcons')}
            brandsView={brandsView}
            suggestions={suggestions}
            svgs={gridSvgs}
            elsewhere={elsewhere}
            otherCatalog={otherCatalog}
            onSearch={(q) => update({ q, category: null })}
            onShowAllCategories={() => update({ category: null })}
            onSwitchCatalog={() => { setMulti([]); update({ style: brandsView ? catalog.styles[0] : 'brands', category: null, icon: null }); }}
            onClear={() => { update({ q: '', category: null }); searchRef.current?.focus(); }}
          />
        )}
      </div>

      <SidePane
        desktop={desktop}
        host={paneHost}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        sheetOpen={multiActive || !!selected || customizeOpen}
        onDismiss={() => (multiActive ? setMulti([]) : selected ? close() : setCustomizeOpen(false))}
        headingId="pane-heading"
        focusKey={selected?.name ?? null}
        quickControls={(
          <>
            <QuickPopover icon="arrows-fit-horizontal" label={t('customize.size')}>
              <SizeControl compact look={look} onChange={changeLook} />
            </QuickPopover>
            {strokeAdjustable(drawStyle, kind) && (
              <QuickPopover icon="slider-horizontal" label={t('customize.stroke')}>
                <StrokeControl compact look={look} onChange={changeLook} style={drawStyle} kind={kind} />
              </QuickPopover>
            )}
          </>
        )}
        expandTo={selected && !selectedBrand && !multiActive
          ? `${iconPath(selected.name)}${drawStyle === catalog.styles[0] ? '' : `?style=${STYLE_META[drawStyle].slug}`}`
          : undefined}
      >
        {multiActive ? (
          <SelectionPanel
            names={multi}
            style={drawStyle}
            kind={kind}
            svgs={styleSvgs}
            look={look}
            onLookChange={changeLook}
            onRemove={(name) => select(name, true)}
            onClear={() => setMulti([])}
            headingId="pane-heading"
          />
        ) : selected ? (
          <Inspector
            key={`${selectedBrand ? 'brand' : 'core'}:${selected.name}`}
            kind={selectedBrand ? 'brand' : 'core'}
            icon={selected}
            style={selectedBrand ? (isColorMark(selected.name, brandStyle) ? 'regular' : 'filled') : drawStyle}
            styles={selectedBrand ? (isColorMark(selected.name, 'filled') ? ['regular'] : ['regular', 'filled']) : catalog.styles}
            source={styleSvgs?.[selected.name]}
            look={look}
            onLookChange={changeLook}
            onStyleChange={(style) => update({ style })}
            onSelectIcon={(icon) => update({ icon })}
            onClose={close}
            headingId="pane-heading"
            badgeRequest={badgeRequest}
            onBadgeChange={(choice, base) => update({
              ...(base ? { icon: base } : {}),
              modifier: choice?.name ?? null,
              corner: choice?.corner ?? null,
            }, !base)}
          />
        ) : (
          <CustomizePanel
            look={look}
            onChange={changeLook}
            onReset={() => setLook(DEFAULT_LOOK)}
            onClose={desktop ? undefined : () => setCustomizeOpen(false)}
            style={drawStyle}
            kind={kind}
            headingId="pane-heading"
          />
        )}
      </SidePane>
    </div>
  );
}
