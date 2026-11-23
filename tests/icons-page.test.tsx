import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { Layout } from '../src/components/Layout';
import { resetSectionState } from '../src/components/Customize';
import { resetExportRows } from '../src/components/ExportPanel';
import { ToastProvider } from '../src/components/ui';
import { artworkDirectory, catalog, ICON_CHUNK, lock, resetStyleCache } from '../src/lib/catalog';
import { ThemeProvider } from '../src/lib/theme';
import { IconsPage } from '../src/pages/IconsPage';
import IconPage from '../src/pages/IconPage';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { styleSvgs } from './helpers';
import { brands } from '../src/lib/brands';

let location = '';
let pathname = '';
function Spy() {
  const l = useLocation();
  location = l.search;
  pathname = l.pathname;
  return null;
}

function renderAt(url: string) {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="*" element={<><IconsPage /><Spy /></>} />
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
  if (url === `/modifiers.json?v=${lock.revision ?? lock.manifestSha256}`) {
    return new Response(readFileSync(join(__dirname, '../public/modifiers.json'), 'utf8'), { status: 200 });
  }
  if (url.includes('brands/')) {
    return new Response(readFileSync(join(__dirname, '../public', url.slice(url.indexOf('brands/'))), 'utf8'), { status: 200 });
  }
  const chunk = /icons\/((?:\d+\/)?\w+\/\d+\.json)$/.exec(url);
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
    expect(screen.getByText(`${(catalog.icons.length + brands.approved.length).toLocaleString('en-US')} icons`)).toBeTruthy();
    const headings = within(screen.getByRole('list', { name: 'Regular icons' })).getAllByRole('heading');
    expect(headings.slice(0, 4).map((heading) => heading.textContent)).toEqual(['Essentials', 'AI & agents', 'Time & calendar', 'Interfaces']);
    await screen.findAllByRole('button', { name: 'search' });
    const artwork = fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => !url.includes('brands/'));
    // The default 48px grid draws the 48px artwork, which ships as chunks only.
    const chunks = Math.ceil(catalog.icons.length / ICON_CHUNK);
    expect(artwork).toEqual(Array.from({ length: chunks }, (_, n) => `/${artworkDirectory}/48/regular/${n}.json`));
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
    expect(within(toolbarStyle).getByRole('radio', { name: 'Regular' }).getAttribute('aria-description')).toBe('Free');
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

  it('reloads once for artwork from a newer deploy, then offers a reload', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    fetchMock.mockImplementation(async () => new Response(null, { status: 404 }));
    sessionStorage.removeItem('fos-artwork-reload');
    renderAt('/');
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(sessionStorage.getItem('fos-artwork-reload')).toBe(lock.manifestSha256);

    cleanup();
    resetStyleCache();
    renderAt('/');
    await screen.findByText('Fos Icons was just updated. Reload the page to get the latest icons.');
    expect(reload).toHaveBeenCalledTimes(1);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reload' }));
    expect(reload).toHaveBeenCalledTimes(2);
    sessionStorage.removeItem('fos-artwork-reload');
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

  it('finds brand marks in the same grid as icons', async () => {
    renderAt('/?q=spotify');
    expect(await screen.findByRole('button', { name: 'spotify' })).toBeTruthy();
  });

  it('restores style, category, and the selected icon from a shared URL', async () => {
    renderAt('/?category=Essentials&style=solid&icon=search');
    expect(await screen.findByRole('heading', { name: 'search', level: 2 })).toBeTruthy();
    expect(screen.getAllByRole('radio', { name: 'Solid', checked: true })).toHaveLength(2);
    expect((screen.getByLabelText('Category') as HTMLSelectElement).value).toBe('Essentials');
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/48\/filled\/0\.json$/);
  });

  it('closes the mobile sheet with its handle or a swipe down, not an X', async () => {
    const user = userEvent.setup();
    renderAt('/?icon=search');
    await screen.findByRole('heading', { name: 'search', level: 2 });
    const sheet = document.querySelector('dialog.sheet') as HTMLDialogElement;
    expect(sheet.open).toBe(true);
    // The X stays in the markup (desktop uses it) but the sheet hides it.
    expect(within(sheet).getByRole('button', { name: 'Clear selection' }).classList.contains('sheet-close')).toBe(true);
    // The page behind stays still while the sheet is open.
    expect(document.body.style.position).toBe('fixed');
    await user.click(within(sheet).getByRole('button', { name: 'Close panel' }));
    await waitFor(() => expect(sheet.open).toBe(false));
    expect(location).toBe('');
    expect(document.body.style.position).toBe('');
  });

  it('closes the mobile sheet when it is swiped down past the threshold', async () => {
    renderAt('/?icon=user');
    await screen.findByRole('heading', { name: 'user', level: 2 });
    const sheet = document.querySelector('dialog.sheet') as HTMLDialogElement;
    const handle = within(sheet).getByRole('button', { name: 'Close panel' });
    const touch = (type: string, y: number, timeStamp: number) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        touches: { value: type === 'touchend' ? [] : [{ clientX: 100, clientY: y }] },
        timeStamp: { value: timeStamp },
      });
      handle.dispatchEvent(event);
    };
    // A short pull springs back.
    touch('touchstart', 10, 0);
    touch('touchmove', 40, 200);
    expect(sheet.style.transform).toBe('translateY(30px)');
    touch('touchend', 40, 400);
    expect(sheet.style.transform).toBe('');
    expect(sheet.open).toBe(true);
    // A long one closes the sheet.
    touch('touchstart', 10, 1000);
    touch('touchmove', 60, 1100);
    touch('touchmove', 200, 1300);
    expect(sheet.style.transform).toBe('translateY(190px)');
    touch('touchend', 200, 1320);
    await waitFor(() => expect(sheet.open).toBe(false));
  });

  it('switching style updates the URL and fetches that style', async () => {
    const user = userEvent.setup();
    renderAt('/?icon=user-add');
    await screen.findByRole('heading', { name: 'user', level: 2 });
    const [toolbarStyle] = screen.getAllByRole('radiogroup', { name: 'Icon style' });
    await user.click(within(toolbarStyle).getByRole('radio', { name: 'Duotone' }));
    expect(location).toContain('style=duotone');
    expect(pathname).toBe('/icons/user-add');
    await act(async () => {});
    expect(fetchMock.mock.calls.map((c) => c[0]).some((u) => /\/48\/duotone\/\d+\.json$/.test(u))).toBe(true);
    expect(screen.getByRole('button', { name: 'Download user' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Copy' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'arrow-up' }).getAttribute('aria-description')).toBe('Premium');
  });

  it.each([
    ['calendar-record', 'calendar', 'Record', 'Bottom right', '12.75'],
    ['filter-plus', 'filter', 'Add', 'Bottom right', '12.75'],
    ['clock-check', 'clock', 'Check', 'Bottom left', '1.25'],
  ])('opens %s with its authored modifier selected and lets the user edit the base', async (preset, base, label, corner, x) => {
    const user = userEvent.setup();
    renderAt(`/?q=${preset}&icon=${preset}`);

    const chosen = await screen.findByRole('button', { name: new RegExp(`^${label} modifier`) });
    expect(chosen.getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByLabelText('Library versions')).toBeNull();
    expect(screen.queryByText(/^A library icon:/)).toBeNull();
    expect(screen.getByRole('button', { name: corner }).getAttribute('aria-pressed')).toBe('true');
    const preview = screen.getByRole('img', { name: new RegExp(`${base}, Regular, preview`) });
    expect(preview.querySelectorAll(`svg[x="${x}"][y="12.75"]`)).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Top left' }));
    expect(pathname).toBe(`/icons/${base}`);
    expect(location).toBe(`?q=${preset}&modifier=${label.toLowerCase()}&corner=top-left`);
    const edited = await screen.findByRole('img', { name: new RegExp(`${base}, Regular, preview`) });
    await waitFor(() => expect(edited.querySelectorAll('svg[x="1.25"][y="1.25"]')).toHaveLength(1));

    await user.click(screen.getByRole('button', { name: 'None' }));
    expect(pathname).toBe(`/icons/${base}`);
    expect(location).toBe(`?q=${preset}`);
    expect(edited.querySelector('svg[x][y]')).toBeNull();
  });

  it('previews any modifier on an icon, in the corners it supports', async () => {
    const user = userEvent.setup();
    renderAt('/?icon=agent');
    const preview = await screen.findByRole('img', { name: /agent, Regular, preview/ });
    expect(preview.innerHTML).not.toContain('clip-path');

    const tablist = within(await screen.findByRole('tablist', { name: 'Modifier categories' }, { timeout: 8000 }));
    expect(tablist.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Actions', 'General']);
    await user.click(tablist.getByRole('tab', { name: 'General' }));
    const general = within(screen.getByRole('tabpanel', { name: 'General' }));
    for (const label of ['Dot', 'Lock', 'Coins', '24', 'Search', 'Phone', 'Shield', 'Home']) {
      expect(general.getByRole('button', { name: new RegExp(`^${label} modifier`) })).toBeTruthy();
    }
    expect(general.queryByRole('button', { name: /^(PDF|4K) modifier/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: /^Lock modifier/ }));
    expect(screen.getByRole('button', { name: /^Lock modifier/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Bottom right' }).getAttribute('aria-pressed')).toBe('true');
    expect(preview.innerHTML).toMatch(/x="12.75" y="12.75"/);

    await user.click(screen.getByRole('button', { name: 'Top left' }));
    expect(preview.innerHTML).toMatch(/x="1.25" y="1.25"/);
    // Switching modifiers keeps the chosen corner.
    await user.click(screen.getByRole('tab', { name: 'Actions' }));
    const actions = within(screen.getByRole('tabpanel', { name: 'Actions' }));
    expect(actions.queryByRole('button', { name: /^(Search|Phone|Shield|Home) modifier/ })).toBeNull();
    // Add and remove lead, then the arrows, then everything else.
    const order = actions.getAllByRole('button', { name: / modifier/ }).map((b) => b.getAttribute('title'));
    expect(order.slice(0, 8)).toEqual(['Add', 'Remove', 'Arrow up', 'Arrow down', 'Arrow left', 'Arrow right', 'Reply', 'Forward']);
    await user.click(screen.getByRole('button', { name: /^Add modifier/ }));
    expect(screen.getByRole('button', { name: 'Top left' }).getAttribute('aria-pressed')).toBe('true');
    expect(preview.innerHTML).toMatch(/x="1.25" y="1.25"/);

    await user.click(screen.getByRole('button', { name: 'None' }));
    expect(preview.innerHTML).not.toContain('clip-path');
  });

  it('sizes the modifier with the icon: 20px at 48px, 11px at 24px', async () => {
    const user = userEvent.setup();
    renderAt('/?icon=agent');
    const preview = await screen.findByRole('img', { name: /agent, Regular, preview/ });
    await user.click(await screen.findByRole('tab', { name: 'Actions' }, { timeout: 8000 }));
    await user.click(screen.getByRole('button', { name: /^Add modifier/ }));
    const modifierSize = () => screen.getByRole('slider', { name: 'Modifier size' });
    const iconSize = () => screen.getByRole('slider', { name: 'Size' });
    // 48px (the default) draws the badge as authored.
    expect(modifierSize().getAttribute('aria-valuetext')).toBe('20px on a 48px icon');
    expect(preview.innerHTML).not.toContain('scale(');

    fireEvent.change(iconSize(), { target: { value: '24' } });
    expect(modifierSize().getAttribute('aria-valuetext')).toBe('11px on a 24px icon');
    expect([modifierSize().getAttribute('min'), modifierSize().getAttribute('max')]).toEqual(['8', '12']);
    // 24px draws from the 24px artwork, which loads on demand.
    await waitFor(() => expect(screen.getByRole('img', { name: /agent, Regular, preview/ }).innerHTML).toContain('scale(1.1'));

    // An adjustment carries across sizes in proportion, until reset.
    fireEvent.change(modifierSize(), { target: { value: '12' } });
    expect(modifierSize().getAttribute('aria-valuetext')).toBe('12px on a 24px icon');
    fireEvent.change(iconSize(), { target: { value: '48' } });
    expect(modifierSize().getAttribute('aria-valuetext')).toBe('22px on a 48px icon');
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(modifierSize().getAttribute('aria-valuetext')).toBe('20px on a 48px icon');
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
    expect(fetchMock.mock.calls.some((c) => /modifiers\.json(?:\?|$)/.test(String(c[0])))).toBe(false);
  });

  it('restores a modifier and corner from a shared link', async () => {
    renderAt('/?icon=clock&modifier=sparkle&corner=top-right');
    await waitFor(() => expect(screen.getByRole('button', { name: /^Sparkle modifier/ }).getAttribute('aria-pressed')).toBe('true'), { timeout: 8000 });
    expect(screen.getByRole('button', { name: 'Top right' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('offers the authored Dot in General and applies its selected corner', async () => {
    const user = userEvent.setup();
    renderAt('/?icon=bell');
    await user.click(await screen.findByRole('tab', { name: 'General' }, { timeout: 8000 }));
    await user.click(screen.getByRole('button', { name: /^Dot modifier/ }));
    await user.click(screen.getByRole('button', { name: 'Top right' }));
    expect(screen.getByRole('button', { name: 'Top right' }).getAttribute('aria-pressed')).toBe('true');
    const preview = screen.getByRole('img', { name: /bell, Regular, preview/ });
    expect(preview.querySelector('svg[viewBox="0 0 10 10"] circle[r="3"]')).toBeTruthy();
  });

  it('offers file-type labels on files, only in the corners they support', async () => {
    const user = userEvent.setup();
    renderAt('/?icon=file');
    await user.click(await screen.findByRole('tab', { name: 'General' }, { timeout: 8000 }));
    await user.click(screen.getByRole('button', { name: /^PDF modifier/ }));
    const enabled = ['Top left', 'Top right', 'Bottom left', 'Bottom right']
      .filter((c) => !(screen.getByRole('button', { name: c }) as HTMLButtonElement).disabled);
    expect(enabled).toEqual(['Bottom left']);
  });

  it('falls back to a modifier\'s own corner when it cannot sit in the chosen one', async () => {
    const user = userEvent.setup();
    renderAt('/?icon=file');
    await user.click(await screen.findByRole('tab', { name: 'Actions' }, { timeout: 8000 }));
    await user.click(screen.getByRole('button', { name: /^Add modifier/ }));
    await user.click(screen.getByRole('button', { name: 'Top right' }));
    await user.click(screen.getByRole('tab', { name: 'General' }));
    await user.click(screen.getByRole('button', { name: /^PDF modifier/ }));
    expect(screen.getByRole('button', { name: 'Bottom left' }).getAttribute('aria-pressed')).toBe('true');
    // The chosen corner comes back for the next modifier that fits there.
    await user.click(screen.getByRole('tab', { name: 'Actions' }));
    await user.click(screen.getByRole('button', { name: /^Arrow up modifier/ }));
    expect(screen.getByRole('button', { name: 'Top right' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('remembers the chosen corner through None', async () => {
    const user = userEvent.setup();
    renderAt('/?icon=agent');
    await user.click(await screen.findByRole('tab', { name: 'Actions' }, { timeout: 8000 }));
    await user.click(screen.getByRole('button', { name: /^Add modifier/ }));
    await user.click(screen.getByRole('button', { name: 'Top left' }));
    await user.click(screen.getByRole('button', { name: 'None' }));
    await user.click(screen.getByRole('button', { name: /^Arrow right modifier/ }));
    expect(screen.getByRole('button', { name: 'Top left' }).getAttribute('aria-pressed')).toBe('true');
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
    expect(ex.getByText(/JPGs have white backgrounds/)).toBeTruthy();
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

  it('links Pricing from the header, Documentation from the intro, and GitHub and Privacy from the footer', () => {
    renderAt('/');
    const header = screen.getByRole('banner');
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Documentation' }).getAttribute('href')).toBe('/docs');
    expect(within(header).getByRole('link', { name: 'Pricing' }).getAttribute('href')).toBe('/pricing');
    expect(within(header).queryByRole('link', { name: /GitHub/ })).toBeNull();
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

  it('shows one-color Solid brand marks off Regular', async () => {
    renderAt('/?category=Brands&style=solid');
    const spotify = await screen.findByRole('button', { name: 'spotify' });
    await waitFor(() => expect(spotify.querySelector('svg')).toBeTruthy());
    const mark = spotify.querySelector('svg')!;
    expect(mark.hasAttribute('data-brand')).toBe(false);
    expect(mark.innerHTML).toContain('currentColor');
  });

  it('keeps brand marks in their own colors on Regular', async () => {
    renderAt('/?category=Brands');
    const spotify = await screen.findByRole('button', { name: 'spotify' });
    await waitFor(() => expect(spotify.querySelector('svg[data-brand]')).toBeTruthy());
  });

  it('offers only Regular and Solid in the Brands category, and moves duo links to Solid', async () => {
    renderAt('/?category=Brands&style=duotone');
    const [switcher] = screen.getAllByRole('radiogroup', { name: 'Icon style' });
    expect(within(switcher).getAllByRole('radio')).toEqual(['Regular', 'Solid'].map((name) => within(switcher).getByRole('radio', { name })));
    expect(within(switcher).getByRole('radio', { name: 'Solid' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('list', { name: /Solid icons/ })).toBeTruthy();
  });

  it('lists Brands as the last category, not a style, and opens old Brands links there', async () => {
    renderAt('/?style=brands');
    const [switcher] = screen.getAllByRole('radiogroup', { name: 'Icon style' });
    // Brands come in Regular and Solid only.
    expect(within(switcher).getAllByRole('radio')).toEqual(['Regular', 'Solid'].map((name) => within(switcher).getByRole('radio', { name })));
    const category = screen.getByRole('combobox', { name: 'Category' }) as HTMLSelectElement;
    expect(category.value).toBe('Brands');
    expect([...category.options].at(-1)?.value).toBe('Brands');
    expect(await screen.findByRole('button', { name: 'spotify' })).toBeTruthy();
    const { loadBrands } = await import('../src/lib/brands');
    const svgs = await loadBrands('regular');
    expect(Object.keys(svgs)).toHaveLength(brands.approved.length);
    expect(svgs['hugging-face']).toBeTruthy();
    const ids = Object.values(svgs).flatMap((svg) => [...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
    expect(new Set(ids).size).toBe(ids.length);
    expect(svgs.facebook).toMatch(/id="brand-facebook-regular-0"/);
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
    // Default: 48px, drawn from the 48px artwork at its own 2px stroke.
    expect(grid.style.getPropertyValue('--glyph-size')).toBe('48px');
    expect(grid.style.getPropertyValue('--stroke-scale')).toBe('1');
    expect(within(pane).getByText('Auto')).toBeTruthy();
    expect(within(pane).queryByRole('button', { name: 'Reset to defaults' })).toBeNull();

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
    // At 32px the 32px artwork draws it: 2.5 grid units over its own 1.125.
    fireEvent.change(within(pane).getByRole('slider', { name: 'Size' }), { target: { value: '32' } });
    expect(grid.style.getPropertyValue('--stroke-scale')).toBe('2.2222');
    await user.click(within(pane).getByRole('button', { name: 'Use auto' }));
    // Auto at an optical size is its designed stroke.
    expect(grid.style.getPropertyValue('--stroke-scale')).toBe('1');

    await user.click(within(pane).getByRole('button', { name: /Reset to defaults/ }));
    expect(within(pane).queryByRole('button', { name: 'Reset to defaults' })).toBeNull();
    expect(document.activeElement).toBe(within(pane).getByRole('heading', { name: 'Customize' }));
    expect(grid.style.getPropertyValue('--stroke-scale')).toBe('1');
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

  it('keeps quick actions available while collapsed and expands directly to code', async () => {
    const user = userEvent.setup();
    renderAt('/');
    const pane = await screen.findByRole('complementary', { name: 'Icon panel' });
    // Feedback lives in the site header; the pane bar has no page link until an icon is selected.
    const feedback = within(screen.getByRole('banner')).getByRole('button', { name: 'Feedback' });
    expect(feedback.getAttribute('aria-haspopup')).toBe('dialog');
    expect(within(pane).queryByRole('button', { name: 'Feedback' })).toBeNull();
    expect(within(pane).queryByRole('link', { name: 'Open icon page' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Theme:/ })).toBeNull();
    await user.click(within(pane).getByRole('button', { name: 'Collapse panel' }));
    expect(screen.queryByRole('button', { name: /^Theme:/ })).toBeNull();
    expect(within(pane).getByRole('button', { name: 'Expand panel' }).getAttribute('aria-expanded')).toBe('false');
    expect(document.getElementById('side-pane-body')!.hidden).toBe(true);
    expect(localStorage.getItem('fos-pane-collapsed')).toBe('1');

    expect(within(pane).getByRole('button', { name: 'Size' })).toBeTruthy();
    expect(within(pane).getByRole('button', { name: 'Stroke width' })).toBeTruthy();
    expect(within(pane).getByRole('button', { name: 'Download all icons' })).toBeTruthy();

    await user.click((await screen.findAllByRole('button', { name: 'search' }))[0]);
    expect(document.getElementById('side-pane-body')!.hidden).toBe(true);
    const copy = within(pane).getByRole('button', { name: 'Copy SVG' });
    await waitFor(() => expect((copy as HTMLButtonElement).disabled).toBe(false));
    expect(within(pane).getByRole('button', { name: 'Download SVG' })).toBeTruthy();
    await user.click(copy);
    expect(await navigator.clipboard.readText()).toContain('width="48"');

    await user.click(within(pane).getByRole('button', { name: 'Open code snippets' }));
    expect(document.getElementById('side-pane-body')!.hidden).toBe(false);
    expect(within(pane).getByRole('heading', { name: 'search', level: 2 })).toBeTruthy();
    expect(within(pane).getByRole('link', { name: 'Open icon page' }).getAttribute('href')).toBe('/icons/search');
    await waitFor(() => expect(within(pane).getByRole('button', { name: 'Code' }).getAttribute('aria-expanded')).toBe('true'));

    await user.click(within(pane).getByRole('button', { name: 'Clear selection' }));
    expect(location).toBe('');
    expect(within(pane).getByRole('heading', { name: 'Customize' })).toBeTruthy();
  });

  it('carries the grid-wide stroke into the selected icon and its code note', async () => {
    const user = userEvent.setup();
    renderAt('/');
    const pane = await screen.findByRole('complementary', { name: 'Icon panel' });
    const slider = within(pane).getByRole('slider', { name: 'Stroke width' });
    // Strokes read in real pixels at the icon size: Auto at 48px is 2px.
    expect(slider.getAttribute('aria-valuetext')).toBe('2px, automatic for this size');
    expect(within(pane).getByText(/1px at 16px, 1\.25px at 24px, 1\.5px at 32px, 2px at 48px, 2\.5px at 64px/)).toBeTruthy();
    fireEvent.change(slider, { target: { value: '2' } });
    expect(slider.getAttribute('aria-valuetext')).toBe('4px');
    expect(within(pane).getByText('Your stroke scales with the icon: 2px at 24px.')).toBeTruthy();
    await user.click((await screen.findAllByRole('button', { name: 'search' }))[0]);
    const preview = await within(pane).findByRole('img', { name: /search, Regular, preview/ });
    // 2 grid units on the 48px artwork's own grid.
    expect(preview.innerHTML).toContain('stroke-width="4"');
    await user.click(within(pane).getByRole('button', { name: 'Code' }));
    // Real pixels at 48px: the packages scale the 24px design (1.25 → 2.5px).
    expect(within(pane).getByText(
      'These examples scale the 24px design to 48px, with 2.5px lines. Download the SVG to keep the 48px design with 4px lines.',
    )).toBeTruthy();
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
    expect(pathname).toBe('/icons/search');
    expect(location).toBe('');
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
      // 32px is drawn from the 32px artwork: 2 grid units is 2.667 on its grid.
      expect(svg).toContain('width="32"');
      expect(svg).toContain('viewBox="0 0 32 32"');
      expect(svg).toContain('stroke-width="2.667"');
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
      expect(tip()).toMatch(/^Search 1,\d00\+ icons/);
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
    const solid = within(section).getByRole('tab', { name: 'SolidJS' });
    await user.click(solid);
    expect(code()).toContain("import { SearchRegular } from '@fos-icons/solid';");
    expect(code()).toContain('<SearchRegular size={48} />');
    expect(solid.getAttribute('aria-selected')).toBe('true');
    expect(section.querySelector('.code-block')!.getAttribute('data-lang')).toBe('tsx');
    await user.click(within(section).getByRole('button', { name: 'Copy' }));
    expect(await navigator.clipboard.readText()).toBe(code());
    expect(localStorage.getItem('fos:code-tab')).toBe('solid');
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
    const variant = within(pane).getByRole('radiogroup', { name: 'Site appearance' });
    expect(within(variant).getAllByRole('radio').map((option) => option.textContent)).toEqual(['Light', 'Warm', 'Dark']);
    await user.click(within(variant).getByRole('radio', { name: 'Dark' }));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('fos-theme')).toBe('dark');
    await user.click(within(variant).getByRole('radio', { name: 'Light' }));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    await user.click(within(variant).getByRole('radio', { name: 'Warm' }));
    expect(document.documentElement.classList.contains('ivory')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('fos-theme')).toBe('ivory');
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

  it('keeps SVG copy and file downloads available for Regular only', async () => {
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
    await waitFor(() => expect(copy.hasAttribute('disabled')).toBe(true));
    expect(png.hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Download Solid SVG' }).hasAttribute('disabled')).toBe(true);
    await user.click(copy);
    expect(await navigator.clipboard.readText()).toBe(styleSvgs('regular')['triangle-right']);
  });

  it('offers copyable Svelte, SolidJS, and Angular code on icon pages and updates it with the style', async () => {
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

    const solid = within(section).getByRole('tab', { name: 'SolidJS' });
    await user.click(solid);
    const solidCode = () => section.querySelector('.code-block[data-lang="tsx"] code')!.textContent;
    expect(solidCode()).toContain("import { TriangleRightFilled } from '@fos-icons/solid';");
    expect(solidCode()).toContain('<TriangleRightFilled />');
    await user.click(within(section).getAllByRole('button', { name: 'Copy' })[0]);
    expect(await navigator.clipboard.readText()).toBe(solidCode());
    await user.click(within(preview).getByRole('radio', { name: 'Duocolor' }));
    expect(solidCode()).toContain('TriangleRightDuocolor');
    expect(solidCode()).not.toContain('TriangleRightFilled');
    expect(solid.getAttribute('aria-selected')).toBe('true');
    await user.click(within(preview).getByRole('radio', { name: 'Solid' }));

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
