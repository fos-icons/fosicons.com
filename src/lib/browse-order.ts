import type { IconEntry } from './catalog-meta';

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

// The generator and the browser must agree on chunk membership in every locale.
const compare = new Intl.Collator('en').compare;

export function compareBrowseCategories(a: string, b: string): number {
  return categoryRank(a) - categoryRank(b) || compare(a, b);
}

function family(icon: IconEntry): string {
  const name = icon.composition?.base ?? icon.name;
  if (icon.category === 'Interfaces' && /^(filter-lines(?:-|$)|filter-(circle|square)$)/.test(name)) return 'filter-lines';
  const prefix = name.split('-')[0];
  return icon.category === 'Essentials' && prefix === 'zoom' ? 'search' : prefix;
}

export function orderBrowseIcons(icons: IconEntry[]): IconEntry[] {
  return [...icons].sort((a, b) => compareBrowseCategories(a.category, b.category)
    || compare(family(a), family(b))
    || Number(b.name === family(b)) - Number(a.name === family(a))
    || compare(a.composition?.base ?? a.name, b.composition?.base ?? b.name)
    || compare(a.name, b.name));
}
