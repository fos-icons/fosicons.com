import type { ReactNode } from 'react';

export const iconGridClass = 'grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-1 sm:grid-cols-[repeat(auto-fill,minmax(max(96px,calc((100%-28px)/8)),1fr))]';
export const iconCardGlyphClass = 'size-[min(var(--glyph-size,48px),40px)] shrink-0 sm:size-[var(--glyph-size,48px)]';

export function iconCardClass(selected = false) {
  const state = selected ? 'bg-brand-soft ring-1 ring-inset ring-brand' : 'hover:bg-sunken';
  return `group relative flex aspect-square min-h-[min(var(--cell-min-h,96px),88px)] w-full items-center justify-center rounded-xl pb-9 text-ink transition-colors focus-visible:outline-offset-[-2px] sm:min-h-[var(--cell-min-h,96px)] ${state}`;
}

export function IconCardContent({ name, selected, children }: { name: string; selected?: boolean; children: ReactNode }) {
  return (
    <>
      {children}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-1 bottom-2.5 line-clamp-2 text-center text-[11px] leading-[14px] text-muted [overflow-wrap:anywhere] transition-opacity ${
          selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
        }`}
      >
        {name}
      </span>
    </>
  );
}
