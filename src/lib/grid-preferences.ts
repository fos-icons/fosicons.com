import { useEffect, useRef, useState } from 'react';
import { useClientValue } from './hydration';
import { GRID_MAX_SIZE } from './look';
import { useMediaQuery } from './theme';

const KEY = 'fos-grid-preferences';
const GAP = 4;
const MIN_CARD = 44;

type Preferences = { columns: number | null; showNames: boolean };
function read() {
  try { return localStorage.getItem(KEY) ?? ''; } catch { return ''; }
}

function parse(stored: string): Preferences {
  const [count, names] = stored.split(':');
  const columns = Number(count);
  return {
    columns: Number.isSafeInteger(columns) && columns >= 1 ? columns : null,
    showNames: names === '1',
  };
}

export function useGridPreferences(size: number) {
  const initial = useClientValue(read, '');
  const [chosen, setChosen] = useState<Preferences | null>(null);
  const { columns, showNames } = chosen ?? parse(initial);
  const wide = useMediaQuery('(min-width: 40rem)');
  const area = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = area.current;
    if (!element) return;
    const measure = () => setWidth(element.getBoundingClientRect().width);
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const glyph = Math.min(size, wide ? GRID_MAX_SIZE : 40);
  const fit = (card: number) => Math.max(1, Math.floor((width + GAP) / (card + GAP)));
  const autoColumns = fit(Math.max(64, glyph + 32));
  const maxColumns = fit(Math.max(MIN_CARD, glyph + 8));
  // Honor the saved choice whenever the available width can fit it.
  const appliedColumns = columns === null || width === 0 ? undefined : Math.min(columns, maxColumns);
  const save = (next: Preferences) => {
    setChosen(next);
    try {
      if (next.columns === null && !next.showNames) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, `${next.columns ?? 0}:${Number(next.showNames)}`);
    } catch { /* The choice still applies for this visit. */ }
  };

  return {
    area,
    columns: appliedColumns,
    autoColumns,
    maxColumns,
    showNames,
    setColumns: (count: number | null) => save({ columns: count, showNames }),
    setShowNames: (show: boolean) => save({ columns, showNames: show }),
  };
}
