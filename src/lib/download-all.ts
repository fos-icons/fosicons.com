import { LocalizedError } from '../i18n/errors';
import { catalog, loadStyle, lock, STYLE_META, type StyleId } from './catalog';
import { DEFAULT_LOOK, exportColors, INK_THEME, resolveLook, strokeAdjustable, strokeOf, type Look } from './look';
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

/**
 * Every core icon in the chosen styles (all four by default) with the chosen
 * look, plus the license:
 * each file at the chosen size, with the chosen stroke (styles that have
 * strokes), and in the chosen colors. With the default colors (Ink theme,
 * nothing hand-picked) files keep `currentColor` and the `--fos-*` variables,
 * so they still restyle in code. Folders use the public style names:
 * regular/, solid/, duocolor/, duotone/.
 */
export async function buildFullSet(
  look: Look = DEFAULT_LOOK,
  theme: 'light' | 'dark' = 'light',
  only: readonly StyleId[] = catalog.styles,
): Promise<Blob> {
  const styles = catalog.styles.filter((s) => only.includes(s));
  const [maps, license] = await Promise.all([
    Promise.all(styles.map(loadStyle)),
    fetch(`${import.meta.env.BASE_URL}licenses/fos-icons-LICENSE.txt`).then((res) => {
      if (!res.ok) throw new LocalizedError('error.loadLicense', { status: String(res.status) });
      return res.text();
    }),
  ]);
  const entries: ZipEntry[] = [{ name: 'LICENSE.txt', data: license }];
  const r = resolveLook(look, theme);
  const keepColors = r.monoFollowsSite && look.custom === null && look.modifierColor === null;
  const stroke = strokeOf(look);
  styles.forEach((style, i) => {
    const slug = STYLE_META[style].slug;
    for (const icon of catalog.icons) {
      const source = maps[i][icon.name];
      if (!source) continue;
      const svg = buildSvg(source, {
        ...(keepColors ? { primary: 'currentColor', keepColors: true } : exportColors(source, style, look, theme)),
        size: look.size,
        strokeWidth: strokeAdjustable(style) ? stroke : undefined,
      });
      entries.push({ name: `${slug}/${icon.name}.svg`, data: svg });
    }
  });
  entries.push({
    name: 'README.txt',
    data: [
      'Fos Icons',
      '',
      `${catalog.icons.length} core icons in ${styles.map((s) => STYLE_META[s].label).join(', ')}.`,
      `Source: https://github.com/${lock.repository}${lock.revision ? ` at ${lock.revision}` : ''}`,
      `License: ${catalog.license} (see LICENSE.txt). Brand icons are not included.`,
      '',
      `Size: ${look.size}px. Stroke: ${stroke}px on the 24px grid (Regular, Duocolor, Duotone; Solid has none).`,
      keepColors
        ? 'Colors: as authored. Regular and Solid use currentColor; Duocolor and Duotone use --fos-primary and --fos-secondary.'
        : `Colors: ${look.paletteName === INK_THEME ? 'Ink' : look.paletteName} theme${look.mono || look.custom ? ' with your own colors' : ''} (${theme}).`,
      '',
    ].join('\n'),
  });
  return buildZip(entries);
}
