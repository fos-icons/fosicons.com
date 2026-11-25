import ivory from '../data/ivory.json';
import type { SiteTheme } from './theme';
import { catalog, opticalSize, opticalStroke, palettes, type StyleId } from './catalog';
import { hasModifierRole, hasSecondaryRole, isDuo, prepareGridSvg, type SvgColorOptions } from './svg';

/**
 * How icons are drawn across the grid, the side pane previews, and exports.
 * `null` colors follow the site theme until the user picks one.
 */
export interface Look {
  size: number;
  /** Stroke in 24px grid units, or `null` to follow the size (see `autoStroke`). */
  strokeWidth: number | null;
  /** Regular/Solid color chosen by hand, or `null` to take it from the color theme. */
  mono: string | null;
  /** The color theme: `INK_THEME` or a library palette name. */
  paletteName: string;
  custom: { primary: string; secondary: string } | null;
  /** Modifier (badge) color, or `null` for the default: the library's color in duo styles, the icon's color otherwise. */
  modifierColor: string | null;
}

export const DEFAULT_LOOK: Look = {
  size: 32,
  strokeWidth: null,
  mono: null,
  paletteName: 'Ink',
  custom: null,
  modifierColor: null,
};

/**
 * Color themes. Each sets every style at once: a main color for Regular and
 * Solid, plus primary and secondary for Duocolor and Duotone. "Ink" keeps
 * Regular and Solid in the site's ink (following light/dark) with the
 * library's default duo palette; every other theme is a library palette
 * whose primary is also the main color.
 */
export const INK_THEME = 'Ink';
export const THEME_NAMES: readonly string[] = [INK_THEME, ...palettes.palettes.map((p) => p.name)];

/** A theme's colors in one site mode. */
export function themeColors(name: string, mode: SiteTheme) {
  if (name === INK_THEME && mode === 'ivory') {
    return { main: ivory.foreground, primary: ivory['duo-primary'], secondary: ivory['duo-secondary'] };
  }
  const variant = mode === 'dark' ? 'dark' : 'light';
  const palette = palettes.palettes.find((p) => p.name === (name === INK_THEME ? palettes.defaultPalette : name)) ?? palettes.palettes[0];
  return { main: name === INK_THEME ? INK[variant] : palette[variant].primary, ...palette[variant] };
}

/**
 * Size slider range: what the grid can preview. The px field still accepts
 * MIN_SIZE..MAX_SIZE for exports.
 */
export const SIZE_SLIDER_MIN = 16;
export const SIZE_STEP = 4;
export const MIN_SIZE = 8;
export const MAX_SIZE = 512;
export const STROKE_MIN = 0.5;
export const STROKE_MAX = 2.5;
export const STROKE_STEP = 0.05;
/** The grid shows icons at the chosen size up to this, so cells stay legible. */
export const GRID_MAX_SIZE = 64;
export const SIZE_SLIDER_MAX = GRID_MAX_SIZE;

/**
 * Size-linked stroke, in 24px grid units: each optical size's designed
 * stroke (1px at 16, 1.25px at 24, 1.5px at 32, 2px at 48, 2.5px at 64; that
 * is 1.5, 1.25, 1.125, 1 and 0.9375 grid units), linear in between and held
 * beyond the smallest and largest. At an optical size the artwork is drawn
 * exactly as designed.
 */
export const STROKE_ANCHORS: readonly { size: number; stroke: number }[] =
  [...catalog.sizes].sort((a, b) => a - b).map((size) => ({ size, stroke: opticalStroke(size) }));
export function exactAutoStroke(size: number): number {
  const first = STROKE_ANCHORS[0];
  const last = STROKE_ANCHORS[STROKE_ANCHORS.length - 1];
  if (size <= first.size) return first.stroke;
  if (size >= last.size) return last.stroke;
  const i = STROKE_ANCHORS.findIndex((a) => a.size >= size);
  const a = STROKE_ANCHORS[i - 1];
  const b = STROKE_ANCHORS[i];
  return a.stroke + ((size - a.size) * (b.stroke - a.stroke)) / (b.size - a.size);
}

/** The auto stroke on the slider's 0.05 steps, for a stroke chosen by hand from it. */
export function autoStroke(size: number): number {
  const stepped = Math.round(Math.round(exactAutoStroke(size) / STROKE_STEP) * STROKE_STEP * 100) / 100;
  return Math.min(STROKE_MAX, Math.max(STROKE_MIN, stepped));
}

