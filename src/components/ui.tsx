import { createContext, startTransition, useCallback, useContext, useLayoutEffect, useRef, useState, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type CSSProperties, type ReactNode, type SelectHTMLAttributes } from 'react';
import type { LinkProps } from 'react-router-dom';
import { LocalLink, useI18n } from '../i18n';
import uiIcons from '../data/ui-icons.json';

export type UiIconName = keyof typeof uiIcons;

/** Interface glyphs are the library's own Regular icons from the synced library. */
export function UiIcon({ name, className = 'size-5' }: { name: UiIconName; className?: string }) {
  return <span aria-hidden="true" className={`glyph inline-block shrink-0 ${className}`} dangerouslySetInnerHTML={{ __html: uiIcons[name] }} />;
}

/** Native select with the same border and arrow across the catalog and inspectors. */
export function Select({ className = '', disabled, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={`relative ${className}`}>
      <select
        className="block h-9 w-full appearance-none truncate rounded-lg border border-line-strong bg-surface ps-3 pe-8 text-sm font-medium text-ink transition-colors enabled:hover:bg-sunken disabled:cursor-not-allowed disabled:text-faint forced-colors:appearance-auto"
        disabled={disabled}
        {...props}
      >
        {children}
      </select>
      <UiIcon name="chevron-down" className={`pointer-events-none absolute end-2.5 top-1/2 size-4 -translate-y-1/2 forced-colors:hidden ${disabled ? 'text-faint' : 'text-muted'}`} />
    </div>
  );
}

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'quiet';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  /** The one main action in a region. */
  primary: 'bg-brand text-brand-ink hover:brightness-110 active:brightness-95',
  /** Other actions beside it. */
  secondary: 'border border-line-strong bg-surface text-ink hover:bg-sunken',
  /** Toolbar and inline actions. */
  ghost: 'text-ink hover:bg-sunken',
  /** Low-emphasis actions (back links, copy in a header). */
  quiet: 'text-muted hover:bg-sunken hover:text-ink',
};
const SIZES: Record<ButtonSize, { box: string; icon: string }> = {
  sm: { box: 'h-8 gap-1.5 rounded-lg px-2.5', icon: 'size-4' },
  md: { box: 'h-9 gap-2 rounded-lg px-3', icon: 'size-[18px]' },
  lg: { box: 'h-10 gap-2 rounded-xl px-4', icon: 'size-4' },
};

export interface ButtonStyle {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** A UI icon before the label. */
  icon?: UiIconName;
  /** A UI icon after the label (for example link-external). */
  iconEnd?: UiIconName;
}

/** The class list behind every button and button-styled link, for the rare element that cannot use them. */
export const buttonClass = ({ variant = 'secondary', size = 'md' }: ButtonStyle = {}) =>
  `inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${SIZES[size].box} ${VARIANTS[variant]}`;

const ButtonIcon = ({ icon, size = 'md' }: ButtonStyle) => (icon ? <UiIcon name={icon} className={SIZES[size].icon} /> : null);

