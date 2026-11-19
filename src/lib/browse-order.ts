import type { IconEntry } from './catalog';

const figmaOrder = [
  'Essentials', 'AI & agents', 'Time & calendar', 'Interfaces', 'Navigation', 'Files',
  'Communication', 'Security', 'Media & devices', 'Data & commerce', 'Workspace', 'Shapes',
];
const categoryRanks = new Map(figmaOrder.map((name, i) => [name, i]));
// Categories in the Figma Lifestyle group remain individually filterable on the site.
const categoryRank = (name: string) => name === 'Weather' ? figmaOrder.length + 1 : categoryRanks.get(name) ?? figmaOrder.length;

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
