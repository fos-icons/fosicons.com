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
