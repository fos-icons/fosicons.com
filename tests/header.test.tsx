import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DownloadSection } from '../src/components/Customize';
import { HeroActions } from '../src/components/HeaderActions';
import { DEFAULT_LOOK, type Look } from '../src/lib/look';
import { Layout } from '../src/components/Layout';
import { ToastProvider } from '../src/components/ui';
import { catalog, lock, resetStyleCache } from '../src/lib/catalog';
import { ThemeProvider } from '../src/lib/theme';
import { styleSvgs } from './helpers';

const license = readFileSync(join(__dirname, '../public/licenses/fos-icons-LICENSE.txt'), 'utf8');
const fetchMock = vi.fn(async (url: string) => {
  if (url.endsWith('fos-icons-LICENSE.txt')) return new Response(license, { status: 200 });
  const style = /icons\/(\w+)\.json/.exec(url)![1] as 'regular';
  return new Response(JSON.stringify(styleSvgs(style)), { status: 200 });
});

let downloadLook: Look = DEFAULT_LOOK;

function renderAt(url: string) {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<><HeroActions /><DownloadSection look={downloadLook} /></>} />
              <Route path="/docs" element={<h1>Documentation</h1>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => { resetStyleCache(); fetchMock.mockClear(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Header actions', () => {
  it.each(['/', '/docs'])('does not show a theme-cycling button on %s', (url) => {
    renderAt(url);
    expect(within(screen.getByRole('banner')).queryByRole('button', { name: /^Theme:/ })).toBeNull();
  });

  it('links Figma from the header and Get started from the home page', () => {
    renderAt('/');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    // Get started and Download are buttons under the home intro, not header links.
    expect(within(nav).queryByRole('link', { name: /Get started/ })).toBeNull();
    expect(within(nav).queryByRole('button', { name: /Download/ })).toBeNull();
    const start = within(screen.getByRole('main')).getByRole('link', { name: /Get started/ });
    expect(start.getAttribute('href')).toBe('https://github.com/fos-icons');
    expect(start.getAttribute('target')).toBe('_blank');
    const figma = within(nav).getByRole('link', { name: /^Figma/ });
    expect(figma.getAttribute('href')).toMatch(/^https:\/\/www\.figma\.com\/design\/5zcUV9E4Bu8FSssDfhyOWw\//);
    expect(figma.getAttribute('target')).toBe('_blank');
    expect(within(nav).queryByRole('link', { name: /Pricing/ })).toBeNull();
  });

  it('links to Docs from the header and marks it current', async () => {
    const user = userEvent.setup();
    renderAt('/');
    const docs = within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Docs' });
    expect(docs.getAttribute('href')).toBe('/docs');
    await user.click(docs);
    expect(await screen.findByRole('heading', { name: 'Documentation' })).toBeTruthy();
    expect(docs.getAttribute('aria-current')).toBe('page');
  });

  it('rejects a full-set download when a cached snapshot is missing a catalog icon', async () => {
    const { buildFullSet } = await import('../src/lib/download-all');
    const partial = { ...styleSvgs('regular') };
    delete partial.tornado;
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      new Response(url.endsWith('fos-icons-LICENSE.txt') ? license : JSON.stringify(partial)),
    ));
    await expect(buildFullSet(DEFAULT_LOOK, 'light', ['regular'])).rejects.toThrow(/Regular artwork for tornado is missing/);
  });

  it('Download all builds a ZIP of every core icon in every style with the chosen look, plus the license', async () => {
    const user = userEvent.setup();
    let blob: Blob | null = null;
    let filename = '';
    vi.stubGlobal('URL', Object.assign(URL, {
      createObjectURL: (b: Blob) => { blob = b; return 'blob:test'; },
      revokeObjectURL: () => {},
    }));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { filename = this.download; });
    downloadLook = { ...DEFAULT_LOOK, size: 56, strokeWidth: 0.75, mono: '#D93025' };
    renderAt('/');
    await user.click(within(screen.getByRole('main')).getByRole('button', { name: 'Download all icons' }));
    await screen.findByText(/^Downloaded fos-icons-/);
    downloadLook = DEFAULT_LOOK;
    expect(filename).toBe(`fos-icons-${lock.revision!.slice(0, 7)}.zip`);

    const { unzipSync, strFromU8 } = await import('fflate');
    const bytes = await new Promise<ArrayBuffer>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.readAsArrayBuffer(blob!);
    });
    const files = unzipSync(new Uint8Array(bytes));
    const names = Object.keys(files);
    expect(names.filter((n) => n.endsWith('.svg'))).toHaveLength(catalog.icons.length * catalog.styles.length);
    for (const folder of ['regular', 'solid', 'duocolor', 'duotone']) {
      expect(names).toContain(`${folder}/search.svg`);
    }
    // Files carry the chosen size, stroke (0.75 of the drawn 1.25), and color.
    const regular = strFromU8(files['regular/search.svg']);
    expect(regular).toContain('width="56"');
    expect(regular).toContain('stroke-width="0.75"');
    expect(regular).toContain('#D93025');
    expect(regular).not.toContain('currentColor');
    expect(strFromU8(files['LICENSE.txt'])).toBe(license);
    expect(strFromU8(files['README.txt'])).toMatch(/Size: 56px\. Stroke: 0\.75px/);
  });

  it('downloads only the styles left switched on', async () => {
    const user = userEvent.setup();
    let filename = '';
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} }));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { filename = this.download; });
    renderAt('/');
    const main = within(screen.getByRole('main'));
    for (const style of ['Regular', 'Solid', 'Duocolor']) await user.click(main.getByRole('checkbox', { name: style }));
    await user.click(main.getByRole('button', { name: 'Download Duotone' }));
    await screen.findByText(/^Downloaded fos-icons-/);
    expect(filename).toBe(`fos-icons-${lock.revision!.slice(0, 7)}-duotone.zip`);
    await user.click(main.getByRole('checkbox', { name: 'Duotone' }));
    expect((main.getByRole('button', { name: 'Choose at least one style' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('keeps authored colors in the ZIP while the colors are the defaults', async () => {
    const { buildFullSet } = await import('../src/lib/download-all');
    const { unzipSync, strFromU8 } = await import('fflate');
    const blob = await buildFullSet(DEFAULT_LOOK, 'light');
    const bytes = await new Promise<ArrayBuffer>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.readAsArrayBuffer(blob);
    });
    const files = unzipSync(new Uint8Array(bytes));
    const regular = strFromU8(files['regular/search.svg']);
    expect(regular).toContain('currentColor');
    expect(regular).toContain(`width="${DEFAULT_LOOK.size}"`);
    expect(strFromU8(files['duocolor/search.svg'])).toContain('var(--fos-primary');
  });
});
