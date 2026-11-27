import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSectionState } from '../src/components/Customize';
import { resetExportRows } from '../src/components/ExportPanel';
import { Layout } from '../src/components/Layout';
import { ToastProvider } from '../src/components/ui';
import { lock, resetStyleCache } from '../src/lib/catalog';
import { entitledPlan, FEATURE_PLAN, legacyAllows, planAllows, type Plan } from '../src/lib/entitlements';
import { StaticPlanProvider } from '../src/lib/plan';
import { ThemeProvider } from '../src/lib/theme';
import CategoryPage from '../src/pages/CategoryPage';
import IconPage from '../src/pages/IconPage';
import { IconsPage } from '../src/pages/IconsPage';
import { styleSvgs } from './helpers';

const fetchMock = vi.fn(async (url: string) => {
  if (url.includes('/animated.json?')) {
    return new Response(readFileSync(join(__dirname, '../public/icons/animated.json'), 'utf8'));
  }
  if (url === `/modifiers.json?v=${lock.revision ?? lock.manifestSha256}`) {
    return new Response(readFileSync(join(__dirname, '../public/modifiers.json'), 'utf8'), { status: 200 });
  }
  if (url.includes('brands/')) {
    return new Response(readFileSync(join(__dirname, '../public', url.slice(url.indexOf('brands/'))), 'utf8'), { status: 200 });
  }
  const chunk = /icons\/((?:\d+\/)?\w+\/\d+\.json)$/.exec(url);
  if (chunk) return new Response(readFileSync(join(__dirname, '../public/icons', chunk[1]), 'utf8'), { status: 200 });
  const style = /icons\/(\w+)\.json/.exec(url)![1] as 'regular';
  return new Response(JSON.stringify(styleSvgs(style)), { status: 200 });
});

function desktop() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: /min-width: (768|1024)px/.test(query), media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  }));
}

