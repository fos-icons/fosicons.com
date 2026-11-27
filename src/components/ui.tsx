import { createContext, startTransition, useCallback, useContext, useLayoutEffect, useRef, useState, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ComponentPropsWithRef, type ReactNode, type RefObject, type SelectHTMLAttributes } from 'react';
import type { LinkProps } from 'react-router';
import { LocalLink, useI18n } from '../i18n';
import animatedCheck from '../data/ui-animated-check.json';
import uiIcons from '../data/ui-icons.json';

export type UiIconName = keyof typeof uiIcons;

/** Interface glyphs are the library's own Regular icons from the synced library. */
export function UiIcon({ name, className = 'size-5' }: { name: UiIconName; className?: string }) {
  return <span aria-hidden="true" className={`glyph inline-block shrink-0 ${className}`} dangerouslySetInnerHTML={{ __html: uiIcons[name] }} />;
}

/** The library's checkmark, drawn once on mount. */
export function UiAnimatedCheck({ className = 'size-5' }: { className?: string }) {
  return <span aria-hidden="true" className={`animated-check glyph inline-block shrink-0 ${className}`} dangerouslySetInnerHTML={{ __html: animatedCheck.check ?? uiIcons.check }} />;
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
  sm: { box: 'h-8 gap-1.5 px-2.5', icon: 'size-4' },
  md: { box: 'h-9 gap-2 px-3', icon: 'size-[18px]' },
  lg: { box: 'h-10 gap-2 px-4', icon: 'size-4' },
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
  `button-corners inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${SIZES[size].box} ${VARIANTS[variant]}`;

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
export function Tag({ to, size = 'md', tone, children }: { to: string; size?: 'sm' | 'md'; tone?: 'neutral'; children: ReactNode }) {
  return (
    <LocalLink
      to={to}
      className={`inline-flex items-center rounded-lg font-medium transition-colors ${tone === 'neutral'
        ? 'bg-sunken text-muted hover:bg-line hover:text-ink'
        : 'bg-tag-soft text-tag hover:bg-tag-soft/55'
      } ${
        size === 'sm' ? 'h-6 px-2 text-xs' : 'h-8 px-3 text-sm'
      }`}
    >
      {children}
    </LocalLink>
  );
}

export function IconButton({ label, icon, hoverIcon, className = '', ...props }: ComponentPropsWithRef<'button'> & { label: string; icon: UiIconName; hoverIcon?: UiIconName }) {
  return (
    <button
      type="button"
      aria-label={label}
      data-tooltip={label}
      className={`inline-flex size-9 items-center justify-center text-ink transition hover:bg-sunken ${hoverIcon ? 'group/icon-button' : ''} ${className}`}
      {...props}
    >
      {hoverIcon ? (
        <>
          <span className="contents group-hover/icon-button:hidden group-focus-visible/icon-button:hidden"><UiIcon name={icon} /></span>
          <span className="hidden group-hover/icon-button:contents group-focus-visible/icon-button:contents"><UiIcon name={hoverIcon} /></span>
        </>
      ) : <UiIcon name={icon} />}
    </button>
  );
}

interface RangeValueField {
  value: number;
  min: number;
  max: number;
  step: number | 'any';
  onChange: (value: number) => void;
}

/** A compact native slider, with a directly editable value and an optional default marker. */
export function RangeSlider({
  id, label, min, max, step, value, onChange, valueText, unit, defaultValue, tooltip,
  valueLabel, field = { value, min, max, step, onChange },
}: {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  valueText?: string;
  unit?: string;
  defaultValue?: number;
  tooltip?: string;
  valueLabel?: string;
  /** Override the text field when it uses different units or bounds from the slider. */
  field?: RangeValueField;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipId = `${id}-help`;
  const titleClass = 'compact-range-title inline-flex h-full shrink-0 items-center bg-brand-soft ps-2.5 pe-1.5 text-start font-display text-xs font-semibold leading-tight text-muted';
  const position = (n: number) => {
    const ratio = max > min ? (Math.min(max, Math.max(min, n)) - min) / (max - min) : 0;
    return `calc(2px + (100% - 4px) * ${ratio})`;
  };

  const commit = () => {
    setDraft(null);
    if (!draft?.trim()) return;
    const parsed = Number(draft);
    if (!Number.isFinite(parsed) || parsed === field.value) return;
    const snapped = field.step === 'any' ? parsed
      : field.min + Math.round((parsed - field.min) / field.step) * field.step;
    const next = Math.min(field.max, Math.max(field.min, Number(snapped.toFixed(6))));
    if (next !== field.value) field.onChange(next);
  };

  return (
    <div className={`relative isolate ${showTooltip ? 'z-[1]' : ''}`}>
      <div className="button-corners flex h-10 items-center border border-line bg-surface focus-within:border-focus">
        {tooltip ? (
          <button
            type="button"
            id={`${id}-title`}
            aria-describedby={tooltipId}
            className={`${titleClass} cursor-help whitespace-nowrap underline decoration-dotted underline-offset-2 hover:text-ink`}
            onPointerEnter={() => setShowTooltip(true)}
            onPointerLeave={() => setShowTooltip(false)}
            onFocus={() => setShowTooltip(true)}
            onBlur={() => setShowTooltip(false)}
            onClick={() => setShowTooltip(true)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && showTooltip) {
                event.stopPropagation();
                setShowTooltip(false);
              }
            }}
          >
            {label}
          </button>
        ) : <label htmlFor={id} className={`${titleClass} max-w-[46%] cursor-pointer`}>{label}</label>}
        <div className="compact-range-track relative h-full min-w-0 flex-1">
          <span aria-hidden="true" className="compact-range-fill" style={{ width: position(value) }} />
          {defaultValue !== undefined && (
            <span aria-hidden="true" className="compact-range-default" data-filled={defaultValue <= value || undefined}
              style={{ insetInlineStart: position(defaultValue) }} />
          )}
          <input
            id={id}
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            aria-labelledby={tooltip ? `${id}-title` : undefined}
            aria-valuetext={valueText}
            onChange={(event) => onChange(Number(event.target.value))}
            className="compact-range relative block h-full w-full focus-visible:-outline-offset-2"
          />
        </div>
        <label className="flex shrink-0 items-center gap-1 pe-2.5 text-xs text-muted">
          <span className="sr-only">{valueLabel ?? t('slider.editValue', { label })}</span>
          <input
            type="number"
            inputMode={field.step === 1 ? 'numeric' : 'decimal'}
            min={field.min}
            max={field.max}
            step={field.step}
            value={draft ?? field.value}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                event.currentTarget.blur();
              } else if (event.key === 'Escape') {
                event.stopPropagation();
                setDraft(null);
              }
            }}
            className="compact-range-value h-7 w-[5ch] cursor-text rounded-md text-end font-mono text-xs tabular-nums text-ink hover:bg-sunken focus-visible:bg-sunken"
          />
          {unit && <span aria-hidden="true">{unit}</span>}
        </label>
      </div>
      {tooltip && (
        <span id={tooltipId} role="tooltip" hidden={!showTooltip}
          className="site-tooltip pointer-events-none absolute start-0 top-full z-20 mt-1 w-64 max-w-full rounded-md px-3 py-2 text-xs leading-relaxed shadow-md">
          {tooltip}
        </span>
      )}
    </div>
  );
}

