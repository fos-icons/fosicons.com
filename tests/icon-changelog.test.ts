import { describe, expect, it } from 'vitest';
import { describeIconChangelog, iconChangelogEntry, mergeIconChangelog } from '../src/lib/icon-changelog';

const icon = (name: string, category = 'Essentials') => ({ name, category });
const revisions = { date: '2026-12-01', from: 'aaa', to: 'bbb' };

describe('icon changelog from sync', () => {
  it('records added, removed, and newly animated icons', () => {
    const entry = iconChangelogEntry(
      { icons: [icon('home'), icon('bell'), icon('old')], animated: ['home'] },
      { icons: [icon('home'), icon('bell'), icon('crane', 'Construction'), icon('gavel', 'Legal')], animated: ['home', 'bell'] },
      { ...revisions, redrawn: ['bell', 'crane', 'old'] },
    );
    expect(entry).toEqual({
      id: 'icons-2026-12-01',
      date: '2026-12-01',
      added: ['crane', 'gavel'],
      removed: ['old'],
      animated: ['bell'],
      // Only icons that existed before and still exist count as redrawn.
      redrawn: ['bell'],
      categories: ['Construction', 'Legal'],
      from: 'aaa',
      to: 'bbb',
    });
  });

  it('writes nothing when the icon set is unchanged', () => {
    const catalog = { icons: [icon('home')], animated: [] };
    expect(iconChangelogEntry(catalog, catalog, revisions)).toBeNull();
  });

  it('folds a second sync on the same day into that day’s entry', () => {
    const morning = iconChangelogEntry({ icons: [icon('home')] }, { icons: [icon('home'), icon('crane'), icon('typo')] }, revisions)!;
    const afternoon = iconChangelogEntry(
      { icons: [icon('home'), icon('crane'), icon('typo')] },
      { icons: [icon('home'), icon('crane'), icon('gavel')] },
      { ...revisions, from: 'bbb', to: 'ccc' },
    )!;
    const older = { ...morning, id: 'icons-2026-11-30', date: '2026-11-30' };
    const [today, yesterday] = mergeIconChangelog(mergeIconChangelog([older], morning), afternoon);
    // An icon added and removed the same day never shipped, so it's in neither list.
    expect(today).toMatchObject({ added: ['crane', 'gavel'], removed: [], from: 'aaa', to: 'ccc' });
    expect(yesterday).toBe(older);
  });

  it('describes an entry for the changelog page', () => {
    const many = Array.from({ length: 10 }, (_, i) => `icon-${i}`);
    const page = describeIconChangelog({
      id: 'icons-2026-12-01', date: '2026-12-01', added: many, removed: ['old'], animated: ['bell'], redrawn: ['hammer'],
      categories: ['Construction', 'Legal'], from: 'aaa', to: 'bbb',
    });
    expect(page.title).toBe('10 new icons and 1 redrawn');
    expect(page.summary).toBe('Added 10 icons in Construction and Legal. Redrew 1 icon.');
    expect(page.highlights).toEqual([
      { kind: 'added', text: 'Added icon-0, icon-1, icon-2, icon-3, icon-4, icon-5, icon-6, icon-7, and 2 more.' },
      { kind: 'added', text: 'Added animated bell.' },
      { kind: 'changed', text: 'Redrew hammer.' },
      { kind: 'removed', text: 'Removed old.' },
    ]);
    expect(page.icons).toEqual([...many, 'bell', 'hammer']);
  });
});
