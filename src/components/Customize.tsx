import { useI18n } from '../i18n';
import { useEffect, useId, useRef, useState, type ReactNode, type Ref } from 'react';
import { catalog, type StyleId } from '../lib/catalog';
import { buildFullSet, fullSetName } from '../lib/download-all';
import { downloadBlob } from '../lib/export';
import { errorText } from '../i18n/errors';
import {
  DEFAULT_LOOK, INK_THEME, STROKE_ANCHORS, GRID_MAX_SIZE, isCustomized, MAX_SIZE, MIN_SIZE, resolveLook, SIZE_SLIDER_MAX, SIZE_SLIDER_MIN, SIZE_STEP, STROKE_MAX, STROKE_MIN, STROKE_STEP,
  strokeAdjustable, strokeOf, themeColors, THEME_NAMES, type Look,
} from '../lib/look';
import { isDuo, isHexColor } from '../lib/svg';
import { useTheme } from '../lib/theme';
import { TeachingTip } from './TeachingTip';
import { RailActions } from './QuickTools';
import { Button, IconButton, RangeSlider, Segmented, UiIcon, useToast } from './ui';

/** Slider ticks: size every 8px (labels where the usual sizes are), stroke every 0.5px. */
const SIZE_MARKS = [16, 24, 32, 40, 48, 56, 64] as const;
const SIZE_LABELS = [16, 24, 32, 48, 64] as const;
const STROKE_MARKS = [0.5, 1, 1.5, 2, 2.5] as const;

export function ColorField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  const id = useId();
  const { t } = useI18n();
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const valid = isHexColor(text);
  return (
    // Label on top; the swatch and hex input share one row at the same height, so they line up.
    <div>
      <label htmlFor={id} className="block pl-11 text-xs font-medium text-muted">{label}</label>
      <div className="mt-0.5 flex items-center gap-3">
        <input
          type="color"
          aria-label={t('customize.colorInput', { label })}
          value={value.length === 7 ? value : '#000000'}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="size-8 shrink-0 cursor-pointer rounded-lg border border-line-strong bg-surface p-1 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
        />
        <input
          id={id}
          value={text}
          spellCheck={false}
          aria-invalid={!valid}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(e) => {
            setText(e.target.value);
            if (isHexColor(e.target.value)) onChange(e.target.value.toUpperCase());
          }}
          onBlur={() => setText(value)}
          className={`h-8 min-w-0 flex-1 rounded-md border bg-surface px-2 font-mono text-sm uppercase ${valid ? 'border-line' : 'border-danger'}`}
        />
      </div>
      {hint && <p id={`${id}-hint`} className="mt-1 pl-11 text-xs text-faint">{hint}</p>}
    </div>
  );
}

/** Open/closed state per section title, kept while the page is open, so it survives switching icons. */
const sectionOpen = new Map<string, boolean>();
export const resetSectionState = () => sectionOpen.clear();

