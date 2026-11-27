import { LIBRARY_URL } from '../lib/links';

interface ChangelogEntry {
  id: string;
  date: string;
  startDate?: string;
  legacyIds?: readonly string[];
  title: string;
  summary: string;
  highlights?: readonly string[];
  icons?: readonly string[];
  source: string;
}

// Add new entries at the top. IDs are permanent links to individual updates.
export const changelog: readonly ChangelogEntry[] = [
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
      'Added 34 icons for formatting, hand gestures, lighting, scanning, and more, and refreshed 18 existing drawings.',
      'Added construction and legal icons, including hard hats, cranes, handcuffs, and police badges. Refreshed the Nature & animals set.',
      'Added home-signal and text-square, refreshed 24 drawings including wand-sparkles, copy, and folder-open, and expanded the animated set with file-add, microphone-off, and settings-sliders.',
      'Redrew hammer, shovel, plane, and phone-missed, and refined the letterforms in the Filled Bold and Bold Square icons.',
      'Regenerated the React, Vue, Svelte, Angular, and Flutter packages with updated artwork.',
    ],
    icons: ['hammer', 'shovel', 'plane', 'phone-missed', 'home-signal', 'wand-sparkles', 'hard-hat', 'handcuffs'],
    source: `${LIBRARY_URL}/compare/37c716c334616c1975e7d2cb11309dfcdc3e54b6...bbc932551308aa90d58c17379ef867fa90b51d58`,
  },
];
