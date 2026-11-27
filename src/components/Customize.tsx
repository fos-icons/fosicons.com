import { useI18n } from '../i18n';
import { useEffect, useId, useRef, useState, type DragEvent, type ReactNode, type Ref } from 'react';
import { catalog, FREE_ICON_STYLE, opticalStroke, type StyleId } from '../lib/catalog';
import { buildFullSet, fullSetName } from '../lib/download-all';
import { downloadBlob } from '../lib/export';
import { buildZip } from '../lib/zip';
import { errorText } from '../i18n/errors';
import {
  DEFAULT_LOOK, INK_THEME, GRID_MAX_SIZE, isCustomized, MAX_SIZE, MIN_SIZE, resolveLook, SIZE_SLIDER_MAX, SIZE_SLIDER_MIN, SIZE_STEP, STROKE_MAX, STROKE_MIN, STROKE_STEP,
  artworkSize, exportColors, strokeAdjustable, strokeOf, themeColors, type ColorChoice, type DuoColorRole, type Look,
} from '../lib/look';
import { usePlan } from '../lib/plan';
import { buildSvg, isDuo, isHexColor } from '../lib/svg';
import { useTheme, type SiteTheme } from '../lib/theme';
import { ColorSwatch } from './ColorSwatch';
import { TeachingTip } from './TeachingTip';
import { UpgradePrompt } from './UpgradePrompt';
import { RailActions } from './QuickTools';
import { Button, freeBadgeClass, IconButton, RangeSlider, Segmented, UiIcon, useToast } from './ui';

const VISIBLE_COLOR_THEMES = [INK_THEME, 'Slate', 'Blue', 'Teal', 'Green', 'Violet', 'Amber', 'Orange', 'Red'];

const PRESET_DRAG = 'application/x-fos-color-preset';

export function usePaletteDrop(onPresetDrop?: (name: string) => void) {
  const [over, setOver] = useState(false);
  const handlers = onPresetDrop ? {
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (!event.dataTransfer.types.includes(PRESET_DRAG)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      setOver(true);
    },
    onDragLeave: (event: DragEvent<HTMLElement>) => {
      if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
      setOver(false);
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      const name = event.dataTransfer.getData(PRESET_DRAG);
      setOver(false);
      if (!VISIBLE_COLOR_THEMES.includes(name)) return;
      event.preventDefault();
      onPresetDrop(name);
    },
  } : undefined;
  return { over, handlers };
}

export function ColorField({ label, value, onChange, hint, onPresetDrop }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  onPresetDrop?: (name: string) => void;
}) {
  const id = useId();
  const { t } = useI18n();
  const [text, setText] = useState(value);
  const { over, handlers } = usePaletteDrop(onPresetDrop);
  useEffect(() => setText(value), [value]);
  const valid = isHexColor(text);
  return (
    // Label on top; the swatch and hex input share one row at the same height, so they line up.
    <div
      className={over ? 'rounded-md ring-2 ring-brand ring-offset-2 ring-offset-surface' : undefined}
      {...handlers}
    >
      <label htmlFor={id} className="block pl-11 text-xs font-medium text-muted">{label}</label>
      <div className="mt-0.5 flex items-center gap-3">
        <ColorSwatch value={value} label={t('customize.colorInput', { label })} onChange={onChange} />
        <input
          id={id}
          value={text}
          spellCheck={false}
          aria-invalid={!valid}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(e) => {
            setText(e.target.value);
            if (isHexColor(e.target.value)) onChange(e.target.value.trim().toUpperCase());
          }}
          onBlur={() => setText(value)}
          className={`h-8 min-w-0 flex-1 rounded-md border bg-surface px-2 font-mono text-sm uppercase ${valid ? 'border-line' : 'border-danger'}`}
        />
      </div>
      {hint && <p id={`${id}-hint`} className="mt-1 pl-11 text-xs text-faint">{hint}</p>}
    </div>
  );
}