function renderAs(plan: Plan | null, url: string) {
  const routes = (
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<IconsPage />} />
          <Route path="icons/:name" element={<IconPage />} />
          <Route path="categories/:slug" element={<CategoryPage />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
  const withPlan = (children: ReactNode) => (plan ? <StaticPlanProvider plan={plan}>{children}</StaticPlanProvider> : children);
  return render(<ThemeProvider><ToastProvider>{withPlan(routes)}</ToastProvider></ThemeProvider>);
}

const pane = () => screen.findByRole('complementary', { name: 'Icon panel' });
const pricingLink = (scope: HTMLElement, text: string) => {
  const prompt = within(scope).getByText(text);
  expect(within(prompt).getByRole('link', { name: 'See plans' }).getAttribute('href')).toBe('/pricing');
};

beforeEach(() => {
  resetStyleCache();
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  desktop();
});
afterEach(() => { cleanup(); resetSectionState(); resetExportRows(); vi.unstubAllGlobals(); vi.restoreAllMocks(); localStorage.clear(); });

describe('animated icon pages', () => {
  it('switches the preview and framework examples without unlocking static export controls', async () => {
    const user = userEvent.setup();
    renderAs('free', '/icons/download');
    expect(screen.getByText('Download Regular SVG')).toBeTruthy();
    expect(screen.getByText('The download icon comes in five styles.')).toBeTruthy();
    const preview = screen.getByRole('region', { name: 'Preview' });
    const grid = () => preview.querySelector('[data-preview-grid]');
    const sizes = () => within(screen.getByRole('list', { name: 'Actual size' })).getAllByRole('listitem');
    expect(sizes().map((sample) => sample.textContent)).toEqual(['16', '20', '24', '32', '48']);
    await waitFor(() => expect(sizes()[4].querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 48 48'));
    await waitFor(() => expect(grid()?.getAttribute('data-preview-grid')).toBe('64'));
    expect(grid()?.getAttribute('aria-hidden')).toBe('true');
    expect(sizes().every((sample) => !sample.querySelector('[data-preview-grid]'))).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => url.includes('/animated.json?'))).toBe(false);

    const animatedOption = screen.getByRole('radio', { name: 'Animated' });
    await user.click(animatedOption);
    expect((await screen.findByRole('img', { name: 'Download icon, Animated style' })).querySelector('.fa-download style')).not.toBeNull();
    expect(grid()?.getAttribute('data-preview-grid')).toBe('24');
    expect(document.activeElement).toBe(animatedOption);
    expect(sizes().every((sample) => sample.querySelector('svg.fa-download'))).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Pause animation' }));
    expect(screen.getByRole('button', { name: 'Play animation' })).toBeTruthy();
    expect(sizes()[0].closest('.animated-preview')?.hasAttribute('data-paused')).toBe(true);
    expect(screen.queryByText('Download Regular SVG')).toBeNull();
    expect(screen.getByRole('link', { name: 'Customize animation' }).getAttribute('href')).toBe('/icons/download?view=editor&style=animated');
    expect(screen.getByText('Copy and download animated icons with Advanced.', { exact: false })).toBeTruthy();

    for (const name of ['React', 'Vue', 'Svelte', 'SolidJS', 'Angular']) {
      await user.click(screen.getByRole('tab', { name }));
      const panel = screen.getByRole('tabpanel', { name });
      expect(panel.querySelector('pre')?.textContent).toContain('/icons/download-animated.svg');
      expect(panel.querySelector('pre')?.textContent).not.toContain('DownloadRegular');
    }

    await user.click(screen.getByRole('radio', { name: 'Regular' }));
    expect(await screen.findByText('Download Regular SVG')).toBeTruthy();
    expect(screen.getByRole('tabpanel', { name: 'Angular' }).querySelector('pre')?.textContent).not.toContain('download-animated.svg');
  });

  it('keeps an icon without animated artwork in Regular, even with an Animated URL', () => {
    renderAs(null, '/icons/accordion?style=animated');
    expect(screen.getByText('The accordion icon comes in four styles.')).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Animated' })).toBeNull();
    expect(screen.getByRole('img', { name: 'Accordion icon, Regular style' })).toBeTruthy();
  });
});

describe('entitlements', () => {
  it('follows the pricing matrix: styles, duo colors, and ZIPs with Pro; modifiers and animated icons with Advanced', () => {
    expect(FEATURE_PLAN).toEqual({ styles: 'pro', duoColors: 'pro', zip: 'pro', modifiers: 'advanced', animated: 'advanced' });
    expect((['styles', 'duoColors', 'zip', 'modifiers'] as const).map((f) => planAllows('free', f))).toEqual([false, false, false, false]);
    expect((['styles', 'duoColors', 'zip', 'modifiers'] as const).map((f) => planAllows('pro', f))).toEqual([true, true, true, false]);
    expect((['styles', 'duoColors', 'zip', 'modifiers'] as const).map((f) => planAllows('advanced', f))).toEqual([true, true, true, true]);
    // Animated icons come with Advanced only.
    expect((['free', 'pro', 'advanced'] as const).map((p) => planAllows(p, 'animated'))).toEqual([false, false, true]);
  });

  it('grants a paid plan only for an active or trialing subscription', () => {
    expect(entitledPlan({ plan: 'pro', status: 'active' })).toBe('pro');
    expect(entitledPlan({ plan: 'advanced', status: 'trialing' })).toBe('advanced');
    for (const status of ['past_due', 'canceled', 'incomplete', 'unpaid', 'paused', null]) {
      expect(entitledPlan({ plan: 'advanced', status })).toBe('free');
    }
    expect(entitledPlan({ plan: 'enterprise', status: 'active' })).toBe('free');
    expect(entitledPlan(null)).toBe('free');
  });

  it('keeps today’s free features where billing is off: only the paid styles are locked', () => {
    expect((['styles', 'duoColors', 'zip', 'modifiers', 'animated'] as const).map(legacyAllows)).toEqual([false, true, true, true, false]);
  });
});

describe('Free plan', () => {
  it('locks the modifier picker, ignores a modifier in the link, and links to Pricing', async () => {
    renderAs('free', '/?icon=agent&modifier=lock&corner=top-left');
    const panel = await pane();
    const preview = await within(panel).findByRole('img', { name: /agent, Regular, preview/ });
    pricingLink(panel, 'Add modifiers like Add, Lock, or PDF with Advanced.');
    expect(within(panel).queryByRole('tablist', { name: 'Modifier categories' })).toBeNull();
    expect(preview.innerHTML).not.toMatch(/x="1.25" y="1.25"/);
    // Regular single exports stay free.
    expect(within(panel).getByRole('button', { name: 'Download agent' }).hasAttribute('disabled')).toBe(false);
  });

  it('opens a library icon that carries a modifier as that icon, not as base plus modifier', async () => {
    renderAs('free', '/?icon=calendar-add');
    const panel = await pane();
    expect(await within(panel).findByRole('heading', { name: 'calendar-add', level: 2 })).toBeTruthy();
    expect(within(panel).getByRole('button', { name: 'Download calendar-add' }).hasAttribute('disabled')).toBe(false);
  });

  it('locks bulk ZIPs and paid styles in the Customize panel', async () => {
    renderAs('free', '/');
    const panel = await pane();
    expect(within(panel).getByRole('button', { name: 'Download all icons' }).hasAttribute('disabled')).toBe(true);
    pricingLink(panel, 'Bulk ZIP downloads come with Pro.');
    expect(within(panel).getByRole('checkbox', { name: /Filled/ }).hasAttribute('disabled')).toBe(true);
  });

  it('locks paid-style exports and custom duo colors in the inspector', async () => {
    renderAs('free', '/?icon=search&style=duocolor');
    const panel = await pane();
    await within(panel).findByRole('img', { name: /search, Duocolor, preview/ });
    expect(within(panel).getByRole('button', { name: 'Download search' }).hasAttribute('disabled')).toBe(true);
    pricingLink(panel, 'Copy and download Filled, Duocolor, and Duotone icons with Pro.');
    pricingLink(panel, 'Choose your own primary and accent colors with Pro.');
    expect(within(panel).queryByLabelText('Primary')).toBeNull();
  });

  it('locks a multi-icon selection ZIP', async () => {
    const user = userEvent.setup();
    renderAs('free', '/?icon=search');
    const panel = await pane();
    const [userCell] = await screen.findAllByRole('button', { name: 'user' });
    await user.keyboard('{Shift>}');
    await user.click(userCell);
    await user.keyboard('{/Shift}');
    expect(within(panel).getByRole('button', { name: 'Download 2 icons (.zip)' }).hasAttribute('disabled')).toBe(true);
    pricingLink(panel, 'Bulk ZIP downloads come with Pro.');
  });

  it('locks the category ZIP', async () => {
    renderAs('free', '/categories/time-calendar');
    const button = await screen.findByRole('button', { name: /^Download \d+ icons$/ });
    expect(button.hasAttribute('disabled')).toBe(true);
    pricingLink(document.body, 'Bulk ZIP downloads come with Pro.');
  });

  it('says how to get a modifier from a shared icon-page link', async () => {
    renderAs('free', '/icons/clock?modifier=sparkle');
    pricingLink(document.body, 'Add modifiers like Add, Lock, or PDF with Advanced.');
  });
});

describe('Pro plan', () => {
  it('unlocks paid styles, duo colors, and bulk ZIPs, but not modifiers', async () => {
    renderAs('pro', '/?icon=search&style=duocolor');
    const panel = await pane();
    await within(panel).findByRole('img', { name: /search, Duocolor, preview/ });
    await waitFor(() => expect(within(panel).getByRole('button', { name: 'Download search' }).hasAttribute('disabled')).toBe(false));
    expect(within(panel).getByLabelText('Primary')).toBeTruthy();
    expect(within(panel).queryByText(/with Pro\./)).toBeNull();
    pricingLink(panel, 'Add modifiers like Add, Lock, or PDF with Advanced.');
  });

  it('swaps the two Duocolor fields and restores them when pressed again', async () => {
    const user = userEvent.setup();
    renderAs('pro', '/?icon=search&style=duocolor');
    const panel = await pane();
    const primary = within(panel).getByLabelText<HTMLInputElement>('Primary');
    const secondary = within(panel).getByLabelText<HTMLInputElement>('Secondary');
    const swap = within(panel).getByRole('button', { name: 'Swap primary and secondary colors' });
    const colors = [primary.value, secondary.value];
    expect(colors[0]).not.toBe(colors[1]);
    await user.click(swap);
    await waitFor(() => expect([primary.value, secondary.value]).toEqual([colors[1], colors[0]]));
    swap.focus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect([primary.value, secondary.value]).toEqual(colors));
  });

  it('downloads all four styles as one ZIP', async () => {
    const user = userEvent.setup();
    renderAs('pro', '/');
    const panel = await pane();
    const solid = within(panel).getByRole('checkbox', { name: /Filled/ });
    expect(solid.hasAttribute('disabled')).toBe(false);
    await user.click(solid);
    expect(within(panel).getByText(/SVGs in Regular and Filled, in one ZIP/)).toBeTruthy();
    expect(within(panel).getByRole('button', { name: 'Download all icons' }).hasAttribute('disabled')).toBe(false);
    expect(within(panel).queryByText('Bulk ZIP downloads come with Pro.')).toBeNull();
  });
});

describe('Advanced plan', () => {
  it('unlocks the modifier picker and applies a modifier from the link', async () => {
    renderAs('advanced', '/?icon=agent&modifier=lock&corner=top-left');
    const panel = await pane();
    const preview = await within(panel).findByRole('img', { name: /agent, Regular, preview/ });
    expect(await within(panel).findByRole('tablist', { name: 'Modifier categories' }, { timeout: 8000 })).toBeTruthy();
    await waitFor(() => expect(preview.innerHTML).toMatch(/x="1.25" y="1.25"/));
    expect(within(panel).queryByText(/with Advanced\./)).toBeNull();
  });
});

describe('Billing off (no plan provider)', () => {
  it('keeps today’s access: modifiers and the Regular ZIP stay free, paid styles say coming soon', async () => {
    renderAs(null, '/?icon=agent');
    const panel = await pane();
    expect(await within(panel).findByRole('tablist', { name: 'Modifier categories' }, { timeout: 8000 })).toBeTruthy();
    expect(within(panel).queryByRole('link', { name: 'See plans' })).toBeNull();
  });
});
