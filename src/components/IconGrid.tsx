import { useI18n } from '../i18n';
import { Fragment, memo, useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { IconCardTooltip, iconCardClass, iconCardGlyphClass } from './IconCard';
import { UiIcon } from './ui';

export interface GridItem {
  name: string;
  category?: string;
}

interface Props {
  items: GridItem[];
  /** Animated view: cells that play without hover, so the tab shows it moves. */
  playing?: ReadonlySet<string>;
  svgs: Record<string, string> | null;
  /** Every selected icon (one for the inspector, several for a set). */
  selected: ReadonlySet<string>;
  /** `additive`: Shift/⌘/Ctrl was held, so toggle this icon in the set. */
  onSelect: (name: string, additive: boolean) => void;
  label: string;
  premiumLabel?: string;
  columns?: number;
  showNames?: boolean;
  /** Called with icons near the viewport, so their artwork can load lazily. */
  onNeed?: (names: string[]) => void;
  categoryTitle?: (category: string) => string;
}

/** Cells rendered into the static HTML: enough for a first screen, without shipping the whole grid. */
const PRERENDER_CELLS = 96;
/**
 * Cells mounted on the first client render; the rest mount in batches while
 * the browser is idle. Mounting all 1,458 at once blocks a phone's main
 * thread for most of a second.
 */
const progressive = { first: 96, batch: 96 };
/** Tests that need every cell at once turn progressive mounting off. */
export function setProgressiveGrid(enabled: boolean) {
  progressive.first = enabled ? 96 : Infinity;
}
/** Mount the next batch when the end of the mounted cells is this close. */
const GROW_MARGIN = '1200px 0px';
/** Load artwork this far ahead of the viewport. */
const NEED_MARGIN = '900px 0px';

const Cell = memo(function Cell({
  name, svg, selected, tabbable, onSelect, onFocusIndex, index, premiumLabel, playing = false, stagger, showNames,
}: {
  name: string;
  svg: string | undefined;
  selected: boolean;
  tabbable: boolean;
  onSelect: (name: string, additive: boolean) => void;
  onFocusIndex: (index: number) => void;
  index: number;
  premiumLabel?: string;
  playing?: boolean;
  stagger: boolean;
  showNames: boolean;
}) {
  return (
    <li className="icon-cell" data-name={name} data-playing={playing || undefined} data-stagger={stagger || undefined}
      style={stagger ? { '--stagger-index': index } as CSSProperties : undefined}>
      <button
        type="button"
        data-icon={name}
        data-index={index}
        tabIndex={tabbable ? 0 : -1}
        aria-label={name}
        aria-description={premiumLabel}
        aria-pressed={selected}
        onClick={(e) => onSelect(name, e.shiftKey || e.metaKey || e.ctrlKey)}
        // Shift-click would otherwise extend a text selection across the grid.
        onMouseDown={(e) => { if (e.shiftKey) e.preventDefault(); }}
        onKeyDown={(e) => {
          if (e.shiftKey && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onSelect(name, true);
          }
        }}
        onFocus={() => onFocusIndex(index)}
        className={iconCardClass(selected)}
      >
        {premiumLabel && (
          <span aria-hidden="true" data-tooltip={premiumLabel} className="absolute start-1 top-1 flex size-3.5 items-center justify-center rounded-full bg-sunken text-muted">
            <UiIcon name="crown-simple" className="size-3 [&_path]:[stroke-width:1.75]" />
          </span>
        )}
        {svg ? (
          <span
            aria-hidden="true"
            data-artwork className={`glyph text-[color:var(--glyph-color)] ${iconCardGlyphClass}`}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <span aria-hidden="true" className={`rounded-md bg-sunken ${iconCardGlyphClass}`} />
        )}
        {showNames && (
          <span aria-hidden="true" title={name} className="icon-card-name w-full wrap-anywhere text-center text-xs leading-4 text-muted">
            {name}
          </span>
        )}
      </button>
      {/* Beside the button, not in it: the button skips rendering off screen
          (content-visibility), which would clip a tooltip inside it. */}
      {!showNames && <IconCardTooltip name={name} />}
    </li>
  );
});

/**
 * Dense, keyboard-navigable icon grid. The grid is one tab stop; arrow keys,
 * Home/End, and PageUp/PageDown move between icons; Enter/Space opens one.
 */
export function IconGrid({ items: allItems, svgs, selected, onSelect, label, premiumLabel, onNeed, categoryTitle, playing, columns: preferredColumns, showNames = false }: Props) {
  const items = allItems;
  const listRef = useRef<HTMLUListElement>(null);

  // Stagger a few results after a filter change, not the initial grid or scroll batches.
  const [entrance, setEntrance] = useState({ items, stagger: false });
  if (entrance.items !== items) setEntrance({ items, stagger: true });

  // Progressive mounting: a screenful first, then another batch whenever the
  // end of the mounted cells comes near the viewport, so loading never pays
  // for cells nobody has scrolled to. A new result list starts over; keyboard
  // moves past the end mount everything. Without IntersectionObserver, all.
  const canObserve = typeof IntersectionObserver !== 'undefined';
  const [grown, setGrown] = useState({ items, limit: progressive.first });
  const limit = typeof window === 'undefined' ? PRERENDER_CELLS
    : !canObserve ? items.length
      : grown.items === items ? grown.limit : progressive.first;
  const shown = limit >= items.length ? items : items.slice(0, limit);
  const sentinelRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || limit >= items.length) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setGrown({ items, limit: limit + progressive.batch });
    }, { rootMargin: GROW_MARGIN });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [items, limit]);
  const mountAll = () => { if (limit < items.length) setGrown({ items, limit: items.length }); };

  // Ask for artwork as cells approach the viewport; batch each frame's worth.
  // One observer per result list; newly mounted cells are added to it.
  const needObserver = useRef<{ observer: IntersectionObserver; observed: number } | null>(null);
  useEffect(() => {
    if (!onNeed || !canObserve) return;
    let pending: string[] = [];
    let frame = 0;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const name = (entry.target as HTMLElement).dataset.name;
        if (name) pending.push(name);
        observer.unobserve(entry.target);
      }
      if (pending.length && !frame) {
        frame = requestAnimationFrame(() => { frame = 0; const names = pending; pending = []; onNeed(names); });
      }
    }, { rootMargin: NEED_MARGIN });
    needObserver.current = { observer, observed: 0 };
    return () => { observer.disconnect(); cancelAnimationFrame(frame); needObserver.current = null; };
  }, [items, onNeed, canObserve]);
  useEffect(() => {
    const list = listRef.current;
    const watch = needObserver.current;
    if (!list || !watch) return;
    const cells = list.querySelectorAll<HTMLElement>(':scope > .icon-cell');
    for (let i = watch.observed; i < cells.length; i += 1) watch.observer.observe(cells[i]);
    watch.observed = cells.length;
  }, [items, onNeed, shown.length]);

  const selectedIndex = selected.size ? items.findIndex((i) => selected.has(i.name)) : -1;
  const [active, setActive] = useState(0);
  const activeIndex = selectedIndex >= 0 && active >= items.length ? selectedIndex : Math.min(active, Math.max(items.length - 1, 0));

  // Follow the selection (e.g. from a shared URL), but never pull the roving
  // focus away from the cell someone is working from inside the grid.
  useEffect(() => {
    if (selectedIndex >= 0 && !listRef.current?.contains(document.activeElement)) setActive(selectedIndex);
  }, [selectedIndex]);

  // The selected cell and the grid's tab stop must exist even before the grid finishes growing.
  useEffect(() => {
    if (Math.max(selectedIndex, activeIndex) >= limit) setGrown({ items, limit: items.length });
  }, [selectedIndex, activeIndex, limit, items]);

  const columns = () => {
    const list = listRef.current;
    if (!list) return 1;
    // Read the track count so a short category row never changes keyboard stepping.
    const tracks = getComputedStyle(list).gridTemplateColumns.trim().split(/\s+/);
    if (tracks.every((track) => /^\d+(?:\.\d+)?px$/.test(track))) return tracks.length;
    const cells = Array.from(list.querySelectorAll<HTMLElement>(':scope > .icon-cell'));
    return Math.max(1, cells.filter((cell) => cell.offsetTop === cells[0]?.offsetTop).length);
  };

  const focusIndex = (index: number) => {
    const clamped = Math.max(0, Math.min(items.length - 1, index));
    setActive(clamped);
    const focus = () => {
      const button = listRef.current?.querySelector<HTMLButtonElement>(`button[data-index="${clamped}"]`);
      button?.focus();
      button?.scrollIntoView({ block: 'nearest' });
    };
    // Past the mounted cells (End, PageDown): mount the rest, then focus.
    if (clamped >= shown.length) { mountAll(); requestAnimationFrame(focus); } else focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const cols = columns();
    // Category headers start a new row, including when the preceding row is short.
    const rows: { start: number; end: number }[] = [];
    for (let i = 0; i < items.length; i += 1) {
      const row = rows.at(-1);
      if (!row || i - row.start === cols || (categoryTitle && items[i].category !== items[i - 1]?.category)) {
        rows.push({ start: i, end: i });
      } else {
        row.end = i;
      }
    }
    const rowIndex = rows.findIndex((row) => row.end >= activeIndex);
    const row = rows[rowIndex];
    if (!row) return;
    const moveRows = (offset: number) => {
      const next = rows[Math.max(0, Math.min(rows.length - 1, rowIndex + offset))];
      return Math.min(next.end, next.start + activeIndex - row.start);
    };
    const map: Record<string, number> = {
      ArrowRight: activeIndex + 1,
      ArrowLeft: activeIndex - 1,
      ArrowDown: moveRows(1),
      ArrowUp: moveRows(-1),
      Home: event.ctrlKey ? 0 : row.start,
      End: event.ctrlKey ? items.length - 1 : row.end,
      PageDown: moveRows(4),
      PageUp: moveRows(-4),
    };
    if (event.key in map) {
      event.preventDefault();
      focusIndex(map[event.key]);
    }
  };

  const onFocusIndex = useCallback((index: number) => setActive(index), []);

  return (
    <ul
      ref={listRef}
      aria-label={label}
      aria-describedby="grid-help"
      onKeyDown={onKeyDown}
      className="icon-card-grid"
      data-columns={preferredColumns}
      data-show-names={showNames || undefined}
      style={preferredColumns === undefined ? undefined : { '--preferred-columns': preferredColumns } as CSSProperties}
    >
      {shown.map((item, index) => (
        <Fragment key={item.name}>
          {categoryTitle && item.category && item.category !== shown[index - 1]?.category && (
            <li className="col-span-full px-1 pb-2 pt-5 first:pt-0">
              <h2 className="text-base font-semibold text-ink">{categoryTitle(item.category)}</h2>
            </li>
          )}
          <Cell
            name={item.name}
            index={index}
            svg={svgs?.[item.name]}
            selected={selected.has(item.name)}
            playing={playing?.has(item.name)}
            stagger={entrance.stagger && index < 24}
            tabbable={index === activeIndex}
            onSelect={onSelect}
            onFocusIndex={onFocusIndex}
            premiumLabel={premiumLabel}
            showNames={showNames}
          />
        </Fragment>
      ))}
      {shown.length < items.length && <li ref={sentinelRef} aria-hidden="true" className="col-span-full h-px" />}
    </ul>
  );
}

export function GridHelp() {
  const { t } = useI18n();
  return (
    <p id="grid-help" className="sr-only">
      {t('icons.gridHelp')}
    </p>
  );
}