function TintField({ value, authored, onChange }: {
  value: number | null | undefined;
  authored: number;
  onChange: (value: number | null) => void;
}) {
  const { t } = useI18n();
  const current = value ?? authored;
  const [text, setText] = useState(String(current));
  useEffect(() => setText(String(current)), [current]);
  return (
    <label className="block min-w-0 text-xs font-medium text-muted">
      {t('customize.tint')}
      <span className="relative mt-0.5 block">
        <input
          type="number"
          name="duotone-tint"
          inputMode="numeric"
          min={0}
          max={100}
          step={1}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            const next = event.target.valueAsNumber;
            if (Number.isInteger(next) && next >= 0 && next <= 100) onChange(next);
          }}
          onBlur={(event) => {
            const next = event.target.valueAsNumber;
            const normalized = Number.isFinite(next) ? Math.min(100, Math.max(0, Math.round(next))) : null;
            if (normalized !== current || normalized === null) onChange(normalized);
            setText(String(normalized ?? authored));
          }}
          className="h-8 w-full rounded-md border border-line bg-surface ps-2 pe-6 text-right font-mono text-sm tabular-nums text-ink [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 end-2 flex items-center">%</span>
      </span>
    </label>
  );
}

/** Open/closed state per section title, kept while the page is open, so it survives switching icons. */
const sectionOpen = new Map<string, boolean>();
export const resetSectionState = () => sectionOpen.clear();

