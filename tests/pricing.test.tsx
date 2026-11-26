import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { primeArtwork } from '../src/lib/artwork';
import PricingPage from '../src/pages/PricingPage';

afterEach(cleanup);

beforeEach(() => {
  const sample = '<svg viewBox="0 0 64 64"></svg>';
  primeArtwork({
    'regular@64': { calendar: sample },
    'filled@64': { calendar: sample },
    'duocolor@64': { calendar: sample },
    'duotone@64': { calendar: sample, 'calendar-add': sample },
  });
});

it('shows the annual launch plans without offering checkout', () => {
  render(<MemoryRouter><PricingPage /></MemoryRouter>);
  const free = within(screen.getByRole('article', { name: 'Free' }));
  const pro = within(screen.getByRole('article', { name: 'Pro' }));
  const advanced = within(screen.getByRole('article', { name: 'Advanced' }));
  expect(free.getByText('$0')).toBeTruthy();
  expect(free.getByRole('link', { name: 'Browse Regular icons' }).getAttribute('href')).toBe('/?style=regular');
  expect(free.queryByText(/^Renews at/)).toBeNull();
  expect(pro.getByText('$49')).toBeTruthy();
  expect(pro.getByText('Renews at $69 USD/year')).toBeTruthy();
  expect(advanced.getByText('$99')).toBeTruthy();
  expect(advanced.getByText('Renews at $129 USD/year')).toBeTruthy();
  for (const paid of [pro, advanced]) {
    expect(paid.getByText('USD for the first year')).toBeTruthy();
    expect(paid.getByText('Coming soon')).toBeTruthy();
    expect(paid.queryByRole('link')).toBeNull();
    expect(paid.queryByRole('button')).toBeNull();
  }
  expect(screen.queryByRole('heading', { name: 'Test Stripe checkout' })).toBeNull();
});

it('compares styles, exports, modifiers, and integrations by tier', () => {
  render(<MemoryRouter><PricingPage /></MemoryRouter>);
  const table = within(screen.getByRole('table', { name: 'Compare plans' }));
  const statuses = (name: string) => within(table.getByRole('row', { name: new RegExp(`^${name}`) }))
    .getAllByRole('cell').map((cell) => cell.textContent);
  const all = ['Included', 'Included', 'Included'];
  const paid = ['Not included', 'Included', 'Included'];
  const advanced = ['Not included', 'Not included', 'Included'];
  expect(table.getAllByRole('rowgroup')).toHaveLength(6);
  expect(statuses('Regular icons')).toEqual(all);
  expect(statuses('Individual transparent PNG downloads')).toEqual(all);
  expect(statuses('Filled icons')).toEqual(paid);
  expect(statuses('Duocolor icons')).toEqual(paid);
  expect(statuses('Duotone icons')).toEqual(paid);
  expect(statuses('Bulk ZIP exports for SVG')).toEqual(paid);
  expect(statuses('Bulk ZIP exports for PNG')).toEqual(paid);
  expect(statuses('Find icons from Claude Code, ChatGPT, and Codex')).toEqual(all);
  expect(statuses('Get icon names and code for all four styles')).toEqual(all);
  expect(statuses('Export individual icons with modifiers')).toEqual(advanced);
  expect(statuses('Export icons with modifiers in bulk')).toEqual(advanced);
  expect(screen.getByRole('link', { name: 'Figma library' }).getAttribute('href')).toBe('/docs#figma');
});
