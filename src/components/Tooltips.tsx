import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router';

const triggerOf = (target: EventTarget | null) =>
  target instanceof Element ? target.closest<HTMLElement>('[data-tooltip]') : null;

export function Tooltips() {
  const { key } = useLocation();
  const id = useId();
  const bubble = useRef<HTMLSpanElement>(null);
  const [trigger, setTrigger] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    let hovered: HTMLElement | null = null;
    let focused: HTMLElement | null = null;
    const dismiss = () => {
      window.clearTimeout(timer);
      setTrigger(null);
    };
    const show = (element: HTMLElement | null, delay: number) => {
      dismiss();
      if (element?.dataset.tooltip) {
        timer = window.setTimeout(() => {
          if (element.isConnected) setTrigger(element);
        }, delay);
      }
    };
    const enter = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      const next = triggerOf(event.target);
      if (!next || next === hovered) return;
      hovered = next;
      show(next, 450);
    };
    const leave = (event: PointerEvent) => {
      if (triggerOf(event.target) !== hovered || !hovered || triggerOf(event.relatedTarget) === hovered) return;
      hovered = null;
      show(focused, 0);
    };
    const focus = (event: FocusEvent) => {
      focused = triggerOf(event.target);
      if (focused?.matches(':focus-visible')) show(focused, 0);
      else focused = null;
    };
    const blur = () => {
      focused = null;
      show(hovered, 450);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };

    document.addEventListener('pointerover', enter);
    document.addEventListener('pointerout', leave);
    document.addEventListener('focusin', focus);
    document.addEventListener('focusout', blur);
    document.addEventListener('keydown', escape);
    document.addEventListener('pointerdown', dismiss);
    return () => {
      dismiss();
      document.removeEventListener('pointerover', enter);
      document.removeEventListener('pointerout', leave);
      document.removeEventListener('focusin', focus);
      document.removeEventListener('focusout', blur);
      document.removeEventListener('keydown', escape);
      document.removeEventListener('pointerdown', dismiss);
    };
  }, [key]);

  useLayoutEffect(() => {
    const tip = bubble.current;
    if (!trigger || !tip) return;
    const place = () => {
      const box = trigger.getBoundingClientRect();
      const gap = 8;
      const { offsetWidth: width, offsetHeight: height } = tip;
      const x = Math.max(gap, Math.min(box.left + (box.width - width) / 2, window.innerWidth - width - gap));
      const y = box.top >= height + gap ? box.top - height - gap : box.bottom + gap;
      tip.style.visibility = !trigger.isConnected || box.bottom < 0 || box.top > window.innerHeight ? 'hidden' : '';
      tip.style.transform = `translate(${x}px, ${Math.min(y, window.innerHeight - height - gap)}px)`;
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);

    const describedBy = trigger.getAttribute('aria-describedby')?.split(/\s+/).filter(Boolean) ?? [];
    trigger.setAttribute('aria-describedby', [...describedBy, id].join(' '));
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      const remaining = trigger.getAttribute('aria-describedby')?.split(/\s+/).filter((value) => value && value !== id) ?? [];
      if (remaining.length) trigger.setAttribute('aria-describedby', remaining.join(' '));
      else trigger.removeAttribute('aria-describedby');
    };
  }, [trigger, id]);

  return trigger?.dataset.tooltip
    ? createPortal(
        <span
          id={id}
          ref={bubble}
          role="tooltip"
          className="site-tooltip pointer-events-none fixed left-0 top-0 z-[100] w-max max-w-[min(17rem,calc(100vw-1rem))] rounded-md px-2.5 py-1.5 text-xs leading-relaxed shadow-md"
        >
          {trigger.dataset.tooltip}
        </span>,
        document.body,
      )
    : null;
}
