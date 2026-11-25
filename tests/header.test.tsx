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
  const chunk = /icons\/(\d+\/\w+\/\d+\.json)$/.exec(url);
  if (chunk) return new Response(readFileSync(join(__dirname, '../public/icons', chunk[1]), 'utf8'), { status: 200 });
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
              <Route path="/pricing" element={<h1>Pricing plans</h1>} />
              <Route path="/ai-agents" element={<h1>Fos Icons for AI agents</h1>} />
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

  it('keeps Get started in the home page intro', () => {
    renderAt('/');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    // Get started and Download are buttons under the home intro, not header links.
    expect(within(nav).queryByRole('link', { name: /Get started/ })).toBeNull();
    expect(within(nav).queryByRole('button', { name: /Download/ })).toBeNull();
    const start = within(screen.getByRole('main')).getByRole('link', { name: /Get started/ });
    expect(start.getAttribute('href')).toBe('https://github.com/fos-icons');
    expect(start.getAttribute('target')).toBe('_blank');
  });

  it.each(['/', '/docs', '/pricing', '/ai-agents'])('keeps the same header link order and destinations on %s', (url) => {
    renderAt(url);
    const nav = within(screen.getByRole('navigation', { name: 'Main' }));
    const links = nav.getAllByRole('link');
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Browse', '/'], ['Docs', '/docs'], ['Pricing', '/pricing'], ['MCP', '/ai-agents'],
    ]);
    expect(links.filter((link) => link.getAttribute('aria-current') === 'page').map((link) => link.getAttribute('href'))).toEqual([url]);
    expect(nav.getByRole('button', { name: 'Feedback' })).toBeTruthy();
  });

  it('opens the AI agents page directly from the MCP link', async () => {
    const user = userEvent.setup();
    renderAt('/');
    const nav = within(screen.getByRole('navigation', { name: 'Main' }));
    expect(nav.queryByRole('button', { name: 'MCP' })).toBeNull();
    await user.click(nav.getByRole('link', { name: 'MCP' }));
    expect(screen.getByRole('heading', { name: 'Fos Icons for AI agents' })).toBeTruthy();
    expect(nav.getByRole('link', { name: 'MCP' }).getAttribute('aria-current')).toBe('page');
  });

  it('links Pricing from the header and the menu, closes the menu, and marks Pricing current', async () => {
    const user = userEvent.setup();
    renderAt('/');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Pricing' }).getAttribute('href')).toBe('/pricing');
    const menu = within(nav).getByRole('button', { name: 'Menu' });
    await user.click(menu);
    const panel = within(document.getElementById(menu.getAttribute('aria-controls')!)!);
    expect(panel.getAllByRole('link').map((link) => link.textContent)).toEqual(['Browse', 'Docs', 'Pricing', 'MCP']);
    expect(panel.getByRole('button', { name: 'Feedback' })).toBeTruthy();
    const links = within(nav).getAllByRole('link', { name: 'Pricing' });
    await user.click(links[1]);
    expect(await screen.findByRole('heading', { name: 'Pricing plans' })).toBeTruthy();
    expect(menu.getAttribute('aria-expanded')).toBe('false');
    expect(links[0].getAttribute('aria-current')).toBe('page');
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

  it('Download all builds a Regular-only ZIP with the chosen look, plus the license', async () => {
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
    expect(filename).toBe(`fos-icons-${lock.revision!.slice(0, 7)}-regular.zip`);

    const { unzipSync, strFromU8 } = await import('fflate');
    const bytes = await new Promise<ArrayBuffer>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.readAsArrayBuffer(blob!);
    });
    const files = unzipSync(new Uint8Array(bytes));
    const names = Object.keys(files);
    expect(names.filter((n) => n.endsWith('.svg'))).toHaveLength(catalog.icons.length);
    expect(names.filter((n) => n.endsWith('.svg')).every((name) => name.startsWith('regular/'))).toBe(true);
    // Files carry the chosen size, stroke, and color. 56px is drawn from the
    // 64px optical size: 0.75 grid units is 2 units on its 64px grid.
    const regular = strFromU8(files['regular/search.svg']);
    expect(regular).toContain('width="56"');
    expect(regular).toContain('viewBox="0 0 64 64"');
    expect(regular).toContain('stroke-width="2"');
    expect(regular).toContain('#D93025');
    expect(regular).not.toContain('currentColor');
    expect(strFromU8(files['LICENSE.txt'])).toBe(license);
    expect(strFromU8(files['README.txt'])).toMatch(/Size: 56px, drawn from the 64px optical size\. Stroke: 0\.75px/);
  });

  it('shows the Free badge on Regular and disables Premium style options', async () => {
    const user = userEvent.setup();
    renderAt('/');
    const main = within(screen.getByRole('main'));
    const regular = main.getByRole<HTMLInputElement>('checkbox', { name: 'Regular' });
    expect(regular.getAttribute('aria-description')).toBe('Free');
    expect(regular.checked).toBe(true);
    for (const style of ['Solid', 'Duocolor', 'Duotone']) {
      const option = main.getByRole<HTMLInputElement>('checkbox', { name: style });
      expect(option.disabled).toBe(true);
      expect(option.checked).toBe(false);
    }
    await user.click(regular);
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
