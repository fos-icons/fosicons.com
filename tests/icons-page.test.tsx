import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { Layout } from '../src/components/Layout';
import { resetSectionState } from '../src/components/Customize';
import { resetExportRows } from '../src/components/ExportPanel';
import { ToastProvider } from '../src/components/ui';
import { artworkDirectory, catalog, resetStyleCache } from '../src/lib/catalog';
import { ThemeProvider } from '../src/lib/theme';
import { IconsPage } from '../src/pages/IconsPage';
import IconPage from '../src/pages/IconPage';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { styleSvgs } from './helpers';

let location = '';
function Spy() {
  const l = useLocation();
  location = l.search;
  return null;
}

function renderAt(url: string) {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<><IconsPage /><Spy /></>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </ThemeProvider>,
  );
}

/** Make `(min-width: 1024px)` match, so the persistent side pane renders. */
function useDesktop() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('min-width: 1024px'), media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  }));
}

const fetchMock = vi.fn(async (url: string) => {
  if (url.endsWith('modifiers.json')) {
    return new Response(readFileSync(join(__dirname, '../public/modifiers.json'), 'utf8'), { status: 200 });
  }
  if (url.includes('brands/')) {
    return new Response(readFileSync(join(__dirname, '../public', url.slice(url.indexOf('brands/'))), 'utf8'), { status: 200 });
  }
  const chunk = /icons\/(\w+\/\d+\.json)$/.exec(url);
  if (chunk) {
    return new Response(readFileSync(join(__dirname, '../public/icons', chunk[1]), 'utf8'), { status: 200 });
  }
  const style = /icons\/(\w+)\.json/.exec(url)![1] as 'regular';
  return new Response(JSON.stringify(styleSvgs(style)), { status: 200 });
});

beforeEach(() => {
  resetStyleCache();
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  // jsdom has no showModal; the mobile sheet uses it.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute('open'); };
});
afterEach(() => { cleanup(); resetSectionState(); resetExportRows(); vi.unstubAllGlobals(); vi.restoreAllMocks(); localStorage.clear(); });

