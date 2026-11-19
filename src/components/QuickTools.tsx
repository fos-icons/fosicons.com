import { createContext, useContext, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconButton, type UiIconName } from './ui';

export const RailContext = createContext<{ host: HTMLElement; expand: () => void } | null>(null);

export function RailActions({ children }: { children: (expand: () => void) => ReactNode }) {
  const rail = useContext(RailContext);
  return rail ? createPortal(children(rail.expand), rail.host) : null;
}

export function QuickPopover({ label, icon, children }: { label: string; icon: UiIconName; children: ReactNode }) {
  const id = useId();
  return (
    <>
      <IconButton label={label} icon={icon} popoverTarget={id} />
      <div
        id={id}
        popover="auto"
        aria-label={label}
        role="group"
        className="fixed inset-auto right-16 top-16 m-0 max-h-[calc(100dvh-5rem)] w-80 max-w-[calc(100vw-5rem)] overflow-y-auto rounded-xl border border-line bg-surface text-ink shadow-lg"
      >
        {children}
      </div>
    </>
  );
}
