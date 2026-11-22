import type { SiteTheme } from './theme';
import { LocalizedError } from '../i18n/errors';
import { catalog, loadStyle, lock, opticalStroke, STYLE_META, type IconEntry, type StyleId } from './catalog';
import { artworkSize, DEFAULT_LOOK, exportColors, INK_THEME, resolveLook, strokeAdjustable, strokeOf, type Look } from './look';
import { buildSvg } from './svg';
import { buildZip, type ZipEntry } from './zip';

/**
 * File name of the set, e.g. `fos-icons-2afb7bb.zip` for every style, or
 * `fos-icons-2afb7bb-duotone.zip` for some of them.
 */
export const fullSetName = (styles: readonly StyleId[] = catalog.styles) => {
  const base = `fos-icons-${lock.revision ? lock.revision.slice(0, 7) : 'snapshot'}`;
  const all = catalog.styles.every((s) => styles.includes(s));
  return all ? `${base}.zip` : `${base}-${catalog.styles.filter((s) => styles.includes(s)).map((s) => STYLE_META[s].slug).join('-')}.zip`;
};

export const categorySetName = (slug: string) => `fos-icons-${slug}-${lock.revision?.slice(0, 7) ?? 'snapshot'}.zip`;

/**
 * Every core icon in the chosen styles (all four by default) with the chosen
 * look, plus the license:
 * each file at the chosen size, with the chosen stroke (styles that have
 * strokes), and in the chosen colors. With the default colors (Ink theme,
 * nothing hand-picked) files keep `currentColor` and the `--fos-*` variables,
 * so they still restyle in code. Folders use the public style names:
 * regular/, solid/, duocolor/, duotone/.
 */
export function buildFullSet(
  look: Look = DEFAULT_LOOK,
  theme: SiteTheme = 'light',
  only: readonly StyleId[] = catalog.styles,
): Promise<Blob> {
  return buildIconSet(catalog.icons, catalog.styles.filter((s) => only.includes(s)), look, theme);
}

/** One category in every style at the library's native size and colors. */
export function buildCategorySet(category: string): Promise<Blob> {
  const icons = catalog.icons.filter((icon) => icon.category === category);
  return buildIconSet(icons, catalog.styles, { ...DEFAULT_LOOK, size: catalog.grid }, 'light', category);
}

async function buildIconSet(
  icons: readonly IconEntry[], styles: readonly StyleId[], look: Look, theme: SiteTheme, category?: string,
): Promise<Blob> {
  const [maps, license] = await Promise.all([
    // Each icon is drawn from the optical size nearest the export size.
    Promise.all(styles.map((style) => loadStyle(style, artworkSize(look)))),
    fetch(`${import.meta.env.BASE_URL}licenses/fos-icons-LICENSE.txt`).then((res) => {
      if (!res.ok) throw new LocalizedError('error.loadLicense', { status: String(res.status) });
      return res.text();
    }),
  ]);
  const entries: ZipEntry[] = [{ name: 'LICENSE.txt', data: license }];
  const r = resolveLook(look, theme);
  const keepColors = theme !== 'ivory' && r.monoFollowsSite && look.custom === null && look.modifierColor === null;
  const stroke = strokeOf(look);
  styles.forEach((style, i) => {
    const slug = STYLE_META[style].slug;
    for (const icon of icons) {
      const source = maps[i][icon.name];
      if (!source) throw new LocalizedError('error.missingArtwork', { style: STYLE_META[style].label, icon: icon.name });
      const svg = buildSvg(source, {
        ...(keepColors ? { primary: 'currentColor', keepColors: true } : exportColors(source, style, look, theme)),
        size: look.size,
        strokeWidth: strokeAdjustable(style) ? stroke : undefined,
        sourceStroke: opticalStroke(artworkSize(look)),
      });
      entries.push({ name: `${slug}/${icon.name}.svg`, data: svg });
    }
  });
  entries.push({
    name: 'README.txt',
    data: [
      category ? `Fos Icons — ${category}` : 'Fos Icons',
      '',
      `${icons.length} core icons in ${styles.map((s) => STYLE_META[s].label).join(', ')}.`,
      `Source: https://github.com/${lock.repository}${lock.revision ? ` at ${lock.revision}` : ''}`,
      `License: ${catalog.license} (see LICENSE.txt). Brand icons are not included.`,
      '',
      `Size: ${look.size}px, drawn from the ${artworkSize(look)}px optical size. Stroke: ${Number(stroke.toFixed(3))}px on the 24px grid (Regular, Duocolor, Duotone; Solid has none).`,
      keepColors
        ? 'Colors: as authored. Regular and Solid use currentColor; Duocolor and Duotone use --fos-primary and --fos-secondary.'
        : `Colors: ${look.paletteName === INK_THEME ? 'Ink' : look.paletteName} theme${look.mono || look.custom ? ' with your own colors' : ''} (${theme}).`,
      '',
    ].join('\n'),
  });
  return buildZip(entries);
}
