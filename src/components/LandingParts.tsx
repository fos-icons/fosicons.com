import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEventHandler, type ReactNode } from 'react';
import { Link } from 'react-router';
import { LocalLink, useI18n } from '../i18n';
import { scopeIds } from '../lib/artwork';
import type { IconEntry, StyleId } from '../lib/catalog';
import { copyText } from '../lib/export';
import { gridPreviewPath, iconKeywords, iconPath } from '../lib/icon-pages';
import { DEFAULT_LOOK, gridVars } from '../lib/look';
import { useTheme } from '../lib/theme';
import { CodeBlock } from './CodeBlock';
import { IconCardContent, iconCardClass, iconCardGlyphClass } from './IconCard';
import { SlidingPill, Tag, UiIcon, useSlidingPill, useToast } from './ui';

/** Shared pieces of the crawlable landing pages (icon, category, React/Vue/Figma). */

/** CSS variables that color an icon's roles the way the grid does by default. */
export function useStyleVars(style: StyleId): CSSProperties {
  const { resolved } = useTheme();
  return gridVars(DEFAULT_LOOK, style, resolved) as CSSProperties;
}

/** Inline artwork for one icon; an empty box of the same size while it loads. */
export function Glyph({ svg, idPrefix, className = 'size-6', label, style }: { svg?: string; idPrefix: string; className?: string; label?: string; style?: CSSProperties }) {
  return (
    <span
      className={`glyph inline-block text-ink ${className}`}
      style={style}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      dangerouslySetInnerHTML={svg ? { __html: scopeIds(svg, idPrefix) } : undefined}
    />
  );
}

/**
 * The catalog cards as links to individual icon pages, with standalone
 * previews that use the catalog's default stroke and load lazily.
 */
export function IconLinkGrid({ icons, label, className = '' }: {
  icons: readonly Pick<IconEntry, 'name'>[];
  /** Names the list for screen readers. */
  label?: string;
  className?: string;
}) {
  return (
    <ul aria-label={label} className={`icon-card-grid ${className}`.trim()}>
      {icons.map((icon) => (
        <li key={icon.name}>
          <LocalLink
            to={iconPath(icon.name)}
            aria-label={icon.name}
            className={iconCardClass()}
          >
            <IconCardContent name={icon.name}>
              <img
                src={gridPreviewPath(icon.name)}
                alt=""
                width={DEFAULT_LOOK.size}
                height={DEFAULT_LOOK.size}
                loading="lazy"
                decoding="async"
                className={`${iconCardGlyphClass} dark:[filter:invert(1)_hue-rotate(180deg)]`}
              />
            </IconCardContent>
          </LocalLink>
        </li>
      ))}
    </ul>
  );
}

/**
 * The words people search for an icon by, each a link to that search. Shared
 * by the icon page and the side pane; renders nothing for untagged icons.
 */
export function KeywordTags({ icon, size = 'md', tone, className = '' }: { icon: IconEntry; size?: 'sm' | 'md'; tone?: 'neutral'; className?: string }) {
  const { t } = useI18n();
  const keywords = iconKeywords(icon);
  if (!keywords.length) return null;
  return (
    <ul aria-label={t('iconPage.keywords')} className={`flex flex-wrap gap-1.5 ${className}`}>
      {keywords.map((word) => (
        <li key={word}>
          <Tag to={`/?${new URLSearchParams({ q: word })}`} size={size} tone={tone}>{word}</Tag>
        </li>
      ))}
    </ul>
  );
}

/** A code block with a Copy button. */
export function CopyCode({ code, lang, what, label, wrap, className = '' }: {
  code: string;
  lang: string;
  what: string;
  label?: ReactNode;
  wrap?: boolean;
  className?: string;
}) {
  const toast = useToast();
  const { t } = useI18n();
  return (
    <CodeBlock
      code={code}
      lang={lang}
      label={label}
      wrap={wrap}
      className={className}
      action={(
        <button
          type="button"
          onClick={() => copyText(code).then(() => toast('success', t('iconPage.copied', { what })), (e: Error) => toast('error', e.message))}
          className="rounded-md px-2 py-1 text-xs font-medium text-[var(--code-muted)] transition hover:bg-[var(--code-hover)] hover:text-[var(--code-ink)]"
        >
          {t('code.copy')}
        </button>
      )}
    />
  );
}

const TAB_KEY = 'fos:code-tab';
const readTab = () => { try { return localStorage.getItem(TAB_KEY); } catch { return null; } };
const saveTab = (id: string) => { try { localStorage.setItem(TAB_KEY, id); } catch { /* not saved */ } };

