import { useEffect } from 'react';

const arrowControls = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="combobox"], [role="slider"], [role="spinbutton"], [role="textbox"]';

export function useHistoryShortcuts() {
  useEffect(() => {
    // Leave Alt+Arrow to the browser on Windows; Option+Arrow is the Mac equivalent on this site.
    if (!navigator.platform.startsWith('Mac')) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.repeat) return;
      if (!event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(arrowControls) || document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')) return;

      event.preventDefault();
      window.history.go(event.key === 'ArrowLeft' ? -1 : 1);
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