export function Section({
  title, children, aside, collapsible = true, defaultOpen = true, triggerRef,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
  /** Render the title as a disclosure button that shows or hides the body. */
  collapsible?: boolean;
  defaultOpen?: boolean;
  triggerRef?: Ref<HTMLButtonElement>;
}) {
  const [open, setOpenState] = useState(() => sectionOpen.get(title) ?? defaultOpen);
  const setOpen = (update: (o: boolean) => boolean) => setOpenState((o) => {
    const next = update(o);
    sectionOpen.set(title, next);
    return next;
  });
  const bodyId = useId();
  const heading = 'font-sans text-xs font-semibold uppercase tracking-[0.08em] text-muted';
  const expanded = !collapsible || open;
  return (
    <section className="border-t border-line px-5 py-4">
      <div className={`flex min-h-7 items-center justify-between gap-2 ${expanded ? 'mb-3' : ''}`}>
        {collapsible ? (
          <h3 className={heading}>
            <button
              type="button"
              ref={triggerRef}
              aria-expanded={open}
              aria-controls={bodyId}
              onClick={() => setOpen((o) => !o)}
              className="-mx-1 inline-flex items-center gap-1.5 rounded px-1 uppercase hover:text-ink"
            >
              <UiIcon name="chevron-down" className={`size-3.5 transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
              {title}
            </button>
          </h3>
        ) : (
          <h3 className={heading}>{title}</h3>
        )}
        {aside}
      </div>
      <div id={bodyId} hidden={!expanded}>
        {children}
      </div>
    </section>
  );
}

/**
 * Strokes are stored in 24px-grid units, so they scale with the icon; show
 * them in real pixels at the icon's size (1.25 at 48px is 2.5px).
 */
const fmtStroke = (w: number, size: number) => `${Number(((w * size) / catalog.grid).toFixed(2))}px`;

/** The Size section: a slider for common sizes plus a field for any size. */
export function SizeControl({ look, onChange, compact = false }: { look: Look; onChange: (patch: Partial<Look>) => void; compact?: boolean }) {
  const { t } = useI18n();
  const uid = useId();
  const [sizeText, setSizeText] = useState(String(look.size));
  useEffect(() => setSizeText(String(look.size)), [look.size]);

  const commitSize = (value: number) => {
    const next = Math.round(Math.min(MAX_SIZE, Math.max(MIN_SIZE, value)));
    onChange({ size: next });
    setSizeText(String(next));
  };

  return (
    <Section
      title={t('customize.size')}
      collapsible={!compact}
      aside={(
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <span className="sr-only">{t('customize.sizeCustom')}</span>
          <input
            type="number"
            inputMode="numeric"
            min={MIN_SIZE}
            max={MAX_SIZE}
            value={sizeText}
            onChange={(e) => {
              setSizeText(e.target.value);
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n >= MIN_SIZE && n <= MAX_SIZE) onChange({ size: Math.round(n) });
            }}
            onBlur={() => commitSize(Number(sizeText) || DEFAULT_LOOK.size)}
            className="h-7 w-14 rounded-md border border-line-strong bg-surface px-2 text-right font-mono text-xs tabular-nums text-ink"
          />
          {t('customize.px')}
        </label>
      )}
    >
      <RangeSlider
        id={`${uid}-size`}
        label={t('customize.size')}
        min={SIZE_SLIDER_MIN}
        max={SIZE_SLIDER_MAX}
        step={SIZE_STEP}
        value={Math.min(SIZE_SLIDER_MAX, Math.max(SIZE_SLIDER_MIN, look.size))}
        valueText={t('customize.pxValue', { value: look.size })}
        onChange={commitSize}
        marks={SIZE_MARKS}
        labels={SIZE_LABELS}
        format={(v) => t('customize.pxValue', { value: v })}
      />
      {look.size > GRID_MAX_SIZE && (
        <p className="mt-2 text-xs leading-relaxed text-faint">{t('customize.gridLimit', { max: GRID_MAX_SIZE, size: look.size })}</p>
      )}
    </Section>
  );
}

/** Stroke width: Auto follows the size; the slider pins a width. Explains why solid and brand icons have none. */
export function StrokeControl({ look, onChange, style, kind = 'core', footnote, compact = false }: {
  look: Look;
  onChange: (patch: Partial<Look>) => void;
  style: StyleId;
  kind?: 'core' | 'brand';
  /** Stroke notes that only make sense for one icon (e.g. filled parts). */
  footnote?: ReactNode;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const uid = useId();
  const canStroke = strokeAdjustable(style, kind);
  const stroke = strokeOf(look);
  return (
    <Section
      title={t('customize.stroke')}
      collapsible={!compact}
      aside={canStroke && (
        <span className="flex items-center gap-2 text-xs">
          {look.strokeWidth === null ? (
            <span className="rounded bg-sunken px-1.5 py-0.5 font-medium text-muted">{t('customize.strokeAuto')}</span>
          ) : (
            <button type="button" onClick={() => onChange({ strokeWidth: null })} className="font-medium text-brand hover:underline">
              {t('customize.strokeUseAuto')}
            </button>
          )}
          <span className="font-mono tabular-nums text-ink">{fmtStroke(stroke, look.size)}</span>
        </span>
      )}
    >
      {canStroke ? (
        <>
          <RangeSlider
            id={`${uid}-stroke`}
            label={t('customize.stroke')}
            min={STROKE_MIN}
            max={STROKE_MAX}
            step={STROKE_STEP}
            value={stroke}
            valueText={look.strokeWidth === null ? t('customize.strokeAutoValue', { value: fmtStroke(stroke, look.size) }) : fmtStroke(stroke, look.size)}
            onChange={(v) => onChange({ strokeWidth: v })}
            marks={STROKE_MARKS}
            format={(v) => fmtStroke(v, look.size)}
          />
          <p className="mt-2 text-xs leading-relaxed text-faint">
            {look.strokeWidth === null
              ? t('customize.strokeAutoHelp', { sizes: STROKE_ANCHORS.map((a) => t('customize.strokeAtSize', { stroke: fmtStroke(a.stroke, a.size), size: a.size })).join(', ') })
              : t('customize.strokeFixedHelp', { stroke: fmtStroke(stroke, catalog.grid) })}
          </p>
          {footnote}
        </>
      ) : (
        <p className="text-xs leading-relaxed text-faint">
          {kind === 'brand' ? t('customize.strokeBrand') : t('customize.strokeSolid')}
        </p>
      )}
    </Section>
  );
}

/** Size, stroke, and color: shared by the grid-wide panel and the inspector. */
export function CustomizeControls({
  look, onChange, style, kind = 'core', footnote, strokeFootnote, showSize = true, showStroke = true,
}: {
  look: Look;
  onChange: (patch: Partial<Look>) => void;
  style: StyleId;
  kind?: 'core' | 'brand';
  /** Extra color notes that only make sense for one icon (e.g. single contour). */
  footnote?: ReactNode;
  /** Stroke notes that only make sense for one icon (e.g. filled parts). */
  strokeFootnote?: ReactNode;
  /** Off when the caller places SizeControl itself (the inspector puts it above Modifier). */
  showSize?: boolean;
  /** Off when the caller places StrokeControl itself (the inspector keeps it under Size). */
  showStroke?: boolean;
}) {
  const { resolved: theme, setPreference } = useTheme();
  const { t } = useI18n();
  const duo = isDuo(style);
  const r = resolveLook(look, theme);

  return (
    <>
      {showSize && <SizeControl look={look} onChange={onChange} />}

      {showStroke && <StrokeControl look={look} onChange={onChange} style={style} kind={kind} footnote={strokeFootnote} />}

      <Section
        title={t('customize.color')}
        aside={(
          <Segmented
            label={t('customize.paletteVariant')}
            size="sm"
            value={r.mode}
            // Themes have light and dark variants, previewed on the matching background: switch the site theme.
            onChange={(v) => setPreference(v)}
            options={[
              { value: 'light', label: t('theme.light') },
              { value: 'ivory', label: t('theme.warm') },
              { value: 'dark', label: t('theme.dark') },
            ]}
          />
        )}
      >
        <div className="space-y-3">
          {/* One theme sets every style: a main color for Regular and Solid, primary and secondary for the duo styles. */}
          <div role="radiogroup" aria-label={t('customize.colorTheme')} className="grid grid-cols-[auto_repeat(8,minmax(0,2rem))] items-start justify-start gap-1">
            {THEME_NAMES.map((name) => {
              const c = themeColors(name, r.mode);
              const checked = !look.custom && !look.mono && name === r.themeName;
              const themeLabel = name === INK_THEME ? t('customize.inkTheme') : name;
              const swatch = (
                <button
                  key={name}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  aria-label={themeLabel}
                  title={themeLabel}
                  onClick={() => onChange({ paletteName: name, custom: null, mono: null })}
                  className={`theme-swatch squircle flex size-8 max-w-full items-center justify-center ring-offset-2 ring-offset-surface ${checked ? 'ring-2 ring-ink' : ''}`}
                >
                  <span className="squircle flex size-6 overflow-hidden border border-line" aria-hidden="true">
                    <span className="flex-1" style={{ background: c.main }} />
                    <span className="flex-1" style={{ background: c.primary }} />
                    <span className="flex-1" style={{ background: c.secondary }} />
                  </span>
                </button>
              );
              return name === INK_THEME
                ? <div key={name} className="col-start-1 row-span-2 row-start-1 mr-1 border-r border-line pr-2">{swatch}</div>
                : swatch;
            })}
          </div>
          <TeachingTip tip="color" />
          {duo ? (
            <>
              <ColorField label={t('customize.primary')} value={r.duo.primary} onChange={(v) => onChange({ custom: { ...r.duo, primary: v } })} />
              {style === 'duocolor' && (
                <ColorField label={t('customize.secondary')} value={r.duo.secondary} onChange={(v) => onChange({ custom: { ...r.duo, secondary: v } })} />
              )}
              {style === 'duotone' && (
                <p className="text-xs leading-relaxed text-faint">{t('customize.duotoneTint')}</p>
              )}
            </>
          ) : (
            <ColorField
              label={t('customize.foreground')}
              value={r.mono}
              onChange={(v) => onChange({ mono: v })}
              hint={look.mono ? undefined : r.monoFollowsSite ? t('customize.followTheme') : t('customize.fromTheme', { theme: r.themeName })}
            />
          )}
          {footnote}
        </div>
      </Section>
    </>
  );
}

/** The pane's content when no icon is selected. */
export function CustomizePanel({
  look, onChange, onReset, onClose, style, kind, headingId,
}: {
  look: Look;
  onChange: (patch: Partial<Look>) => void;
  onReset: () => void;
  /** Mobile sheet only. */
  onClose?: () => void;
  style: StyleId;
  kind: 'core' | 'brand';
  headingId: string;
}) {
  const { t } = useI18n();
  const heading = useRef<HTMLHeadingElement>(null);
  return (
    <div className="flex min-h-full flex-col">
      <div className="px-5 pb-4 pt-5">
        <div className="flex items-center gap-2">
          <h2 ref={heading} id={headingId} tabIndex={-1} className="min-w-0 flex-1 text-xl font-semibold outline-none">{t('customize.title')}</h2>
          {isCustomized(look) && (
            <Button
              variant="secondary"
              size="sm"
              icon="undo"
              aria-label={t('customize.reset')}
              onClick={() => { heading.current?.focus(); onReset(); }}
            >
              {t('customize.resetShort')}
            </Button>
          )}
          {onClose && <IconButton icon="x" label={t('customize.close')} onClick={onClose} className="sheet-close -mr-2" />}
        </div>
        <p className="mt-1 text-sm text-muted">{t('customize.intro')}</p>
      </div>
      <CustomizeControls look={look} onChange={onChange} style={style} kind={kind} />
      {kind === 'core' && <DownloadSection look={look} />}
    </div>
  );
}

/**
 * Download the set as one ZIP with the look set above: every style by
 * default, or only the styles the user keeps switched on.
 */
export function DownloadSection({ look }: { look: Look }) {
  const { t, n } = useI18n();
  const i18n = useI18n();
  const toast = useToast();
  const { resolved: theme } = useTheme();
  const uid = useId();
  const [styles, setStyles] = useState<StyleId[]>([...catalog.styles]);
  const [busy, setBusy] = useState(false);
  const all = styles.length === catalog.styles.length;
  const toggle = (style: StyleId) => setStyles((current) => (
    current.includes(style) ? current.filter((s) => s !== style) : catalog.styles.filter((s) => s === style || current.includes(s))
  ));
  const download = async () => {
    if (busy || !styles.length) return;
    setBusy(true);
    try {
      const name = fullSetName(styles);
      downloadBlob(await buildFullSet(look, theme, styles), name);
      toast('success', t('download.done', { file: name }));
    } catch (error) {
      toast('error', errorText(error, i18n, 'error.download'));
    } finally {
      setBusy(false);
    }
  };
  const label = busy
    ? t('download.preparing')
    : !styles.length
      ? t('download.none')
      : all
        ? t('download.all')
        : styles.length === 1
          ? t('download.one', { style: t(`style.${styles[0]}`) })
          : t('download.some', { count: styles.length });
  return (
    <section aria-labelledby={`${uid}-title`} className="border-t border-line px-5 py-4">
      <RailActions>{() => (
        <IconButton icon="download" label={label} onClick={download} disabled={busy || !styles.length} />
      )}</RailActions>
      <h3 id={`${uid}-title`} className="font-sans text-xs font-semibold uppercase tracking-[0.08em] text-muted">{t('download.title')}</h3>
      <fieldset className="mt-3">
        <legend className="sr-only">{t('download.styles')}</legend>
        <div className="flex flex-wrap gap-1">
          {catalog.styles.map((style) => (
            // The keyword-tag shape: brand tint with a tick when included, neutral with a plus when not.
            <label
              key={style}
              // Share the row at the default panel width; in a wider panel, stop at 6rem and sit left.
              className="inline-flex h-7 min-w-0 max-w-24 flex-1 cursor-pointer select-none items-center justify-center gap-1 rounded-lg bg-sunken px-2 text-xs font-medium text-muted transition-colors hover:text-ink has-[:checked]:bg-brand-soft has-[:checked]:text-brand has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/40"
            >
              <input type="checkbox" className="sr-only" checked={styles.includes(style)} onChange={() => toggle(style)} />
              <UiIcon name={styles.includes(style) ? 'check' : 'plus'} className="size-3" />
              {t(`style.${style}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-3 flex gap-2">
        <Button
          variant="primary"
          icon="download"
          onClick={download}
          disabled={busy || !styles.length}
          aria-describedby={`${uid}-note`}
          className="min-w-0 flex-1 disabled:cursor-wait"
        >
          <span className="truncate">{label}</span>
        </Button>
      </div>
      <p id={`${uid}-note`} className="mt-1.5 text-xs leading-relaxed text-faint">
        {t('download.note', { count: n(catalog.icons.length * styles.length) })}
      </p>
    </section>
  );
}
