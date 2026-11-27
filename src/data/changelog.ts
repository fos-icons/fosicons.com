import { describeIconChangelog, type IconChangelogEntry } from '../lib/icon-changelog';
import { LIBRARY_URL } from '../lib/links';
import generated from './changelog-icons.json';

/** Keep a Changelog change types. Each highlight is one kind, shown with its marker. */
export type ChangeKind = 'added' | 'changed' | 'removed' | 'fixed';

export interface ChangelogHighlight {
  kind: ChangeKind;
  text: string;
}

interface ChangelogEntry {
  id: string;
  date: string;
  startDate?: string;
  legacyIds?: readonly string[];
  title: string;
  summary: string;
  /** Added first, then changed, removed, and fixed. */
  highlights?: readonly ChangelogHighlight[];
  icons?: readonly string[];
  source: string;
}

// Add new entries at the top. IDs are permanent links to individual updates.
// Icon additions and removals are recorded automatically by `pnpm run sync`
// (changelog-icons.json) and merged in by date below.
const written: readonly ChangelogEntry[] = [
  {
    id: 'november-20-27-2026',
    startDate: '2026-11-20',
    date: '2026-11-27',
    legacyIds: [
      'character-search-and-redraws',
      'new-animations-and-previews',
      'fos-icons-for-ai-agents',
      'five-optical-sizes',
      'construction-and-legal-icons',
      'new-drawings-and-redraws',
    ],
    title: 'New icons, redraws, and five optical sizes',
    summary: 'The library now includes 16, 24, 32, 48, and 64px drawings. Each size has its own stroke width and grid so icons stay clear at small sizes and balanced at large ones.',
    highlights: [
      { kind: 'added', text: 'Added 34 icons for formatting, hand gestures, lighting, scanning, and more.' },
      { kind: 'added', text: 'Added construction and legal icons, including hard hats, cranes, handcuffs, and police badges.' },
      { kind: 'added', text: 'Added home-signal and text-square.' },
      { kind: 'added', text: 'Added file-add, microphone-off, and settings-sliders to the animated set.' },
      { kind: 'changed', text: 'Refreshed 42 drawings, including wand-sparkles, copy, and folder-open, and the Nature & animals set.' },
      { kind: 'changed', text: 'Redrew hammer, shovel, plane, and phone-missed, and refined the letterforms in the Filled Bold and Bold Square icons.' },
      { kind: 'changed', text: 'Regenerated the React, Vue, Svelte, Angular, and Flutter packages with updated artwork.' },
    ],
    icons: [
      'hammer', 'shovel', 'plane', 'phone-missed', 'home-signal', 'wand-sparkles', 'hard-hat', 'handcuffs',
      'crane', 'excavator', 'traffic-cone', 'police-badge', 'gavel', 'scales', 'hand-wave', 'hand-pinch',
      'lightbulb-filament', 'lightbulb-sparkle', 'scan-barcode', 'text-square', 'text-color', 'folder-open', 'microphone-off', 'settings-sliders',
    ],
    source: `${LIBRARY_URL}/compare/37c716c334616c1975e7d2cb11309dfcdc3e54b6...bbc932551308aa90d58c17379ef867fa90b51d58`,
  },
];

const sourceUrl = (from: string | null, to: string | null) => (from && to && from !== to
  ? `${LIBRARY_URL}/compare/${from}...${to}`
  : to ? `${LIBRARY_URL}/commit/${to}` : LIBRARY_URL);

const fromSync: readonly ChangelogEntry[] = (generated as IconChangelogEntry[]).map((entry) => ({
  id: entry.id,
  date: entry.date,
  ...describeIconChangelog(entry),
  source: sourceUrl(entry.from, entry.to),
}));

/** Every update, newest first. */
export const changelog: readonly ChangelogEntry[] = [...fromSync, ...written]
  .sort((a, b) => b.date.localeCompare(a.date));
