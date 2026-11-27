import type { ReactNode } from 'react';

export const iconCardGlyphClass = 'size-[var(--icon-card-glyph-size,32px)] shrink-0';

export function iconCardClass(selected = false) {
  const state = selected ? 'bg-brand-soft' : 'hover:bg-sunken';
  return `icon-card relative flex aspect-square w-full items-center justify-center rounded-xl text-ink focus-visible:outline-offset-[-2px] ${state}`;
}

/** The icon's name, shown under a card on hover or keyboard focus (see .icon-card-tooltip). */
export function IconCardTooltip({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="icon-card-tooltip pointer-events-none absolute start-1/2 top-full mt-1 w-max max-w-[calc(100%+2rem)] -translate-x-1/2 site-tooltip rounded-md px-2 py-1 text-center text-xs leading-4 [overflow-wrap:anywhere]"
    >
      {name}
    </span>
  );
}

export function IconCardContent({ name, children }: { name: string; children: ReactNode }) {
  return (
    <>
      {children}
      <IconCardTooltip name={name} />
    </>
  );
}
