import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';

/** An anchored disclosure that closes when focus or a pointer leaves it. */
export function useDisclosure() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);

  return {
    open, trigger, close,
    toggle: () => setOpen((current) => !current),
    container: {
      ref: root,
      onBlur: (event: FocusEvent<HTMLDivElement>) => {
        if (event.relatedTarget && !root.current?.contains(event.relatedTarget)) close();
      },
      onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
        if (!open || event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        close();
        trigger.current?.focus();
      },
    },
  };
}
