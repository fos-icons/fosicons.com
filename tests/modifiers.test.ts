import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import catalog from '../src/data/catalog.json';
import { composeSvg, initialCorner, MODIFIER_SCALE, type Corner, type ModifierAsset } from '../src/lib/modifiers';

const pub = (file: string) => JSON.parse(readFileSync(join(__dirname, '../public', file), 'utf8'));
const modifiers: ModifierAsset[] = pub('modifiers.json').modifiers;
const byName = new Map(modifiers.map((m) => [m.name, m]));
const STYLES = ['regular', 'filled', 'duocolor', 'duotone'] as const;
const sources = Object.fromEntries(STYLES.map((s) => [s, pub(`icons/${s}.json`) as Record<string, string>]));

/** Structure and paint, with IDs and number formatting normalized. */
function canonical(svg: string): string[] {
  const root = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
  const num = (v: string) => v.replace(/-?\d*\.?\d+(e-?\d+)?/g, (n) => String(Math.round(Number(n) * 1000) / 1000));
  return [root, ...Array.from(root.querySelectorAll('*'))].map((node) => {
    const attrs = Array.from(node.attributes)
      .filter((a) => a.name !== 'id' && a.name !== 'xmlns')
      .map((a) => `${a.name}=${num(a.value.replace(/url\(#[^)]+\)/g, 'url(#)'))}`)
      .sort();
    return `${node.localName}[${attrs.join(' ')}]`;
  });
}

// Authored single-modifier compositions the library composed without refitting the base.
const authored = (catalog.icons as { name: string; composition?: { base: string; modifiers: { name: string; position: string }[] } }[])
  .filter((i) => i.composition?.modifiers.length === 1);

describe('modifier composition', () => {
  it('ships every library modifier with at least one corner', () => {
    expect(modifiers.length).toBe(Object.keys(catalog.modifiers).length);
    for (const m of modifiers) expect(m.positions[initialCorner(m)]).toBeTruthy();
  });

  it('reproduces the library’s authored compositions in every style', () => {
    let matched = 0;
    for (const icon of authored) {
      const { base, modifiers: [mod] } = icon.composition!;
      for (const style of STYLES) {
        const expected = canonical(sources[style][icon.name]);
        // Compare only output of the library's compose tool, without a refitted base.
        if (!expected[2]?.startsWith('clipPath[') || /^svg\[[^\]]*\bx=/.test(expected[5] ?? '')) continue;
        const composed = composeSvg(sources[style][base], byName.get(mod.name)!, mod.position as Corner, style);
        expect(canonical(composed), `${icon.name} ${style}`).toEqual(expected);
        matched += 1;
      }
    }
    expect(matched).toBeGreaterThan(200);
  });

  it('resizes the badge and its gap together, never past a quarter of the icon', () => {
    const add = byName.get('add')!;
    const base = sources.regular.bell;
    // 1 is the library's own composition; the scale only appears when it changes.
    expect(composeSvg(base, add, 'top-left', 'regular', 1)).toBe(composeSvg(base, add, 'top-left', 'regular'));
    const bigger = composeSvg(base, add, 'top-left', 'regular', 1.1);
    expect(bigger).toContain('scale(1.1)');
    expect(bigger).toContain('<mask');
    // A 10×10 badge at 1.2 is 12×12: a quarter of the 24px grid. Larger requests are capped there.
    expect(MODIFIER_SCALE.max).toBe(1.2);
    expect(composeSvg(base, add, 'top-left', 'regular', 2)).toBe(composeSvg(base, add, 'top-left', 'regular', MODIFIER_SCALE.max));
    expect(composeSvg(base, add, 'top-left', 'regular', 0.1)).toBe(composeSvg(base, add, 'top-left', 'regular', MODIFIER_SCALE.min));
  });

  it('can give the badge its own color role in Regular, defaulting to the icon color', async () => {
    const { buildSvg } = await import('../src/lib/svg');
    const add = byName.get('add')!;
    const composed = composeSvg(sources.regular.bell, add, 'top-left', 'regular', 1, true);
    expect(composed).toContain('var(--fos-modifier, currentColor)');
    // Without a chosen color the badge follows the icon; with one, it takes it.
    expect(buildSvg(composed, { primary: '#212121', size: 24 })).not.toContain('#D93025');
    expect(buildSvg(composed, { primary: '#212121', modifier: '#D93025', size: 24 })).toContain('#D93025');
  });

  it('refuses a corner the modifier does not support', () => {
    const pdf = byName.get('pdf')!;
    expect(() => composeSvg(sources.regular.file, pdf, 'top-right', 'regular')).toThrow(/top right/);
  });
});
