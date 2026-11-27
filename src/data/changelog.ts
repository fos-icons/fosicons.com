import { LIBRARY_URL } from '../lib/links';

interface ChangelogEntry {
  id: string;
  date: string;
  title: string;
  summary: string;
  highlights?: readonly string[];
  icons?: readonly string[];
  source: string;
}

const WEBSITE_URL = 'https://github.com/fos-icons/fosicons.com';

// Add new entries at the top. IDs are permanent links to individual updates.
export const changelog: readonly ChangelogEntry[] = [
  {
    id: 'character-search-and-redraws',
    date: '2026-11-27',
    title: 'Character search and four redrawn icons',
    summary: 'Find icons by the characters they draw. Search for “letter” or “number”, or enter a symbol like ?, @, or # to find icons that contain it.',
    highlights: [
      'Redrew hammer, shovel, plane, and phone-missed.',
      'Refined the letterforms in the Filled Bold and Bold Square icons.',
    ],
    icons: ['hammer', 'shovel', 'plane', 'phone-missed'],
    source: `${WEBSITE_URL}/pull/123`,
  },
  {
    id: 'new-animations-and-previews',
    date: '2026-11-26',
    title: 'More animations and pixel-grid previews',
    summary: 'The animated set gained new entries, including file-add, microphone-off, and settings-sliders. Icon pages now show artwork at its individual optical sizes, with a pixel-grid preview for closer inspection.',
    highlights: [
      'Added home-signal and text-square.',
      'Refreshed 24 drawings, including wand-sparkles, copy, and folder-open.',
    ],
    icons: ['home-signal', 'text-square', 'wand-sparkles', 'settings-sliders'],
    source: `${LIBRARY_URL}/pull/54`,
  },
  {
    id: 'fos-icons-for-ai-agents',
    date: '2026-11-25',
    title: 'Fos Icons for AI agents',
    summary: 'The Fos Icons MCP server lets coding agents search the catalog and get the right import. Agent Skills explain how to use Fos icons and migrate from Lucide, Heroicons, or React Icons.',
    source: `${WEBSITE_URL}/pull/86`,
  },
  {
    id: 'five-optical-sizes',
    date: '2026-11-22',
    title: 'Five optical sizes',
    summary: 'Icons now come in 16, 24, 32, 48, and 64px drawings. Each size has its own stroke width and grid so the artwork stays clear at small sizes and balanced at large ones.',
    source: `${LIBRARY_URL}/pull/29`,
  },
  {
    id: 'construction-and-legal-icons',
    date: '2026-11-21',
    title: 'Construction, legal, and nature icons',
    summary: 'Added construction and legal icons, from hard hats and cranes to handcuffs and police badges. The Nature & animals drawings were refreshed as a set.',
    icons: ['hard-hat', 'crane', 'handcuffs', 'police-badge'],
    source: `${LIBRARY_URL}/pull/26`,
  },
  {
    id: 'new-drawings-and-redraws',
    date: '2026-11-20',
    title: '34 new icons and 18 redraws',
    summary: 'Added new drawings for formatting, hand gestures, lightbulbs, scanning, and more. The batch also refreshed 18 existing icons.',
    icons: ['activity-square', 'hand-wave', 'lightbulb-ai', 'wallet-money'],
    source: `${LIBRARY_URL}/pull/22`,
  },
];