export const freeBadgeClass = 'pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-green-100 px-1.5 text-[10px] leading-4 font-semibold text-green-900 ring-2 ring-canvas dark:bg-green-950 dark:text-green-200';

type PillPosition = { left: number; width: number; animate: boolean };

export function useSlidingPill(
  groupRef: RefObject<HTMLDivElement | null>,
  buttons: RefObject<(HTMLButtonElement | null)[]>,
  index: number,
) {
  const [pill, setPill] = useState<PillPosition | null>(null);
  useLayoutEffect(() => {
    const group = groupRef.current;
    const button = buttons.current[index];
    if (!group || !button) { setPill(null); return; }
    const measure = (animate: boolean) => {
      const left = button.offsetLeft;
      const width = button.offsetWidth;
      setPill((previous) => previous?.left === left && previous.width === width
        ? previous
        : { left, width, animate: animate && previous !== null });
    };
    measure(true);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => measure(false));
    observer.observe(group);
    for (const option of buttons.current) if (option) observer.observe(option);
    return () => observer.disconnect();
  }, [groupRef, buttons, index]);
  return pill;
}

export function SlidingPill({ position, className }: { position: PillPosition; className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute left-0 ${className} ${position.animate
        ? 'motion-safe:transition-[transform,width] motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]'
        : ''}`}
      style={{ width: position.width, transform: `translateX(${position.left}px)` }}
    />
  );
}

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
  const pill = useSlidingPill(groupRef, refs, index);

  const move = (next: number) => {
    const target = (next + options.length) % options.length;
    select(options[target].value);
    refs.current[target]?.focus();
  };
  return (
    <div ref={groupRef} role="radiogroup" aria-label={label} className={`button-corners relative isolate border border-line bg-segmented-track p-0.5 ${fill ? 'flex w-full sm:inline-flex sm:w-auto' : 'inline-flex'}`}>
      {pill && <SlidingPill position={pill} className="button-corners inset-y-0.5 bg-surface shadow-sm ring-1 ring-line" />}
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
            data-tooltip={option.title}
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
            className="pointer-events-auto flex max-w-md items-center gap-2 rounded-xl border border-white/15 bg-black px-4 py-2.5 text-sm text-white shadow-lg"
          >
            {toast.tone === 'success' ? (
              <UiAnimatedCheck className="size-[18px]" />
            ) : <UiIcon name="x-circle" className="size-[18px]" />}
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

/**
 * The "/" shortcut hint at the end of a search box: a square key centered in
 * its slot, so it mirrors the search icon at the other end.
 */
export function SlashHint({ size = 'sm', className = '' }: { size?: 'sm' | 'md'; className?: string }) {
  const box = size === 'md' ? 'size-6 rounded-md text-xs' : 'size-5 rounded-[5px] text-[11px]';
  return (
    <kbd aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center border border-line bg-sunken font-sans font-medium leading-none text-muted ${box} ${className}`}>/</kbd>
  );
}