/** An action. For navigation use ButtonLink (a page here) or ButtonAnchor (a file or another site). */
export function Button({
  variant, size, icon, iconEnd, className = '', children, ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & ButtonStyle) {
  return (
    <button type="button" className={`${buttonClass({ variant, size })} ${className}`} {...props}>
      <ButtonIcon icon={icon} size={size} />
      {children}
      <ButtonIcon icon={iconEnd} size={size} />
    </button>
  );
}

/** A page on this site, styled as a button. */
export function ButtonLink({
  variant, size, icon, iconEnd, className = '', children, ...props
}: Omit<LinkProps, 'to'> & { to: string } & ButtonStyle) {
  return (
    <LocalLink className={`${buttonClass({ variant, size })} ${className}`} {...props}>
      <ButtonIcon icon={icon} size={size} />
      {children}
      <ButtonIcon icon={iconEnd} size={size} />
    </LocalLink>
  );
}

/**
 * A file or another site, styled as a button. `external` opens a new tab and
 * tells screen readers so.
 */
export function ButtonAnchor({
  variant, size, icon, iconEnd, external = false, className = '', children, ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & ButtonStyle & { external?: boolean }) {
  const { t } = useI18n();
  return (
    <a
      className={`${buttonClass({ variant, size })} ${className}`}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      {...props}
    >
      <ButtonIcon icon={icon} size={size} />
      {children}
      <ButtonIcon icon={iconEnd} size={size} />
      {external && <span className="sr-only">{t('site.newTab')}</span>}
    </a>
  );
}

/**
 * A rounded link to a set of icons (a category, a search), with an optional
 * count or leading artwork.
 */
export function Chip({ to, count, children, className = '' }: { to: string; count?: string; children: ReactNode; className?: string }) {
  return (
    <LocalLink
      to={to}
      className={`inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-sm text-ink transition hover:border-brand hover:bg-brand-soft ${className}`}
    >
      {children}
      {count !== undefined && <span className="text-xs tabular-nums text-faint">{count}</span>}
    </LocalLink>
  );
}

/** A small tinted label that links to a search for its word. */
export function Tag({ to, size = 'md', children }: { to: string; size?: 'sm' | 'md'; children: ReactNode }) {
  return (
    <LocalLink
      to={to}
      className={`inline-flex items-center rounded-lg bg-tag-soft font-medium text-tag transition-colors hover:bg-tag-soft/55 ${
        size === 'sm' ? 'h-6 px-2 text-xs' : 'h-8 px-3 text-sm'
      }`}
    >
      {children}
    </LocalLink>
  );
}

export function IconButton({ label, icon, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: UiIconName }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex size-9 items-center justify-center rounded-lg text-ink transition hover:bg-sunken ${className}`}
      {...props}
    >
      <UiIcon name={icon} />
    </button>
  );
}

/** Horizontal size of the slider handle; tick positions line up with its center. */
const THUMB_W = 22;

/**
 * A slider with tick marks under its track. The track fills in the brand
 * color up to an oval, brand-colored handle. `marks` places ticks;
 * `labels` (a subset of marks) also prints their value, shown on hover or
 * keyboard focus.
 */
export function RangeSlider({
  id, label, min, max, step, value, onChange, valueText, marks, labels = marks, format,
}: {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  /** What screen readers announce for the current value. */
  valueText?: string;
  marks: readonly number[];
  labels?: readonly number[];
  format: (value: number) => string;
}) {
  const at = (v: number) => (Math.min(max, Math.max(min, v)) - min) / (max - min);
  // Center of the handle at fraction p of the track (the handle stays inside the input's box).
  const left = (p: number) => `calc(${THUMB_W / 2}px + (100% - ${THUMB_W}px) * ${p})`;
  const shown = new Set(labels);
  return (
    // Values under the ticks appear while the slider is hovered or focused.
    <div className="group">
      <label htmlFor={id} className="sr-only">{label}</label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={valueText}
        onChange={(e) => onChange(Number(e.target.value))}
        className="range w-full"
        style={{ '--fill': left(at(value)) } as CSSProperties}
      />
      {/* Pulled up so the ticks sit just under the track (the input box is taller than the track). */}
      <div className="relative -mt-1 h-[22px]" aria-hidden="true">
        {marks.map((m) => (
          <span key={m} className="absolute top-0 flex -translate-x-1/2 flex-col items-center" style={{ left: left(at(m)) }}>
            <span className={`h-1.5 w-px ${m <= value ? 'bg-brand/60' : 'bg-line-strong'}`} />
            {shown.has(m) && (
              <span className="mt-1 text-[11px] tabular-nums leading-none text-faint opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100">
                {format(m)}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

export const freeBadgeClass = 'pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-green-100 px-1.5 text-[10px] leading-4 font-semibold text-green-900 ring-2 ring-canvas dark:bg-green-950 dark:text-green-200';

/** Accessible single-choice segmented control (radio group semantics). */
export function Segmented<T extends string>({
  label, value, options, onChange, size = 'md', fill = false,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; title?: string; badge?: string }[];
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  /** Below the sm breakpoint, span the full width with equal options. */
  fill?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const groupRef = useRef<HTMLDivElement>(null);
  // Show the new selection immediately; let the (possibly heavy) parent
  // update follow as a transition so the slide starts on the next frame.
  const [pending, setPending] = useState<T | null>(null);
  const [seenValue, setSeenValue] = useState(value);
  if (seenValue !== value) {
    // The committed value changed (our transition landed, or something else
    // such as Back/Forward changed it): it wins over any pending selection.
    setSeenValue(value);
    setPending(null);
  }
  const current = pending ?? value;
  const index = options.findIndex((o) => o.value === current);
  const select = (next: T) => {
    setPending(next);
    startTransition(() => onChange(next));
  };
  const [pill, setPill] = useState<{ left: number; width: number; animate: boolean } | null>(null);

  // Measure the active option so the highlight can slide between options.
  // Re-measure on resize (fonts loading, layout changes) without animating.
  useLayoutEffect(() => {
    const measure = (animate: boolean) => {
      const el = refs.current[index];
      if (!el) { setPill(null); return; }
      setPill((prev) => ({ left: el.offsetLeft, width: el.offsetWidth, animate: animate && prev !== null }));
    };
    measure(true);
    const group = groupRef.current;
    if (!group || typeof ResizeObserver === 'undefined') return;
    let lastWidth = group.offsetWidth;
    const observer = new ResizeObserver(() => {
      if (group.offsetWidth === lastWidth) return;
      lastWidth = group.offsetWidth;
      measure(false);
    });
    observer.observe(group);
    return () => observer.disconnect();
  }, [index]);

  const move = (next: number) => {
    const target = (next + options.length) % options.length;
    select(options[target].value);
    refs.current[target]?.focus();
  };
  return (
    <div ref={groupRef} role="radiogroup" aria-label={label} className={`relative isolate rounded-lg border border-line bg-segmented-track p-0.5 ${fill ? 'flex w-full sm:inline-flex sm:w-auto' : 'inline-flex'}`}>
      {pill && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0.5 left-0 rounded-md bg-surface shadow-sm ring-1 ring-line ${
            pill.animate ? 'transition-[transform,width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]' : ''
          }`}
          style={{ width: pill.width, transform: `translateX(${pill.left}px)` }}
        />
      )}
      {options.map((option, i) => {
        const checked = option.value === current;
        return (
          <button
            key={option.value}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-description={option.badge}
            title={option.title}
            tabIndex={checked || (index < 0 && i === 0) ? 0 : -1}
            onClick={() => select(option.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move(i + 1); }
              if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(i - 1); }
            }}
            className={`relative z-10 rounded-md font-medium transition-colors duration-200 ${size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-sm'} ${fill ? 'max-sm:min-w-0 max-sm:flex-1 max-sm:px-1' : ''} ${
              checked ? `text-ink ${pill ? '' : 'bg-surface shadow-sm ring-1 ring-line'}` : 'text-muted hover:text-ink'
            }`}
          >
            {option.label}
            {option.badge && (
              <span aria-hidden="true" className={freeBadgeClass}>
                {option.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Toasts: honest, announced feedback for every action ---------- */

interface Toast { id: number; tone: 'success' | 'error'; message: string }
const ToastContext = createContext<(tone: Toast['tone'], message: string) => void>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(0);
  const push = useCallback((tone: Toast['tone'], message: string) => {
    const id = ++next.current;
    setToasts((list) => [...list.slice(-2), { id, tone, message }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), tone === 'error' ? 7000 : 3200);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite" role="status">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex max-w-md items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink shadow-lg"
          >
            <UiIcon name={toast.tone === 'success' ? 'check' : 'x-circle'} className={`size-[18px] ${toast.tone === 'success' ? 'text-success' : 'text-danger'}`} />
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
