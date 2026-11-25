import { useCallback, useEffect, useRef, useState } from 'react';

/** Line below the top of the viewport that decides the current section. */
const SPY_OFFSET = 120;

/**
 * The section being read: the last one whose top has passed SPY_OFFSET, or
 * the last section once the page bottom is reached. A clicked link wins until
 * its scroll settles, so short final sections can still be selected.
 */
export function useActiveSection(ids: readonly string[], initial = ids[0] ?? '') {
  const [active, setActive] = useState(initial);
  const pinned = useRef<{ id: string; timer: number } | null>(null);
  const key = ids.join(' ');

  useEffect(() => {
    const shown = key ? key.split(' ') : [];
    let frame = 0;
    const measure = () => {
      frame = 0;
      if (pinned.current || !shown.length) return;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      let current = shown[0];
      for (const id of shown) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= SPY_OFFSET) current = id;
      }
      setActive(atBottom ? shown[shown.length - 1] : current);
    };
    const onScroll = () => {
      if (pinned.current) {
        // Release the clicked section once scrolling stops.
        window.clearTimeout(pinned.current.timer);
        pinned.current.timer = window.setTimeout(() => { pinned.current = null; }, 150);
      }
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [key]);

  useEffect(() => () => {
    if (pinned.current) window.clearTimeout(pinned.current.timer);
    pinned.current = null;
  }, []);

  const choose = useCallback((id: string) => {
    if (pinned.current) window.clearTimeout(pinned.current.timer);
    // If no scroll follows (already in place), release shortly after.
    pinned.current = { id, timer: window.setTimeout(() => { pinned.current = null; }, 600) };
    setActive(id);
  }, []);
  return [active, choose] as const;
}
