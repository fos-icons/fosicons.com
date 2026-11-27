import type { ChangelogHighlight } from '../data/changelog';

/**
 * Changelog entries that `pnpm run sync` writes to src/data/changelog-icons.json
 * whenever the icon set changes. The page turns each into a changelog entry
 * with `describeIconChangelog`.
 */
export interface IconChangelogEntry {
  /** `icons-YYYY-MM-DD`: one entry per day, permanent as a link target. */
  id: string;
  /** UTC date of the sync. */
  date: string;
  added: string[];
  removed: string[];
  /** Existing icons that gained an animated version. */
  animated: string[];
  /** Existing icons whose artwork changed in any style. */
  redrawn: string[];
  /** Categories of the added icons. */
  categories: string[];
  /** Library revisions the day's syncs went from and to. */
  from: string | null;
  to: string | null;
}

interface CatalogSnapshot {
  icons: readonly { name: string; category: string }[];
  animated?: readonly string[];
}

/** Names listed in a highlight before "and N more". */
const LISTED_NAMES = 8;
/** Icons shown in an entry's featured grid. */
const FEATURED_ICONS = 24;

const sorted = (names: Iterable<string>) => [...new Set(names)].sort();
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
const listNames = (names: readonly string[]) => {
  const shown = names.slice(0, LISTED_NAMES);
  const rest = names.length - shown.length;
  if (rest > 0) return `${shown.join(', ')}, and ${rest} more`;
  return shown.length < 3 ? shown.join(' and ') : `${shown.slice(0, -1).join(', ')}, and ${shown.at(-1)}`;
};

/**
 * What a sync changed in the icon set: icons added and removed, existing icons
 * that gained an animated version, and `redrawn` (existing icons whose artwork
 * changed, found by the sync). `null` when nothing changed.
 */
export function iconChangelogEntry(
  previous: CatalogSnapshot,
  next: CatalogSnapshot,
  { date, from, to, redrawn = [] }: { date: string; from: string | null; to: string | null; redrawn?: readonly string[] },
): IconChangelogEntry | null {
  const before = new Set(previous.icons.map((icon) => icon.name));
  const after = new Map(next.icons.map((icon) => [icon.name, icon]));
  const added = sorted([...after.keys()].filter((name) => !before.has(name)));
  const removed = sorted([...before].filter((name) => !after.has(name)));
  const wasAnimated = new Set(previous.animated ?? []);
  const animated = sorted((next.animated ?? []).filter((name) => before.has(name) && !wasAnimated.has(name)));
  const changed = sorted(redrawn.filter((name) => before.has(name) && after.has(name)));
  if (!added.length && !removed.length && !animated.length && !changed.length) return null;
  return {
    id: `icons-${date}`,
    date,
    added,
    removed,
    animated,
    redrawn: changed,
    categories: sorted(added.map((name) => after.get(name)!.category)),
    from,
    to,
  };
}

/**
 * Adds a sync's entry to the generated list, newest first. A second sync on
 * the same day folds into that day's entry (keeping its first revision); an
 * icon added and removed again that day drops out of both lists.
 */
export function mergeIconChangelog(entries: readonly IconChangelogEntry[], entry: IconChangelogEntry): IconChangelogEntry[] {
  const same = entries.find((e) => e.id === entry.id);
  if (!same) return [entry, ...entries];
  const merged: IconChangelogEntry = {
    ...same,
    added: sorted([...same.added, ...entry.added]).filter((name) => !entry.removed.includes(name)),
    removed: sorted([...same.removed, ...entry.removed.filter((name) => !same.added.includes(name))])
      .filter((name) => !entry.added.includes(name)),
    animated: sorted([...same.animated, ...entry.animated]),
    // Icons new today aren't "redrawn" even if a later sync changes them again.
    redrawn: sorted([...(same.redrawn ?? []), ...entry.redrawn]).filter((name) => !same.added.includes(name) && !entry.removed.includes(name)),
    categories: sorted([...same.categories, ...entry.categories]),
    to: entry.to,
  };
  return entries.map((e) => (e === same ? merged : e));
}

/** Title, summary, highlights, and featured icons for a generated entry. */
export function describeIconChangelog({ added, removed, animated, redrawn = [], categories }: IconChangelogEntry): {
  title: string;
  summary: string;
  highlights: ChangelogHighlight[];
  icons: string[];
} {
  const title = added.length ? `${plural(added.length, 'new icon')}${redrawn.length ? ` and ${redrawn.length} redrawn` : ''}`
    : animated.length ? plural(animated.length, 'new animated icon')
    : redrawn.length ? plural(redrawn.length, 'redrawn icon')
    : `${plural(removed.length, 'icon')} removed`;
  const summary = [
    added.length ? `Added ${plural(added.length, 'icon')}${categories.length ? ` in ${listNames(categories)}` : ''}.` : '',
    !added.length && animated.length ? `Added animated versions of ${plural(animated.length, 'icon')}.` : '',
    redrawn.length ? `Redrew ${plural(redrawn.length, 'icon')}.` : '',
    !added.length && !animated.length && !redrawn.length ? `Removed ${plural(removed.length, 'icon')}.` : '',
  ].filter(Boolean).join(' ');
  const highlights: ChangelogHighlight[] = [
    ...(added.length ? [{ kind: 'added' as const, text: `Added ${listNames(added)}.` }] : []),
    ...(animated.length ? [{ kind: 'added' as const, text: `Added animated ${listNames(animated)}.` }] : []),
    ...(redrawn.length ? [{ kind: 'changed' as const, text: `Redrew ${listNames(redrawn)}.` }] : []),
    ...(removed.length ? [{ kind: 'removed' as const, text: `Removed ${listNames(removed)}.` }] : []),
  ];
  return { title, summary, highlights, icons: [...added, ...animated, ...redrawn].slice(0, FEATURED_ICONS) };
}
