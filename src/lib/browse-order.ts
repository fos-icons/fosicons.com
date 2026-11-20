import type { IconEntry } from './catalog';

const figmaOrder = [
  'Essentials', 'AI & agents', 'Time & calendar', 'Interfaces', 'Navigation', 'Files',
  'Communication', 'Security', 'Media & devices', 'Data & commerce', 'Workspace', 'Shapes',
  // The Figma Lifestyle group, in its frame order; each stays its own filter on the site.
  'Sports & fitness', 'Transport & space', 'Health & medical', 'Food & drink',
  'Nature & animals', 'Music & instruments', 'Religion & spirituality', 'Professions',
];
const categoryRanks = new Map(figmaOrder.map((name, i) => [name, i]));
// Brand marks come last, after every icon category.
const categoryRank = (name: string) => name === 'Brands' ? figmaOrder.length + 2
  : name === 'Weather' ? figmaOrder.length + 1 : categoryRanks.get(name) ?? figmaOrder.length;

export function compareBrowseCategories(a: string, b: string): number {
  return categoryRank(a) - categoryRank(b) || a.localeCompare(b);
}

function family(icon: IconEntry): string {
  const name = icon.composition?.base ?? icon.name;
  if (icon.category === 'Interfaces' && /^(filter-lines(?:-|$)|filter-(circle|square)$)/.test(name)) return 'filter-lines';
  const prefix = name.split('-')[0];
  return icon.category === 'Essentials' && prefix === 'zoom' ? 'search' : prefix;
}

export function orderBrowseIcons(icons: IconEntry[]): IconEntry[] {
  return [...icons].sort((a, b) => compareBrowseCategories(a.category, b.category)
    || family(a).localeCompare(family(b))
    || Number(b.name === family(b)) - Number(a.name === family(a))
    || (a.composition?.base ?? a.name).localeCompare(b.composition?.base ?? b.name)
    || a.name.localeCompare(b.name));
}
