import { expect, it } from 'vitest';
import { orderBrowseIcons } from '../src/lib/browse-order';
import { catalog } from '../src/lib/catalog';

it('uses the Figma category order while retaining the separate Lifestyle categories', () => {
  const categories = [...new Set(orderBrowseIcons(catalog.icons).map((icon) => icon.category))];
  expect(categories.slice(0, 4)).toEqual(['Essentials', 'AI & agents', 'Time & calendar', 'Interfaces']);
  expect(categories.at(-1)).toBe('Weather');
  expect(categories.slice(categories.indexOf('Shapes') + 1, -1)).toEqual([
    'Sports & fitness', 'Transport & space', 'Health & medical', 'Food & drink',
    'Nature & animals', 'Music & instruments', 'Religion & spirituality', 'Professions',
  ]);
  expect(categories).toHaveLength(catalog.categories.length);
});

it('keeps Essentials search and zoom icons adjacent', () => {
  const names = orderBrowseIcons(catalog.icons).filter((icon) => icon.category === 'Essentials').map((icon) => icon.name);
  expect(names.slice(names.indexOf('search'), names.indexOf('search') + 6)).toEqual([
    'search', 'search-scan', 'search-selection', 'search-sparkles', 'zoom-in', 'zoom-out',
  ]);
});

it('groups funnel icons and line-filter icons in separate adjacent runs', () => {
  const names = orderBrowseIcons(catalog.icons).filter(({ category }) => category === 'Interfaces').map(({ name }) => name);
  const funnels = ['filter', 'filter-check', 'filter-edit', 'filter-plus', 'filter-search', 'filter-x', 'filter-dollar', 'filter-off'];
  const lines = ['filter-lines', 'filter-circle', 'filter-lines-edit', 'filter-lines-plus', 'filter-lines-x', 'filter-square'];
  expect(names.slice(names.indexOf('filter'), names.indexOf('filter') + funnels.length)).toEqual(funnels);
  expect(names.slice(names.indexOf('filter-lines'), names.indexOf('filter-lines') + lines.length)).toEqual(lines);
});