describe('Icons page', () => {
  it('shows the full catalog count from source data and loads only one style', async () => {
    renderAt('/');
    expect(screen.getByText(`${catalog.icons.length.toLocaleString('en-US')} icons`)).toBeTruthy();
    await screen.findAllByRole('button', { name: 'search' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`/${artworkDirectory}/regular.json`);
  });

  it('keeps the active grid available when another style’s artwork request fails', async () => {
    vi.stubGlobal('IntersectionObserver', class {
      observe() {}
      disconnect() {}
    });
    let finishRegular!: (response: Response) => void;
    const pendingRegular = new Promise<Response>((resolve) => { finishRegular = resolve; });
    fetchMock.mockImplementationOnce(() => pendingRegular);

    const user = userEvent.setup();
    renderAt('/?q=cloud&icon=cloud');
    await waitFor(() => expect(fetchMock.mock.calls[0]?.[0]).toMatch(/regular\/\d+\.json$/));
    const [toolbarStyle] = screen.getAllByRole('radiogroup', { name: 'Icon style' });
    await user.click(within(toolbarStyle).getByRole('radio', { name: 'Duocolor' }));
    await screen.findByRole('img', { name: /cloud, Duocolor, preview/ });
    await act(async () => { finishRegular(new Response(null, { status: 503 })); });
    expect(screen.queryByText(/Could not load Regular icons/)).toBeNull();
    expect(screen.getByRole('list', { name: 'Duocolor icons' })).toBeTruthy();

    await user.click(within(toolbarStyle).getByRole('radio', { name: 'Regular' }));
    await screen.findByText(/Could not load Regular icons/);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('img', { name: /cloud, Regular, preview/ });
    expect(screen.queryByText(/Could not load Regular icons/)).toBeNull();
  });

  it('filters by search and writes the query to the URL', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await user.type(screen.getByRole('searchbox', { name: 'Search icons' }), 'arrow');
    expect(location).toBe('?q=arrow');
    const grid = screen.getByRole('list', { name: 'Regular icons' });
    const count = within(grid).getAllByRole('listitem').length;
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(catalog.icons.length);
    expect(screen.getByText(new RegExp(`^${count} icons for “arrow”`))).toBeTruthy();
  });

  it('focuses search with "/" but not while typing in a field', async () => {
    const user = userEvent.setup();
    renderAt('/');
    const cell = (await screen.findAllByRole('button', { name: 'search' }))[0];
    cell.focus();
    await user.keyboard('/');
    const box = screen.getByRole('searchbox', { name: 'Search icons' });
    expect(document.activeElement).toBe(box);
    await user.keyboard('a/b');
    expect((box as HTMLInputElement).value).toBe('a/b');
  });

  it('shows a useful empty state', async () => {
    renderAt('/?q=zzzznothing');
    const empty = within(screen.getByRole('region', { name: 'No icons for “zzzznothing”' }));
    expect(empty.getByRole('button', { name: 'Clear search' })).toBeTruthy();
    const request = empty.getByRole('link', { name: /Request this icon/ });
    expect(request.getAttribute('href')).toBe('https://github.com/fos-icons/fos-icons/issues/new?title=Icon+request%3A+zzzznothing');
  });

  it('suggests close matches for a typo and searches them in one click', async () => {
    const user = userEvent.setup();
    renderAt('/?q=calender');
    const suggestions = within(screen.getByRole('heading', { name: 'Did you mean' }).parentElement!);
    const calendar = suggestions.getByRole('button', { name: 'calendar' });
    await user.click(calendar);
    expect(location).toBe('?q=calendar');
  });

  it('offers the other catalog when only it has matches', () => {
    renderAt('/?q=spotify');
    expect(screen.getByRole('button', { name: 'Show 1 in Brands' })).toBeTruthy();
  });

  it('restores style, category, and the selected icon from a shared URL', async () => {
    renderAt('/?category=Essentials&style=solid&icon=search');
    expect(await screen.findByRole('heading', { name: 'search', level: 2 })).toBeTruthy();
    expect(screen.getAllByRole('radio', { name: 'Solid', checked: true })).toHaveLength(2);
    expect((screen.getByLabelText('Category') as HTMLSelectElement).value).toBe('Essentials');
    expect(fetchMock.mock.calls[0][0]).toMatch(/filled\.json$/);
  });

  it('switching style updates the URL and fetches that style', async () => {
    const user = userEvent.setup();
    renderAt('/?icon=user-add');
    await screen.findByRole('heading', { name: 'user-add', level: 2 });
    const [toolbarStyle] = screen.getAllByRole('radiogroup', { name: 'Icon style' });
    await user.click(within(toolbarStyle).getByRole('radio', { name: 'Duotone' }));
    expect(location).toContain('style=duotone');
    expect(location).toContain('icon=user-add');
    await act(async () => {});
    expect(fetchMock.mock.calls.map((c) => c[0]).some((u) => /duotone\.json$/.test(u))).toBe(true);
  });

  it('links to the library versions of a base icon', async () => {
    renderAt('/?icon=user');
    // The grid makes label queries slow; find the select directly once modifiers load.
    const select = await vi.waitFor(() => {
      const label = Array.from(document.querySelectorAll('label')).find((l) => l.textContent === 'Library versions');
      if (!label) throw new Error('Modifiers not loaded yet');
      return document.getElementById(label.htmlFor) as HTMLSelectElement;
    }, { timeout: 8000 });
    const options = Array.from(select.options).map((o) => o.value);
    const expected = catalog.icons.filter((i) => i.composition?.base === 'user').map((i) => i.name);
    expect(options).toEqual(['', ...expected]);
  });

  it.each([
    ['calendar-record', 'calendar', 'Record', 'Bottom right', '12.75'],
    ['clock-check', 'clock', 'Check', 'Bottom left', '1.25'],
  ])('opens %s with its authored modifier selected and lets the user edit the base', async (preset, base, label, corner, x) => {
    const user = userEvent.setup();
    renderAt(`/?q=${preset}&icon=${preset}`);

    const chosen = await screen.findByRole('button', { name: new RegExp(`^${label} modifier`) });
    expect(chosen.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: corner }).getAttribute('aria-pressed')).toBe('true');
    const preview = screen.getByRole('img', { name: new RegExp(`${preset}, Regular, preview`) });
    expect(preview.querySelectorAll(`svg[x="${x}"][y="12.75"]`)).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Top left' }));
    expect(location).toBe(`?q=${preset}&icon=${base}&modifier=${label.toLowerCase()}&corner=top-left`);
    const edited = await screen.findByRole('img', { name: new RegExp(`${base}, Regular, preview`) });
    await waitFor(() => expect(edited.querySelectorAll('svg[x="1.25"][y="1.25"]')).toHaveLength(1));

    await user.click(screen.getByRole('button', { name: 'None' }));
    expect(location).toBe(`?q=${preset}&icon=${base}`);
    expect(edited.querySelector('svg[x][y]')).toBeNull();
  });

  it('previews any modifier on an icon, in the corners it supports', async () => {
    const user = userEvent.setup();
    renderAt('/?icon=agent');
    const preview = await screen.findByRole('img', { name: /agent, Regular, preview/ });
    expect(preview.innerHTML).not.toContain('clip-path');

    await user.click(await screen.findByRole('tab', { name: 'Access' }, { timeout: 8000 }));
    await user.click(screen.getByRole('button', { name: /^Lock modifier/ }));
    expect(screen.getByRole('button', { name: /^Lock modifier/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Bottom right' }).getAttribute('aria-pressed')).toBe('true');
    expect(preview.innerHTML).toMatch(/x="12.75" y="12.75"/);
    expect(screen.getByText(/Preview, not a library icon/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Top left' }));
    expect(preview.innerHTML).toMatch(/x="1.25" y="1.25"/);

    // File-type and image-quality modifiers only apply to files, folders, and images.
    expect(screen.queryByRole('tab', { name: 'Files' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Quality' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'None' }));
    expect(preview.innerHTML).not.toContain('clip-path');
  });

  it('opens "clock with sparkle" as the clock icon with the Sparkle modifier', async () => {
    renderAt('/?q=clock%20with%20sparkle');
    expect(await screen.findByRole('heading', { name: 'clock', level: 2 }, { timeout: 8000 })).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('button', { name: /^Sparkle modifier/ }).getAttribute('aria-pressed')).toBe('true'), { timeout: 8000 });
    expect(screen.getByText(/Opening clock with the Sparkle modifier/)).toBeTruthy();
    const preview = screen.getByRole('img', { name: /clock, Regular, preview/ });
    expect(preview.innerHTML).toContain('clip-path');
  });

  it('reads "edit clock" the same as "clock with edit"', async () => {
    renderAt('/?q=edit%20clock');
    expect(await screen.findByRole('heading', { name: 'clock', level: 2 }, { timeout: 8000 })).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('button', { name: /^Edit modifier/ }).getAttribute('aria-pressed')).toBe('true'), { timeout: 8000 });
  });

  it('lets a real icon win over a modifier reading', async () => {
    renderAt('/?q=check%20user');
    await waitFor(() => expect(document.querySelector('button[data-icon="user-check"]')).toBeTruthy(), { timeout: 8000 });
    expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith('modifiers.json'))).toBe(false);
  });

  it('restores a modifier and corner from a shared link', async () => {
    renderAt('/?icon=clock&modifier=sparkle&corner=top-right');
    await waitFor(() => expect(screen.getByRole('button', { name: /^Sparkle modifier/ }).getAttribute('aria-pressed')).toBe('true'), { timeout: 8000 });
    expect(screen.getByRole('button', { name: 'Top right' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('offers file-type labels on files, only in the corners they support', async () => {
    const user = userEvent.setup();
    renderAt('/?icon=file');
    await user.click(await screen.findByRole('tab', { name: 'Files' }, { timeout: 8000 }));
    await user.click(screen.getByRole('button', { name: /^PDF modifier/ }));
    const enabled = ['Top left', 'Top right', 'Bottom left', 'Bottom right']
      .filter((c) => !(screen.getByRole('button', { name: c }) as HTMLButtonElement).disabled);
    expect(enabled).toEqual(['Bottom left']);
  });

  it('downloads through Figma-style scale and format rows', async () => {
    const user = userEvent.setup();
    renderAt('/?icon=search');
    const list = await screen.findByRole('list', { name: 'Download formats' });
    // The page grid is large; query inside the Download section only.
    const ex = within(list.closest('section')!);
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    // SVG is vector, so its scale is fixed.
    expect((ex.getByLabelText('Scale, row 1') as HTMLSelectElement).disabled).toBe(true);
    expect((ex.getByRole('button', { name: 'Remove row 1' }) as HTMLButtonElement).disabled).toBe(true);
    expect(ex.getByRole('button', { name: /^Download search$/ })).toBeTruthy();

    // + adds the formats not listed yet: PNG, then JPG; then PNG one scale up.
    await user.click(ex.getByRole('button', { name: 'Add a format' }));
    expect((ex.getByLabelText('Format, row 2') as HTMLSelectElement).value).toBe('png');
    const scale2 = ex.getByLabelText('Scale, row 2') as HTMLSelectElement;
    expect(scale2.disabled).toBe(false);
    expect(scale2.selectedOptions[0].textContent).toBe('1x');
    await user.click(ex.getByRole('button', { name: 'Add a format' }));
    expect((ex.getByLabelText('Format, row 3') as HTMLSelectElement).value).toBe('jpg');
    expect(ex.getByText(/JPGs have white ones/)).toBeTruthy();
    await user.click(ex.getByRole('button', { name: 'Add a format' }));
    expect((ex.getByLabelText('Format, row 4') as HTMLSelectElement).value).toBe('png');
    expect((ex.getByLabelText('Scale, row 4') as HTMLSelectElement).selectedOptions[0].textContent).toBe('1.5x');
    expect(ex.getByRole('button', { name: 'Download search (4)' })).toBeTruthy();

    await user.click(ex.getByRole('button', { name: 'Options, row 4' }));
    expect((ex.getByLabelText('Suffix') as HTMLInputElement).placeholder).toBe('-72px');

    for (const n of [4, 3, 1]) await user.click(ex.getByRole('button', { name: `Remove row ${n}` }));
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);

    // Copy follows the same shape; scale only applies to images.
    const copyScale = ex.getByLabelText('Copy scale') as HTMLSelectElement;
    expect(copyScale.disabled).toBe(true);
    await user.selectOptions(ex.getByLabelText('Copy as'), 'png');
    expect(copyScale.disabled).toBe(false);
  });

  it('links Documentation from the intro and keeps GitHub and Privacy in the footer', () => {
    renderAt('/');
    const header = screen.getByRole('banner');
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Documentation' }).getAttribute('href')).toBe('/docs');
    expect(within(header).queryByRole('link', { name: /GitHub|Pricing/ })).toBeNull();
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).queryByRole('link', { name: 'Docs' })).toBeNull();
    expect(within(footer).getByRole('link', { name: /GitHub/ })).toBeTruthy();
    expect(within(footer).getByRole('link', { name: 'Privacy' }).getAttribute('href')).toBe('/docs#privacy');
    expect(within(footer).getByRole('link', { name: 'License' }).getAttribute('href')).toBe('/docs#licensing');
    const npm = within(footer).getByRole('link', { name: /^npm/ });
    expect(npm.getAttribute('href')).toBe('https://www.npmjs.com/org/fos-icons');
    expect(npm.getAttribute('target')).toBe('_blank');
    expect(footer.textContent).not.toMatch(/Library [0-9a-f]{7}|licensed separately|MIT licensed/);
  });

  it('offers Brands as the last style option with the approved marks', async () => {
    const user = userEvent.setup();
    renderAt('/?q=twitter');
    const switcher = screen.getByRole('radiogroup', { name: 'Icon style' });
    const labels = within(switcher).getAllByRole('radio').map((r) => r.textContent);
    expect(labels).toEqual(['Regular', 'Solid', 'Duocolor', 'Duotone', 'Brands']);
    await user.click(within(switcher).getByRole('radio', { name: 'Brands' }));
    expect(location).toBe('?q=twitter&style=brands');
    expect(screen.getByText('All brand icons belong to their respective owners.')).toBeTruthy();
    expect(screen.getByRole('searchbox', { name: 'Search brands' })).toBeTruthy();
    // No brand ships Solid yet, so there is no Regular/Solid switch.
    expect(screen.queryByRole('radiogroup', { name: 'Brand style' })).toBeNull();
    // X is found by its former name.
    const grid = screen.getByRole('list', { name: 'Brand icons' });
    await vi.waitFor(() => expect(grid.querySelector('svg')).toBeTruthy());
    expect(within(grid).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['x']);
  });

  it('namespaces brand IDs so marks sharing gradient IDs do not collide', async () => {
    const { loadBrands } = await import('../src/lib/brands');
    const svgs = await loadBrands('regular');
    expect(Object.keys(svgs)).toHaveLength(32);
    const ids = Object.values(svgs).flatMap((svg) => [...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
    expect(new Set(ids).size).toBe(ids.length);
    expect(svgs['google-chrome']).toMatch(/id="brand-google-chrome-regular-0"/);
  });
});

describe('Side pane (desktop)', () => {
  beforeEach(useDesktop);

  it('is open without a selection and customizes the whole grid', async () => {
    const user = userEvent.setup();
    renderAt('/');
    const pane = await screen.findByRole('complementary', { name: 'Icon panel' });
    expect(within(pane).getByRole('heading', { name: 'Customize' })).toBeTruthy();
    await screen.findAllByRole('button', { name: 'search' });
    const grid = screen.getByRole('list', { name: 'Regular icons' }).parentElement!;
    // Default: 48px with the automatic 0.85px stroke (0.85 / 1.25 = 0.68).
    expect(grid.style.getPropertyValue('--glyph-size')).toBe('48px');
    expect(grid.style.getPropertyValue('--stroke-scale')).toBe('0.68');
    expect(within(pane).getByText('Auto')).toBeTruthy();

    // The slider covers what the grid previews; larger sizes go in the px field.
    expect(within(pane).getByRole('slider', { name: 'Size' }).getAttribute('max')).toBe('64');

    // Auto stroke follows the size.
    fireEvent.change(within(pane).getByRole('slider', { name: 'Size' }), { target: { value: '24' } });
    expect(grid.style.getPropertyValue('--glyph-size')).toBe('24px');
    expect(grid.style.getPropertyValue('--stroke-scale')).toBe('1');

    // A manual stroke sticks across sizes until "Use auto".
    const slider = within(pane).getByRole('slider', { name: 'Stroke width' });
    fireEvent.change(slider, { target: { value: '2.5' } });
    expect(grid.style.getPropertyValue('--stroke-scale')).toBe('2');
    fireEvent.change(within(pane).getByRole('slider', { name: 'Size' }), { target: { value: '32' } });
    expect(grid.style.getPropertyValue('--stroke-scale')).toBe('2');
    await user.click(within(pane).getByRole('button', { name: 'Use auto' }));
    // Auto at 32px is 1.1px (1.1 / 1.25 = 0.88).
    expect(grid.style.getPropertyValue('--stroke-scale')).toBe('0.88');

    await user.click(within(pane).getByRole('button', { name: /Reset to defaults/ }));
    expect(grid.style.getPropertyValue('--stroke-scale')).toBe('0.68');
    expect(grid.style.getPropertyValue('--glyph-size')).toBe('48px');
  });

  it('resizes with the keyboard, remembers the width, and resets', async () => {
    const user = userEvent.setup();
    renderAt('/');
    const pane = await screen.findByRole('complementary', { name: 'Icon panel' });
    const handle = within(pane).getByRole('separator', { name: 'Resize panel' });
    expect(handle.getAttribute('aria-valuenow')).toBe('380');
    handle.focus();
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(handle.getAttribute('aria-valuenow')).toBe('412');
    expect(pane.style.width).toBe('412px');
    expect(localStorage.getItem('fos-pane-width')).toBe('412');
    await user.keyboard('{End}');
    expect(handle.getAttribute('aria-valuenow')).toBe('640');
    await user.keyboard('{Enter}');
    expect(handle.getAttribute('aria-valuenow')).toBe('380');
    expect(localStorage.getItem('fos-pane-width')).toBeNull();
  });

  it('has no stroke control for Solid', async () => {
    renderAt('/?style=solid');
    const pane = await screen.findByRole('complementary', { name: 'Icon panel' });
    expect(within(pane).queryByRole('slider', { name: 'Stroke width' })).toBeNull();
    expect(within(pane).getByText(/no stroke to adjust/)).toBeTruthy();
  });

  it('collapses, remembers it, and reopens when an icon is selected', async () => {
    const user = userEvent.setup();
    renderAt('/');
    const pane = await screen.findByRole('complementary', { name: 'Icon panel' });
    // Feedback lives in the site header; the pane bar has no page link until an icon is selected.
    const feedback = within(screen.getByRole('banner')).getAllByRole('link', { name: /Feedback/ })[0];
    expect(feedback.getAttribute('href')).toBe('https://github.com/fos-icons/fosicons.com/issues/new');
    expect(within(pane).queryByRole('link', { name: /Feedback/ })).toBeNull();
    expect(within(pane).queryByRole('link', { name: 'Open icon page' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Theme:/ })).toBeNull();
    await user.click(within(pane).getByRole('button', { name: 'Collapse panel' }));
    expect(screen.queryByRole('button', { name: /^Theme:/ })).toBeNull();
    expect(within(pane).getByRole('button', { name: 'Expand panel' }).getAttribute('aria-expanded')).toBe('false');
    expect(document.getElementById('side-pane-body')!.hidden).toBe(true);
    expect(localStorage.getItem('fos-pane-collapsed')).toBe('1');

    await user.click((await screen.findAllByRole('button', { name: 'search' }))[0]);
    expect(document.getElementById('side-pane-body')!.hidden).toBe(false);
    expect(within(pane).getByRole('heading', { name: 'search', level: 2 })).toBeTruthy();
    expect(within(pane).getByRole('link', { name: 'Open icon page' }).getAttribute('href')).toBe('/icons/search');
    // Collapsing with an icon still selected sticks; it is not reopened by the selection.
    await user.click(within(pane).getByRole('button', { name: 'Collapse panel' }));
    expect(document.getElementById('side-pane-body')!.hidden).toBe(true);
    await user.click(within(pane).getByRole('button', { name: 'Expand panel' }));
    expect(document.getElementById('side-pane-body')!.hidden).toBe(false);

    await user.click(within(pane).getByRole('button', { name: 'Clear selection' }));
    expect(location).toBe('');
    expect(within(pane).getByRole('heading', { name: 'Customize' })).toBeTruthy();
  });

  it('carries the grid-wide stroke into the selected icon and its code note', async () => {
    const user = userEvent.setup();
    renderAt('/');
    const pane = await screen.findByRole('complementary', { name: 'Icon panel' });
    const slider = within(pane).getByRole('slider', { name: 'Stroke width' });
    fireEvent.change(slider, { target: { value: '2' } });
    await user.click((await screen.findAllByRole('button', { name: 'search' }))[0]);
    const preview = await within(pane).findByRole('img', { name: /search, Regular, preview/ });
    expect(preview.innerHTML).toContain('stroke-width="2"');
    await user.click(within(pane).getByRole('button', { name: 'Code' }));
    expect(within(pane).getByText(/examples use the standard 1.25px stroke/)).toBeTruthy();
  });
});

describe('Multi-select and ZIP export (desktop)', () => {
  beforeEach(useDesktop);

  it('Shift-click builds a set from the open icon, and removing back to one reopens it', async () => {
    const user = userEvent.setup();
    renderAt('/?icon=search');
    const pane = await screen.findByRole('complementary', { name: 'Icon panel' });
    await within(pane).findByRole('heading', { name: 'search', level: 2 });
    const [user1] = await screen.findAllByRole('button', { name: 'user' });
    await user.keyboard('{Shift>}');
    await user.click(user1);
    await user.keyboard('{/Shift}');

    expect(within(pane).getByRole('heading', { name: '2 icons selected' })).toBeTruthy();
    expect(location).toBe('');
    const grid = screen.getByRole('list', { name: 'Regular icons' });
    const pressed = within(grid).getAllByRole('button', { pressed: true }).map((b) => b.getAttribute('aria-label'));
    expect(pressed.sort()).toEqual(['search', 'user']);

    // The set's settings are the shared look.
    expect(within(pane).getByRole('slider', { name: 'Stroke width' })).toBeTruthy();

    await user.click(within(pane).getByRole('button', { name: 'Remove user from selection' }));
    expect(location).toBe('?icon=search');
    expect(within(pane).getByRole('heading', { name: 'search', level: 2 })).toBeTruthy();
  });

  it('Shift+Enter adds the focused icon from the keyboard', async () => {
    const user = userEvent.setup();
    renderAt('/?icon=search');
    const pane = await screen.findByRole('complementary', { name: 'Icon panel' });
    const [cell] = await screen.findAllByRole('button', { name: 'user' });
    cell.focus();
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    expect(within(pane).getByRole('heading', { name: '2 icons selected' })).toBeTruthy();
  });

  it('downloads the set as a ZIP of SVGs that use the shared look', async () => {
    const user = userEvent.setup();
    let blob: Blob | null = null;
    vi.stubGlobal('URL', Object.assign(URL, {
      createObjectURL: (b: Blob) => { blob = b; return 'blob:test'; },
      revokeObjectURL: () => {},
    }));
    // jsdom cannot follow the download link; the blob above is what matters.
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderAt('/?icon=search');
    const pane = await screen.findByRole('complementary', { name: 'Icon panel' });
    const [userCell] = await screen.findAllByRole('button', { name: 'user' });
    await user.keyboard('{Shift>}');
    await user.click(userCell);
    await user.keyboard('{/Shift}');

    fireEvent.change(within(pane).getByRole('slider', { name: 'Stroke width' }), { target: { value: '2' } });
    fireEvent.change(within(pane).getByRole('slider', { name: 'Size' }), { target: { value: '32' } });
    await user.click(within(pane).getByRole('button', { name: 'Download 2 icons (.zip)' }));
    // Building the ZIP is slow on CI runners; allow more than the 1s default.
    await screen.findByText(/Downloaded 2 icons as fos-icons-regular-2-svg\.zip/, undefined, { timeout: 8000 });

    const { unzipSync, strFromU8 } = await import('fflate');
    const bytes = await new Promise<ArrayBuffer>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.readAsArrayBuffer(blob!);
    });
    const files = unzipSync(new Uint8Array(bytes));
    expect(Object.keys(files).sort()).toEqual(['search-regular.svg', 'user-regular.svg']);
    for (const bytes of Object.values(files)) {
      const svg = strFromU8(bytes);
      expect(svg).toContain('width="32"');
      expect(svg).toContain('stroke-width="2"');
      expect(svg).not.toContain('currentColor');
    }
  });
});

describe('Search tips', () => {
  it('rotate through tricks while idle and pause while the field is focused', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderAt('/');
      const tip = () => screen.getByTestId('search-tip').textContent;
      expect(tip()).toMatch(/^Search 1,200\+ icons/);
      await act(async () => { vi.advanceTimersByTime(4500); });
      expect(tip()).toMatch(/^Tip: /);
      const shown = tip();
      act(() => screen.getByRole('searchbox', { name: 'Search icons' }).focus());
      await act(async () => { vi.advanceTimersByTime(9000); });
      expect(tip()).toBe(shown);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Inspector sections (desktop)', () => {
  beforeEach(useDesktop);

  it('keeps framework usage collapsed until expanded, with copyable tabs', async () => {
    const user = userEvent.setup();
    renderAt('/?icon=search');
    const pane = await screen.findByRole('complementary', { name: 'Icon panel' });
    const toggle = await within(pane).findByRole('button', { name: 'Code' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.getElementById(toggle.getAttribute('aria-controls')!)!.hidden).toBe(true);
    await user.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const section = toggle.closest('section')!;
    expect(section.querySelector('.code-block')!.closest('.code-stone')).not.toBeNull();
    expect(within(section).getByRole('button', { name: 'Copy' })).toBeTruthy();
    const code = () => section.querySelector('.code-block code')!.textContent;
    expect(code()).toMatch(/^import \{ SearchRegular \} from '@fos-icons\/react';/);
    await user.click(within(section).getByRole('tab', { name: 'Vue' }));
    expect(code()).toMatch(/import \{ SearchRegular \} from '@fos-icons\/vue';/);
    await user.click(within(section).getByRole('tab', { name: 'Svelte' }));
    expect(code()).toMatch(/^<script lang="ts">/);
    expect(code()).toMatch(/import \{ SearchRegular \} from '@fos-icons\/svelte';/);
    expect(code()).toContain('size={48}');
    await user.click(within(section).getByRole('button', { name: 'Copy' }));
    expect(await navigator.clipboard.readText()).toBe(code());
    expect(localStorage.getItem('fos:code-tab')).toBe('svelte');
    await user.click(within(section).getByRole('tab', { name: 'Angular' }));
    expect(code()).toContain("import { SearchRegular } from '@fos-icons/angular';");
    expect(code()).toContain('<svg fos-search-regular [size]="48"></svg>');
    await user.click(within(section).getByRole('button', { name: 'Copy' }));
    expect(await navigator.clipboard.readText()).toBe(code());
    expect(localStorage.getItem('fos:code-tab')).toBe('angular');
    await user.click(within(section).getByRole('tab', { name: 'React' }));
    // Syntax colors arrive once the highlighter loads.
    await vi.waitFor(() => expect(pane.querySelector('.code-block .hljs-keyword')?.textContent).toBe('import'));
  });

  it.each(['regular', 'solid', 'duocolor', 'duotone'])('switches the site theme from Color for %s icons', async (style) => {
    const user = userEvent.setup();
    renderAt(`/?style=${style}`);
    const pane = await screen.findByRole('complementary', { name: 'Icon panel' });
    expect(screen.queryByRole('button', { name: /^Theme:/ })).toBeNull();
    const variant = within(pane).getByRole('radiogroup', { name: 'Light or dark' });
    await user.click(within(variant).getByRole('radio', { name: 'Dark' }));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('fos-theme')).toBe('dark');
    await user.click(within(variant).getByRole('radio', { name: 'Light' }));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('says when filled parts of an icon keep their weight as the stroke changes', async () => {
    renderAt('/?icon=alert-circle');
    const pane = await screen.findByRole('complementary', { name: 'Icon panel' });
    // Default 48px Auto stroke is 0.85px, not the drawn 1.25px.
    expect(await within(pane).findByText(/drawn as filled shapes/)).toBeTruthy();
  });

  it('does not show that note for an icon made only of strokes', async () => {
    renderAt('/?icon=search');
    const pane = await screen.findByRole('complementary', { name: 'Icon panel' });
    await within(pane).findByRole('img', { name: /search, Regular/ });
    expect(within(pane).queryByText(/drawn as filled shapes/)).toBeNull();
  });
});

describe('Icon page header search (desktop)', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: /min-width: (768|1024)px/.test(query), media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
    }));
  });

  const renderIconPage = (url: string) => render(
    <ThemeProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<><IconsPage /><Spy /></>} />
              <Route path="icons/:name" element={<><IconPage /><Spy /></>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </ThemeProvider>,
  );

  it('puts Copy SVG beside Download PNG without showing raw SVG code', async () => {
    const user = userEvent.setup();
    renderIconPage('/icons/triangle-right');
    const copy = screen.getByRole('button', { name: 'Copy SVG' });
    const png = screen.getByRole('button', { name: 'Download PNG' });
    expect(png.nextElementSibling).toBe(copy);
    expect(png.parentElement!.firstElementChild).toBe(png);
    await waitFor(() => expect(copy.hasAttribute('disabled')).toBe(false));
    expect(screen.getAllByRole('button', { name: 'Copy SVG' })).toHaveLength(1);
    expect(document.querySelector('.code-block[data-lang="svg"]')).toBeNull();
    await user.click(copy);
    expect(await navigator.clipboard.readText()).toBe(styleSvgs('regular')['triangle-right']);
    await user.click(within(screen.getByRole('radiogroup', { name: 'Icon style' })).getByRole('radio', { name: 'Solid' }));
    await waitFor(() => expect(copy.hasAttribute('disabled')).toBe(false));
    await user.click(copy);
    expect(await navigator.clipboard.readText()).toBe(styleSvgs('filled')['triangle-right']);
  });

  it('offers copyable Svelte and Angular code on icon pages and updates it with the style', async () => {
    const user = userEvent.setup();
    renderIconPage('/icons/triangle-right');
    const section = document.getElementById('use')!.closest('section')!;
    const tab = within(section).getByRole('tab', { name: 'Svelte' });
    await user.click(tab);
    const code = () => section.querySelector('.code-block[data-lang="svelte"] code')!.textContent;
    expect(code()).toContain("import { TriangleRightRegular } from '@fos-icons/svelte';");
    expect(code()).toContain('<TriangleRightRegular />');
    await user.click(within(section).getAllByRole('button', { name: 'Copy' })[0]);
    expect(await navigator.clipboard.readText()).toBe(code());
    const preview = screen.getByRole('radiogroup', { name: 'Icon style' });
    await user.click(within(preview).getByRole('radio', { name: 'Solid' }));
    expect(code()).toContain('TriangleRightFilled');
    expect(code()).not.toContain('TriangleRightRegular');
    expect(tab.getAttribute('aria-selected')).toBe('true');

    const angular = within(section).getByRole('tab', { name: 'Angular' });
    await user.click(angular);
    const angularCode = () => section.querySelector('.code-block[data-lang="ts"] code')!.textContent;
    expect(angularCode()).toContain("import { TriangleRightFilled } from '@fos-icons/angular';");
    expect(angularCode()).toContain('<svg fos-triangle-right-filled></svg>');
    await user.click(within(section).getAllByRole('button', { name: 'Copy' })[0]);
    expect(await navigator.clipboard.readText()).toBe(angularCode());
    await user.click(within(preview).getByRole('radio', { name: 'Regular' }));
    expect(angularCode()).toContain('<svg fos-triangle-right-regular></svg>');
    expect(angular.getAttribute('aria-selected')).toBe('true');
  });

  it('shows the icon as a removable tag; removing it goes back to the icons', async () => {
    const user = userEvent.setup();
    renderIconPage('/icons/bell');
    const header = within(screen.getByRole('banner'));
    await user.click(await header.findByRole('button', { name: 'Remove bell and go back to the icons' }));
    expect(await screen.findByRole('heading', { level: 1, name: /Find the right icon/ })).toBeTruthy();
    expect(location).toBe('');
  });

  it('removes the tag with Backspace, and searches the grid on Enter', async () => {
    const user = userEvent.setup();
    renderIconPage('/icons/bell');
    const field = await within(screen.getByRole('banner')).findByRole('searchbox', { name: 'Search icons' });
    await user.type(field, 'arrow{Enter}');
    await screen.findByRole('heading', { level: 1, name: /Find the right icon/ });
    expect(location).toBe('?q=arrow');

    cleanup();
    renderIconPage('/icons/bell');
    const again = await within(screen.getByRole('banner')).findByRole('searchbox', { name: 'Search icons' });
    await user.click(again);
    await user.keyboard('{Backspace}');
    await screen.findByRole('heading', { level: 1, name: /Find the right icon/ });
    expect(location).toBe('');
  });

  it('puts a modifier on the icon when its name is typed, as a second tag', async () => {
    const user = userEvent.setup();
    renderIconPage('/icons/bell');
    const field = await within(screen.getByRole('banner')).findByRole('searchbox', { name: 'Search icons' });
    // "plus" is an everyday word for the Add modifier.
    await user.type(field, 'plus');
    await screen.findByRole('button', { name: /Put Add on bell/ });
    await user.keyboard('{Enter}');
    await waitFor(() => expect(location).toBe('?modifier=add'));
    expect(within(screen.getByRole('banner')).getByRole('button', { name: 'Remove Add' })).toBeTruthy();
    // Backspace removes the last tag first: the modifier, not the icon.
    await user.keyboard('{Backspace}');
    await waitFor(() => expect(location).toBe(''));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Bell icon');
  });
});
