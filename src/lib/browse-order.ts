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
  const prefix = (icon.composition?.base ?? icon.name).split('-')[0];
  return icon.category === 'Essentials' && prefix === 'zoom' ? 'search' : prefix;
}

export function orderBrowseIcons(icons: IconEntry[]): IconEntry[] {
  return [...icons].sort((a, b) => compareBrowseCategories(a.category, b.category)
    || family(a).localeCompare(family(b))
    || a.name.localeCompare(b.name));
}