/** The stroke actually drawn and exported for this look. */
export const strokeOf = (look: Look) => look.strokeWidth ?? exactAutoStroke(look.size);

/** The optical size whose artwork draws this look. */
export const artworkSize = (look: Look) => opticalSize(look.size);

const scaleText = (value: number) => String(Math.round(value * 10000) / 10000);
/** Grid stroke scale for the artwork drawing this look (its own optical size). */
const gridStrokeScale = (look: Look) => scaleText(strokeOf(look) / opticalStroke(artworkSize(look)));

/** The optical size the default grid draws from. */
export const DEFAULT_ARTWORK_SIZE = artworkSize(DEFAULT_LOOK);

/**
 * Standalone thumbnails (landing pages) draw the same artwork, at the same
 * stroke, as the default interactive grid. `source` is the
 * DEFAULT_ARTWORK_SIZE artwork.
 */
export const defaultGridSvg = (source: string) => prepareGridSvg(source, gridStrokeScale(DEFAULT_LOOK));

export const INK = { light: '#212121', dark: '#F2F2F2' } as const;

/** Solid silhouettes and brand marks are drawn as authored: no stroke control. */
export const strokeAdjustable = (style: StyleId, kind: 'core' | 'brand' = 'core') =>
  kind === 'core' && style !== 'filled';

export function resolveLook(look: Look, theme: SiteTheme) {
  // Themes use the variant for the site theme being previewed.
  const mode = theme;
  const colors = themeColors(look.paletteName, mode);
  return {
    mono: look.mono ?? colors.main,
    /** True when Regular/Solid simply follow the site's ink (Ink theme, no hand-picked color). */
    monoFollowsSite: look.mono === null && look.paletteName === INK_THEME,
    mode,
    themeName: THEME_NAMES.includes(look.paletteName) ? look.paletteName : INK_THEME,
    duo: look.custom ?? { primary: colors.primary, secondary: colors.secondary },
  };
}

export const isCustomized = (look: Look) =>
  look.size !== DEFAULT_LOOK.size
  || look.strokeWidth !== DEFAULT_LOOK.strokeWidth
  || look.mono !== null
  || look.custom !== null
  || look.modifierColor !== null
  || look.paletteName !== DEFAULT_LOOK.paletteName;

/** CSS variables that restyle inline grid SVGs without rebuilding them. */
export function gridVars(look: Look, style: StyleId, theme: SiteTheme, kind: 'core' | 'brand' = 'core') {
  const r = resolveLook(look, theme);
  const vars: Record<string, string> = {
    '--glyph-size': `${Math.min(look.size, GRID_MAX_SIZE)}px`,
    '--stroke-scale': strokeAdjustable(style, kind) ? gridStrokeScale(look) : '1',
  };
  if (isDuo(style)) {
    vars['--fos-primary'] = r.duo.primary;
    vars['--fos-secondary'] = r.duo.secondary;
  } else if (!r.monoFollowsSite) {
    // A variable, not `color`: grid cells set their own ink color, which would win over an inherited one.
    vars['--glyph-color'] = r.mono;
  }
  // Library icons with a modifier role pick up the chosen modifier color in the grid too.
  if (look.modifierColor) vars['--fos-modifier'] = look.modifierColor;
  return vars;
}

/**
 * Concrete export colors for one icon under this look. Secondary is only
 * applied where the artwork has that role; modifier glyphs keep the
 * library default unless an override is given.
 */
export function exportColors(
  source: string,
  style: StyleId,
  look: Look,
  theme: SiteTheme,
  modifierOverride?: string | null,
): SvgColorOptions {
  const r = resolveLook(look, theme);
  const duo = isDuo(style);
  const modifierDefault = source.match(/var\(--fos-modifier,\s*(#[0-9a-fA-F]{3,8})\)/)?.[1]?.toUpperCase();
  return {
    primary: duo ? r.duo.primary : r.mono,
    secondary: duo && hasSecondaryRole(source) ? r.duo.secondary : undefined,
    modifier: hasModifierRole(source) ? (modifierOverride ?? look.modifierColor ?? modifierDefault ?? undefined) : undefined,
  };
}
