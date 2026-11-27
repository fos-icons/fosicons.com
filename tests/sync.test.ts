import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { catalog, chunksFor, ICON_CHUNK } from '../src/lib/catalog';
import { orderBrowseIcons } from '../src/lib/browse-order';
// @ts-expect-error plain ESM script without types
import { buildOutputs, catalogMetadata, UI_ICONS } from '../scripts/sync-icons.mjs';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const STYLES = ['regular', 'filled', 'duocolor', 'duotone'];

function fakeLibrary(tamper = false) {
  const dir = mkdtempSync(join(tmpdir(), 'fos-lib-'));
  const names = [...UI_ICONS, 'widget'];
  const icons = names.map((name: string) => {
    const files: Record<string, string> = {};
    const digests: Record<string, string> = {};
    for (const style of STYLES) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0" stroke="currentColor"/><title>${name}</title></svg>`;
      mkdirSync(join(dir, 'icons', style), { recursive: true });
      writeFileSync(join(dir, 'icons', style, `${name}.svg`), svg);
      files[style] = `icons/${style}/${name}.svg`;
      digests[style] = sha(svg);
    }
    return { name, category: 'Essentials', tags: [], aliases: [], files, sha256: digests };
  });
  if (tamper) writeFileSync(join(dir, 'icons/regular/widget.svg'), '<svg/>');
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ license: 'MIT', grid: 24, regularStrokeWidth: 1.25, styles: STYLES, iconCount: icons.length, icons }));
  mkdirSync(join(dir, 'metadata'));
  writeFileSync(join(dir, 'metadata/modifiers.json'), JSON.stringify({ modifiers: [] }));
  writeFileSync(join(dir, 'metadata/colors.json'), JSON.stringify({ defaultPalette: 'Blue', palettes: [] }));
  writeFileSync(join(dir, 'LICENSE'), 'MIT');
  return dir;
}

describe('asset synchronization', () => {
  it('produces deterministic output with counts taken from the manifest', () => {
    const dir = fakeLibrary();
    const a = buildOutputs(dir);
    const b = buildOutputs(dir);
    expect(a).toEqual(b);
    const catalog = JSON.parse(a['src/data/catalog.json']);
    expect(catalog.icons).toHaveLength(UI_ICONS.length + 1);
    expect(catalog.categories).toEqual([{ name: 'Essentials', count: UI_ICONS.length + 1 }]);
    expect(Object.keys(JSON.parse(a['public/icons/duotone.json']))).toContain('widget');
  });

  it('rejects an asset whose digest does not match the manifest', () => {
    expect(() => buildOutputs(fakeLibrary(true))).toThrow(/SHA-256 mismatch/);
  });

  it('ships only summary data and locates preview artwork in the synced chunks', () => {
    const catalog = JSON.parse(readFileSync(join(__dirname, '../src/data/catalog.json'), 'utf8'));
    const brands = JSON.parse(readFileSync(join(__dirname, '../src/data/brands.json'), 'utf8'));
    const summary = JSON.parse(readFileSync(join(__dirname, '../src/data/catalog-meta.json'), 'utf8'));
    expect(summary).toEqual(catalogMetadata(catalog, brands.approved.map(({ name }: { name: string }) => name)));
    expect(summary).not.toHaveProperty('icons');
    for (const name of [...summary.examples, 'calendar-add']) {
      const chunk = JSON.parse(readFileSync(join(__dirname, '../public/icons/regular', `${summary.sampleChunks[name]}.json`), 'utf8'));
      expect(chunk).toHaveProperty(name);
    }
  });

  it('puts neighboring browse icons in the same chunk at every style and optical size', () => {
    const browseNames = orderBrowseIcons(catalog.icons).map(({ name }) => name);
    expect(chunksFor(browseNames.slice(0, ICON_CHUNK))).toEqual([0]);
    for (const style of STYLES) {
      for (const size of catalog.sizes) {
        const folder = size === catalog.grid ? style : `${size}/${style}`;
        for (let offset = 0; offset < browseNames.length; offset += ICON_CHUNK) {
          const names = browseNames.slice(offset, offset + ICON_CHUNK);
          const [chunk] = chunksFor(names);
          const artwork = JSON.parse(readFileSync(join(__dirname, '../public/icons', folder, `${chunk}.json`), 'utf8'));
          expect(Object.keys(artwork)).toEqual(names);
        }
      }
    }
  });

  it('matches the committed snapshot lock', () => {
    const lock = JSON.parse(readFileSync(join(__dirname, '../src/data/source-lock.json'), 'utf8'));
    for (const style of STYLES) {
      const body = readFileSync(join(__dirname, '../public/icons', `${style}.json`), 'utf8');
      expect(sha(body)).toBe(lock.snapshotSha256[style]);
    }
  });

  it('ships the curated check separately for success toasts', () => {
    const icons = JSON.parse(readFileSync(join(__dirname, '../public/icons/animated.json'), 'utf8'));
    const toast = JSON.parse(readFileSync(join(__dirname, '../src/data/ui-animated-check.json'), 'utf8'));
    expect(toast.check).toContain('@keyframes');
    expect(toast).toEqual({ check: icons.check });
  });
});