export function Section({
  title, children, aside, collapsible = true, defaultOpen = true, triggerRef, divider = true,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
  /** Render the title as a disclosure button that shows or hides the body. */
  collapsible?: boolean;
  defaultOpen?: boolean;
  triggerRef?: Ref<HTMLButtonElement>;
  divider?: boolean;
}) {
  const [open, setOpenState] = useState(() => sectionOpen.get(title) ?? defaultOpen);
  const setOpen = (update: (o: boolean) => boolean) => setOpenState((o) => {
    const next = update(o);
    sectionOpen.set(title, next);
    return next;
  });
  const bodyId = useId();
  const heading = 'font-display text-xs font-semibold uppercase tracking-[0.08em] text-muted';
  const expanded = !collapsible || open;
  return (
    <section className={`px-5 py-4 ${divider ? 'border-t border-line' : ''}`}>
      <div className={`relative flex min-h-7 items-center justify-between gap-2 ${expanded ? 'mb-3' : ''}`}>
        <div className="flex min-w-0 items-center gap-2">
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
        </div>
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

/** The Size slider covers common sizes, with a wider range for typed export sizes. */
export function SizeControl({ look, onChange, defaultSize = DEFAULT_LOOK.size }: {
  look: Look;
  onChange: (patch: Partial<Look>) => void;
  defaultSize?: number;
}) {
  const { t } = useI18n();
  const id = useId();
  const setSize = (size: number) => onChange({ size });

  return (
    <section className="px-5 py-2">
      <RangeSlider
        id={id}
        label={t('customize.size')}
        min={SIZE_SLIDER_MIN}
        max={SIZE_SLIDER_MAX}
        step={SIZE_STEP}
        value={Math.min(SIZE_SLIDER_MAX, Math.max(SIZE_SLIDER_MIN, look.size))}
        defaultValue={defaultSize}
        valueText={t('customize.pxValue', { value: look.size })}
        unit={t('customize.px')}
        valueLabel={t('customize.sizeCustom')}
        onChange={setSize}
        field={{ value: look.size, min: MIN_SIZE, max: MAX_SIZE, step: 1, onChange: setSize }}
      />
      {look.size > GRID_MAX_SIZE && (
        <p className="mt-2 text-xs leading-relaxed text-faint">{t('customize.gridLimit', { max: GRID_MAX_SIZE, size: look.size })}</p>
      )}
    </section>
  );
}

/** Animated icons only: how fast they play, from a quarter to double speed. */
export function SpeedControl({ look, onChange }: { look: Look; onChange: (patch: Partial<Look>) => void }) {
  const { t } = useI18n();
  const id = useId();
  return (
    <section className="px-5 py-2">
      <RangeSlider
        id={id}
        label={t('customize.speed')}
        min={0.25}
        max={2}
        step={0.25}
        value={look.speed}
        defaultValue={DEFAULT_LOOK.speed}
        valueText={t('customize.speedValue', { value: look.speed })}
        unit="×"
        onChange={(speed) => onChange({ speed })}
      />
      <p className="mt-2 text-xs leading-relaxed text-faint">{t('customize.speedNote')}</p>
    </section>
  );
}

/** Auto follows the size. Drag in design-grid units or type the width in actual pixels. */
export function StrokeControl({ look, onChange, style, kind = 'core', footnote }: {
  look: Look;
  onChange: (patch: Partial<Look>) => void;
  style: StyleId;
  kind?: 'core' | 'brand';
  footnote?: ReactNode;
}) {
  const { t } = useI18n();
  const id = useId();
  if (style === 'filled') return null;
  if (!strokeAdjustable(style, kind)) {
    return (
      <Section title={t('customize.stroke')} divider={false}>
        <p className="text-xs leading-relaxed text-faint">
          {t('customize.strokeBrand')}
        </p>
      </Section>
    );
  }

  const stroke = strokeOf(look);
  const auto = look.strokeWidth === null;
  const pixelRatio = look.size / catalog.grid;
  const strokeText = fmtStroke(stroke, look.size);
  const tooltip = auto
    ? t('customize.strokeAutoHelp')
    : t('customize.strokeFixedHelp', { stroke: fmtStroke(stroke, catalog.grid) });

  return (
    <section className="px-5 py-2">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <RangeSlider
            id={id}
            label={t('customize.stroke')}
            min={STROKE_MIN}
            max={STROKE_MAX}
            step={STROKE_STEP}
            value={stroke}
            defaultValue={strokeOf({ ...look, strokeWidth: null })}
            valueText={auto ? t('customize.strokeAutoValue', { value: strokeText }) : strokeText}
            unit={t('customize.px')}
            tooltip={tooltip}
            onChange={(strokeWidth) => onChange({ strokeWidth })}
            field={{
              value: Number((stroke * pixelRatio).toFixed(2)),
              min: STROKE_MIN * pixelRatio,
              max: STROKE_MAX * pixelRatio,
              step: 'any',
              onChange: (pixels) => onChange({ strokeWidth: Math.min(STROKE_MAX, Math.max(STROKE_MIN, Number((pixels / pixelRatio).toFixed(6)))) }),
            }}
          />
        </div>
        {auto ? (
          <span className="shrink-0 rounded bg-sunken px-1.5 py-0.5 text-xs font-medium text-muted">{t('customize.strokeAuto')}</span>
        ) : (
          <button type="button" onClick={() => onChange({ strokeWidth: null })} className="shrink-0 text-xs font-medium text-brand hover:underline">
            {t('customize.strokeUseAuto')}
          </button>
        )}
      </div>
      {footnote}
    </section>
  );
}

/** Size, stroke, and color: shared by the grid-wide panel and the inspector. */
export function CustomizeControls({
  look, onChange, onThemeChange, style, kind = 'core', footnote, strokeFootnote, showSize = true, showStroke = true, animated = false, pairedColors = false, defaultTint = 16, collapsible = true, colorDivider = true,
}: {
  look: Look;
  onChange: (patch: Partial<Look>) => void;
  onThemeChange?: (theme: SiteTheme) => void;
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
  /** The Animated tab: adds the speed control under Stroke. */
  animated?: boolean;
  /** Pair Duocolor fields when the icon page has enough room. */
  pairedColors?: boolean;
  defaultTint?: number;
  collapsible?: boolean;
  colorDivider?: boolean;
}) {
  const { resolved: theme, setPreference } = useTheme();
  const { t } = useI18n();
  const { can } = usePlan();
  const duo = isDuo(style);
  const r = resolveLook(look, theme);
  const [swapCount, setSwapCount] = useState(0);
  const canDragPreset = !duo || can('duoColors') || can('modifiers');
  const setDuoColor = (role: DuoColorRole, choice: ColorChoice) => {
    onChange({ custom: { ...look.custom, [role]: choice } });
  };
  const currentChoice = (role: DuoColorRole): ColorChoice => look.custom?.[role] ?? { paletteName: r.themeName, role };

  return (
    <>
      {showSize && <SizeControl look={look} onChange={onChange} />}

      {showStroke && <StrokeControl look={look} onChange={onChange} style={style} kind={kind} footnote={strokeFootnote} />}

      {animated && <SpeedControl look={look} onChange={onChange} />}

      <Section
        title={t('customize.color')}
        collapsible={collapsible}
        divider={colorDivider}
        aside={(
          <Segmented
            label={t('customize.paletteVariant')}
            size="sm"
            value={r.mode}
            // Themes have light and dark variants, previewed on the matching background: switch the site theme.
            onChange={onThemeChange ?? setPreference}
            options={[
              { value: 'light', label: t('theme.light') },
              { value: 'ivory', label: t('theme.warm') },
              { value: 'dark', label: t('theme.dark') },
            ]}
          />
        )}
      >
        <div className="space-y-3">
          {/* One theme sets every style: a main color for Regular and Filled, primary and secondary for the duo styles. */}
          <div role="radiogroup" aria-label={t('customize.colorTheme')} className="grid grid-cols-[auto_repeat(8,minmax(0,2rem))] items-start justify-start gap-1">
            {VISIBLE_COLOR_THEMES.map((name) => {
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
                  data-tooltip={themeLabel}
                  draggable={canDragPreset}
                  onDragStart={canDragPreset ? (event) => {
                    event.dataTransfer.setData(PRESET_DRAG, name);
                    event.dataTransfer.effectAllowed = 'copy';
                  } : undefined}
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
                ? <div key={name} className="col-start-1 row-start-1 mr-1 border-r border-line pr-2">{swatch}</div>
                : swatch;
            })}
          </div>
          <TeachingTip tip="color" />
          {duo && !can('duoColors') ? (
            <UpgradePrompt feature="duoColors" />
          ) : duo ? (
            <>
              <div className={`relative grid gap-3 ${style === 'duotone'
                ? 'grid-cols-[minmax(0,1fr)_4.5rem]'
                : pairedColors ? '@min-[27rem]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]' : ''}`}>
                <ColorField
                  label={t('customize.primary')}
                  value={r.duo.primary}
                  onChange={(v) => setDuoColor('primary', v)}
                  onPresetDrop={(paletteName) => setDuoColor('primary', { paletteName, role: 'primary' })}
                />
                {style === 'duotone' && <TintField value={look.duotoneTint} authored={defaultTint} onChange={(duotoneTint) => onChange({ duotoneTint })} />}
                {style === 'duocolor' && (
                  <>
                    <button
                      type="button"
                      aria-label={t('customize.swapColors')}
                      data-tooltip={t('customize.swapColors')}
                      className={`absolute left-0.5 top-[calc(50%+0.5rem)] grid size-7 -translate-y-1/2 place-items-center rounded-lg text-ink transition hover:bg-sunken ${pairedColors
                        ? '@min-[27rem]:static @min-[27rem]:size-8 @min-[27rem]:translate-y-0 @min-[27rem]:self-end'
                        : ''}`}
                      onClick={() => {
                        onChange({ custom: { primary: currentChoice('secondary'), secondary: currentChoice('primary') } });
                        setSwapCount((count) => count + 1);
                      }}
                    >
                      <UiIcon
                        key={swapCount}
                        name={pairedColors ? 'arrows-swap-horizontal' : 'arrows-swap-vertical'}
                        className={`size-4 ${swapCount ? 'motion-safe:animate-[color-swap-feedback_240ms_ease-out]' : ''}`}
                      />
                    </button>
                    <ColorField
                      label={t('customize.secondary')}
                      value={r.duo.secondary}
                      onChange={(v) => setDuoColor('secondary', v)}
                      onPresetDrop={(paletteName) => setDuoColor('secondary', { paletteName, role: 'secondary' })}
                    />
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="max-w-color-picker">
              <ColorField
                label={t('customize.foreground')}
                value={r.mono}
                onChange={(v) => onChange({ mono: v })}
                onPresetDrop={(paletteName) => onChange({ mono: { paletteName, role: 'main' } })}
                hint={look.mono ? undefined : r.monoFollowsSite ? t('customize.followTheme') : t('customize.fromTheme', { theme: r.themeName })}
              />
            </div>
          )}
          {footnote}
        </div>
      </Section>
    </>
  );
}

/** The pane's content when no icon is selected. */
export function CustomizePanel({
  look, onChange, onReset, onClose, style, kind, headingId, animated = false, animatedSvgs = null,
}: {
  look: Look;
  onChange: (patch: Partial<Look>) => void;
  onReset: () => void;
  /** Mobile sheet only. */
  onClose?: () => void;
  style: StyleId;
  kind: 'core' | 'brand';
  headingId: string;
  /** The Animated tab: adds the speed control. */
  animated?: boolean;
  /** The Animated tab's artwork (already at the chosen speed), for its bulk download. */
  animatedSvgs?: Record<string, string> | null;
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
              className="h-7!"
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
      <CustomizeControls look={look} onChange={onChange} style={style} kind={kind} animated={animated} colorDivider={false} />
      {kind === 'core' && (animated ? <AnimatedDownloadSection look={look} svgs={animatedSvgs} /> : <DownloadSection look={look} />)}
    </div>
  );
}

/**
 * Download every icon in the chosen styles with the look set above, as one ZIP.
 * Bulk ZIPs need Pro; the paid styles need Pro too where billing is off.
 */
export function DownloadSection({ look }: { look: Look }) {
  const { t, list } = useI18n();
  const i18n = useI18n();
  const toast = useToast();
  const { can, enforced } = usePlan();
  const { resolved: theme } = useTheme();
  const uid = useId();
  const [chosen, setChosen] = useState<readonly StyleId[]>([FREE_ICON_STYLE]);
  const [busy, setBusy] = useState(false);
  const zip = can('zip');
  const open = (style: StyleId) => style === FREE_ICON_STYLE || can('styles');
  const styles = catalog.styles.filter((style) => chosen.includes(style) && open(style));
  const disabled = busy || !zip || styles.length === 0;
  const download = async () => {
    if (disabled) return;
    setBusy(true);
    try {
      const name = fullSetName(styles);
      // Modifier colors are an Advanced feature: without it, files keep the library's.
      const exported = can('modifiers') ? look : { ...look, modifierColor: null };
      downloadBlob(await buildFullSet(exported, theme, styles), name);
      toast('success', t('download.done', { file: name }));
    } catch (error) {
      toast('error', errorText(error, i18n, 'error.download'));
    } finally {
      setBusy(false);
    }
  };
  const toggle = (style: StyleId, on: boolean) => setChosen(on ? [...chosen, style] : chosen.filter((s) => s !== style));
  const label = busy ? t('download.preparing') : styles.length ? t('download.all') : t('download.none');
  const onlyFree = styles.length === 1 && styles[0] === FREE_ICON_STYLE;
  return (
    <section aria-labelledby={`${uid}-title`} className="border-t border-line px-5 pb-4 pt-5">
      <RailActions>{() => (
        <IconButton icon="download" label={label} onClick={download} disabled={disabled} />
      )}</RailActions>
      <h3 id={`${uid}-title`} className="font-sans text-xs font-semibold uppercase tracking-[0.08em] text-muted">{t('download.title')}</h3>
      <fieldset className="mt-4">
        <legend className="sr-only">{t('download.styles')}</legend>
        <div className="flex flex-wrap gap-1">
          {catalog.styles.map((style) => {
            const free = style === FREE_ICON_STYLE;
            const available = open(style);
            const checked = available && chosen.includes(style);
            return (
              <label key={style} className={`button-corners relative inline-flex h-7 min-w-0 max-w-24 flex-1 select-none items-center justify-center gap-1 bg-sunken px-2 text-xs font-medium text-muted ${
                available ? 'cursor-pointer hover:text-ink has-[:checked]:bg-brand-soft has-[:checked]:text-brand has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/40' : 'cursor-not-allowed opacity-55'
              }`}>
                <input type="checkbox" name="download-style" value={style} className="sr-only" disabled={!available} checked={checked}
                  aria-description={free ? t('icons.free') : available ? undefined : t(enforced ? 'upgrade.styles' : 'download.premiumSoon')} onChange={(event) => toggle(style, event.target.checked)} />
                <UiIcon name={available ? (checked ? 'check' : 'plus') : 'crown-simple'} className="size-3" />
                {t(`style.${style}`)}
                {free && <span aria-hidden="true" className={freeBadgeClass}>{t('icons.free')}</span>}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="mt-3 flex gap-2">
        <Button
          variant="primary"
          icon="download"
          onClick={download}
          disabled={disabled}
          aria-describedby={`${uid}-note`}
          className="min-w-0 flex-1 disabled:cursor-wait"
        >
          <span className="truncate">{label}</span>
        </Button>
      </div>
      <p id={`${uid}-note`} className="mt-1.5 text-xs leading-relaxed text-faint">
        {onlyFree || !styles.length
          ? t('download.note')
          : t('download.noteStyles', { styles: list(styles.map((s) => t(`style.${s}`))) })}
        {enforced || can('styles') ? null : <> {t('download.premiumSoon')}</>}
      </p>
      {!zip && <UpgradePrompt feature="zip" className="mt-1.5 text-xs leading-relaxed text-muted" />}
    </section>
  );
}

/** The Animated tab's bulk download: every animated icon as live SVG or looping GIF, in the chosen look and speed. */
export function AnimatedDownloadSection({ look, svgs }: { look: Look; svgs: Record<string, string> | null }) {
  const i18n = useI18n();
  const { t, n } = i18n;
  const toast = useToast();
  const { can } = usePlan();
  const { resolved: theme } = useTheme();
  const uid = useId();
  const [format, setFormat] = useState<'svg' | 'gif'>('svg');
  const [progress, setProgress] = useState<number | null>(null);
  const busy = progress !== null;
  const unlocked = can('animated');
  const names = svgs ? Object.keys(svgs).sort() : [];
  const disabled = busy || !unlocked || !names.length;
  const file = `fos-icons-animated-${format}.zip`;
  const download = async () => {
    if (disabled || !svgs) return;
    setProgress(0);
    try {
      const sourceStroke = opticalStroke(artworkSize(look));
      // GIFs are pixels: render them at 2x so they stay sharp.
      const px = format === 'gif' ? look.size * 2 : look.size;
      const entries: { name: string; data: string | Uint8Array }[] = [];
      for (const [i, name] of names.entries()) {
        const svg = buildSvg(svgs[name], { ...exportColors(svgs[name], 'regular', look, theme), size: px, strokeWidth: strokeOf(look), sourceStroke });
        if (format === 'svg') entries.push({ name: `${name}-animated.svg`, data: svg });
        else {
          const { svgToGif } = await import('../lib/gif');
          entries.push({ name: `${name}-animated-${px}px.gif`, data: new Uint8Array(await (await svgToGif(svg, px)).arrayBuffer()) });
          setProgress(i + 1);
        }
      }
      downloadBlob(await buildZip(entries), file);
      toast('success', t('download.done', { file }));
    } catch (error) {
      toast('error', errorText(error, i18n, 'error.download'));
    } finally {
      setProgress(null);
    }
  };
  const label = busy
    ? (format === 'gif' ? t('download.making', { done: n(progress ?? 0), count: n(names.length) }) : t('download.preparing'))
    : t(format === 'gif' ? 'download.animatedGif' : 'download.animated');
  return (
    <section aria-labelledby={`${uid}-title`} className="border-t border-line px-5 pb-4 pt-5">
      <RailActions>{() => (
        <IconButton icon="download" label={label} onClick={download} disabled={disabled} />
      )}</RailActions>
      <h3 id={`${uid}-title`} className="font-sans text-xs font-semibold uppercase tracking-[0.08em] text-muted">{t('download.title')}</h3>
      <div className="mt-3">
        <Segmented
          label={t('download.animatedFormat')}
          size="sm"
          value={format}
          onChange={setFormat}
          options={[{ value: 'svg', label: 'SVG' }, { value: 'gif', label: 'GIF' }]}
        />
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="primary" icon="download" onClick={download} disabled={disabled} aria-describedby={`${uid}-note`} className="min-w-0 flex-1 disabled:cursor-wait">
          <span className="truncate">{label}</span>
        </Button>
      </div>
      <p id={`${uid}-note`} className="mt-1.5 text-xs leading-relaxed text-faint">
        {t(format === 'gif' ? 'download.animatedGifNote' : 'download.animatedNote', { count: n(names.length) })}
      </p>
      {!unlocked && <UpgradePrompt feature="animated" fallback={t('download.premiumSoon')} className="mt-1.5 text-xs leading-relaxed text-muted" />}
    </section>
  );
}