/**
 * One code block with a tab per framework in its title bar, so snippets that
 * do the same job sit in one place instead of side by side. The last tab a
 * visitor picked is remembered on this device.
 */
export function CodeTabs({ tabs, label }: {
  tabs: { id: string; label: string; code: string; lang: string }[];
  /** Accessible name for the tab list. */
  label: string;
}) {
  const uid = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const groupRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<string | null>(null);
  // After hydration, so the prerendered page and the first render agree.
  useEffect(() => { setPicked((p) => p ?? readTab()); }, []);
  const index = Math.max(0, tabs.findIndex((tab) => tab.id === picked));
  const active = tabs[index];
  const pill = useSlidingPill(groupRef, refs, index);
  // A tab the visitor picks reveals its code top to bottom (not the remembered tab on load).
  const revealNext = useRef(false);
  const reveal = useRef<Animation | null>(null);
  useEffect(() => {
    if (!revealNext.current) return;
    revealNext.current = false;
    const pre = panelRef.current?.querySelector('pre');
    if (!pre || typeof pre.animate !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    reveal.current?.cancel();
    pre.classList.add('code-reveal');
    const animation = pre.animate(
      [{ maskPosition: '0 100%' }, { maskPosition: '0 0' }],
      { duration: 520, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    );
    reveal.current = animation;
    const done = () => { if (reveal.current === animation) { pre.classList.remove('code-reveal'); reveal.current = null; } };
    animation.onfinish = done;
    animation.oncancel = done;
  }, [active.id]);
  useEffect(() => () => reveal.current?.cancel(), []);
  const choose = (i: number) => {
    if (i !== index) revealNext.current = true;
    setPicked(tabs[i].id);
    saveTab(tabs[i].id);
    refs.current[i]?.focus();
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    choose((next + tabs.length) % tabs.length);
  };
  return (
    <div ref={panelRef} role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-${active.id}`}>
      <CopyCode
        code={active.code}
        lang={active.lang}
        what={active.label}
        label={(
          <div className="-ml-1.5 min-w-0 overflow-x-auto">
            <div ref={groupRef} role="tablist" aria-label={label} onKeyDown={onKeyDown} className="relative isolate flex w-max gap-1">
              {pill && <SlidingPill position={pill} className="inset-y-0 rounded-md bg-[var(--code-hover)]" />}
              {tabs.map((tab, i) => (
                <button
                  key={tab.id}
                  ref={(el) => { refs.current[i] = el; }}
                  type="button"
                  role="tab"
                  id={`${uid}-${tab.id}`}
                  aria-selected={i === index}
                  aria-controls={`${uid}-panel`}
                  tabIndex={i === index ? 0 : -1}
                  onClick={() => choose(i)}
                  className={`relative z-10 shrink-0 rounded-md px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-offset-[-2px] ${
                    i === index ? `text-[var(--code-ink)] ${pill ? '' : 'bg-[var(--code-hover)]'}` : 'text-[var(--code-muted)] hover:text-[var(--code-ink)]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        )}
      />
    </div>
  );
}

export function Breadcrumbs({ items, backLink, linkClassName = '' }: {
  items: { label: string; to?: string }[];
  backLink?: { to: string; onClick?: MouseEventHandler<HTMLAnchorElement> };
  linkClassName?: string;
}) {
  const { t, path } = useI18n();
  return (
    <nav aria-label={t('iconPage.breadcrumb')} className="text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => {
          const back = i === 0 ? backLink : undefined;
          const to = back?.to ?? (item.to ? path(item.to) : undefined);
          return (
            <li key={item.label} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden="true" className="text-faint">/</span>}
              {to
                ? <Link to={to} onClick={back?.onClick} className={`rounded underline-offset-2 hover:text-ink hover:underline ${backLink ? 'inline-flex min-h-6 items-center gap-1' : ''} ${linkClassName}`}>
                    {back && <UiIcon name="chevron-down" className="size-4 rotate-90 rtl:-rotate-90" />}
                    {item.label}
                  </Link>
                : <span aria-current="page" className="text-ink">{item.label}</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function LandingSection({ id, title, children, narrow = false, className = '' }: {
  id: string;
  title: ReactNode;
  children: ReactNode;
  /** Center the heading and content in a reading-width column; the divider stays full width. */
  narrow?: boolean;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={`border-t border-line pt-8 ${className}`}>
      <div className={narrow ? 'mx-auto max-w-3xl' : undefined}>
        <h2 id={id} className="text-xl font-semibold tracking-tight">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </section>
  );
}

