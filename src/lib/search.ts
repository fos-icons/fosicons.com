import { catalog, type IconEntry } from './catalog';

const normalize = (value: string) => value.toLowerCase().replace(/[_/]+/g, ' ').replace(/\s+/g, ' ').trim();

// These matches describe characters drawn in the icon, rather than words
// that happen to be in its name or metadata.
const characterQueries = new Map<string, RegExp>([
  ['letter', /^(?:bold(?:-square)?|italic(?:-square)?|underline(?:-square)?|(?:type-)?strikethrough(?:-square)?|type(?:-square)?|text-color|letter-spacing|font-size|info(?:-circle|-hexagon|-octagon|-square)?|annotation-info|copyright|registered|trademark|subscript|superscript|sort-(?:a-z|z-a)-(?:up|down)|image-4k(?:-sparkles)?|network-[3-6]g)$/],
  ['number', /^(?:number-\d+|sort-(?:0-9|9-0)-(?:up|down)|subscript|superscript|annotation-(?:7|24)|calendar-month-[0-9]+|clock-(?:12|24)|image-4k(?:-sparkles)?|laurel-wreath-1|medal-[1-3]|network-[3-6]g)$/],
  ['?', /(?:^|-)question(?:-|$)/],
  ['!', /^(?:annotation-alert|calendar-alert|shield-alert|alert-(?:circle|hexagon|octagon|square|triangle)|message-alert-(?:circle|square))$/],
  ['@', /^at-sign$/],
  ['$', /(?:^|-)dollar(?:-|$)/],
  ['#', /(?:^|-)hash(?:-|$)/],
  ['%', /^percent(?:-circle)?$/],
  ['*', /^asterisk$/],
]);
const fileBadgeLabels = new Map(
  Object.entries(catalog.modifiers)
    .filter(([, modifier]) => modifier.group === 'file-types')
    .map(([name, modifier]) => [name, modifier.label]),
);

interface Indexed {
  icon: IconEntry;
  name: string;
  nameWords: string;
  aliases: string[];
  tags: string[];
  category: string;
}

export function createIndex(icons: IconEntry[]): Indexed[] {
  return icons.map((icon) => ({
    icon,
    name: icon.name,
    nameWords: icon.name.replace(/-/g, ' '),
    aliases: icon.aliases.map(normalize),
    tags: icon.tags.map(normalize),
    category: normalize(icon.category),
  }));
}

function scoreTerm(entry: Indexed, term: string): number {
  if (entry.name === term) return 100;
  if (entry.name.startsWith(term)) return 60;
  if (entry.nameWords.split(' ').includes(term)) return 50;
  if (entry.name.includes(term) || entry.nameWords.includes(term)) return 40;
  if (entry.aliases.some((a) => a === term || a.split(' ').includes(term))) return 30;
  if (entry.tags.some((t) => t === term)) return 25;
  if (entry.aliases.some((a) => a.includes(term))) return 20;
  if (entry.tags.some((t) => t.includes(term))) return 15;
  if (entry.category.includes(term)) return 10;
  return 0;
}

/**
 * Search canonical names, aliases, tags, and categories. Every term must
 * match somewhere; results are ranked by the strength of their matches,
 * then alphabetically.
 */
export function search(index: Indexed[], query: string, category?: string | null): IconEntry[] {
  const q = normalize(query);
  const pool = category ? index.filter((e) => e.icon.category === category) : index;
  if (!q) return pool.map((e) => e.icon);
  const character = characterQueries.get(q);
  if (character) {
    const badgeText = q === 'letter' ? /[a-z]/i : q === 'number' ? /[0-9]/ : null;
    return pool.filter(({ icon, name }) => character.test(name) || (
      badgeText && icon.composition?.modifiers.some((badge) => badgeText.test(fileBadgeLabels.get(badge.name) ?? ''))
    )).map(({ icon }) => icon);
  }
  const whole = q.replace(/ /g, '-');
  const terms = q.split(' ');
  const scored: { icon: IconEntry; score: number }[] = [];
  for (const entry of pool) {
    let score = entry.name === whole ? 200 : 0;
    let matchedAll = true;
    for (const term of terms) {
      const s = scoreTerm(entry, term);
      if (!s) { matchedAll = false; break; }
      score += s;
    }
    if (matchedAll) scored.push({ icon: entry.icon, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.icon.name.localeCompare(b.icon.name))
    .map((s) => s.icon);
}

/** Edit distance, stopping early once it exceeds `max`. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, row[j]);
    }
    if (best > max) return max + 1;
    prev = row;
  }
  return prev[b.length];
}

/**
 * Close matches for a search with no results: icons matching some of the
 * words, or a word spelled a little differently (typos). Best first.
 */
export function suggest(index: Indexed[], query: string, limit = 8): IconEntry[] {
  const terms = normalize(query).split(' ').filter(Boolean);
  if (!terms.length) return [];
  const scored: { icon: IconEntry; score: number }[] = [];
  for (const entry of index) {
    const words = entry.nameWords.split(' ');
    let score = 0;
    for (const term of terms) {
      const exact = scoreTerm(entry, term);
      if (exact) { score += exact; continue; }
      if (term.length < 3) continue;
      const max = term.length >= 8 ? 2 : 1;
      const d = Math.min(...words.map((w) => distance(term, w, max)));
      if (d <= max) score += 30 - d * 8;
    }
    if (score > 0) scored.push({ icon: entry.icon, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.icon.name.length - b.icon.name.length || a.icon.name.localeCompare(b.icon.name))
    .slice(0, limit)
    .map((s) => s.icon);
}
