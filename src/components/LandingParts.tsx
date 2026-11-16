import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { LocalLink, useI18n } from '../i18n';
import { scopeIds } from '../lib/artwork';
import type { IconEntry, StyleId } from '../lib/catalog';
import { copyText } from '../lib/export';
import { iconKeywords, iconPath, svgFilePath } from '../lib/icon-pages';
import { DEFAULT_LOOK, gridVars } from '../lib/look';
import { useTheme } from '../lib/theme';
import { CodeBlock } from './CodeBlock';
import { Tag, useToast } from './ui';

/** Shared pieces of the crawlable landing pages (icon, category, React/Vue/Figma). */

/** CSS variables that color an icon's roles the way the grid does by default. */
export function useStyleVars(style: StyleId): CSSProperties {
  const { resolved } = useTheme();
  return gridVars(DEFAULT_LOOK, style, resolved) as CSSProperties;
}

/** Inline artwork for one icon; an empty box of the same size while it loads. */
export function Glyph({ svg, idPrefix, className = 'size-6', label }: { svg?: string; idPrefix: string; className?: string; label?: string }) {
  return (
    <span
      className={`glyph inline-block text-ink ${className}`}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      dangerouslySetInnerHTML={svg ? { __html: scopeIds(svg, idPrefix) } : undefined}
    />
  );
}

/**
 * A grid of links to icon pages, each with its Regular artwork and name. The
 * artwork is the published SVG file as a lazy <img> (light pages, indexable
 * by image search); in the dark theme it is inverted, keeping accent hues.
 */
export function IconLinkGrid({ icons }: { icons: IconEntry[] }) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-2">
      {icons.map((icon) => (
        <li key={icon.name}>
          <LocalLink
            to={iconPath(icon.name)}
            className="flex h-full flex-col items-center gap-2.5 rounded-xl border border-line bg-surface px-2 pb-3 pt-4 text-center text-ink transition hover:border-brand hover:bg-brand-soft"
          >
            <img
              src={svgFilePath('regular', icon.name)}
              alt=""
              width={28}
              height={28}
              loading="lazy"
              decoding="async"
              className="size-7 opacity-90 dark:[filter:invert(1)_hue-rotate(180deg)]"
            />
            <span className="w-full break-words text-xs leading-snug text-muted">{icon.name}</span>
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
export function KeywordTags({ icon, size = 'md', className = '' }: { icon: IconEntry; size?: 'sm' | 'md'; className?: string }) {
  const { t } = useI18n();
  const keywords = iconKeywords(icon);
  if (!keywords.length) return null;
  return (
    <ul aria-label={t('iconPage.keywords')} className={`flex flex-wrap gap-1.5 ${className}`}>
      {keywords.map((word) => (
        <li key={word}>
          <Tag to={`/?${new URLSearchParams({ q: word })}`} size={size}>{word}</Tag>
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
          className="rounded-md px-2 py-1 text-xs font-medium text-[#c9c9cf] transition hover:bg-white/10 hover:text-white"
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
  const [picked, setPicked] = useState<string | null>(null);
  // After hydration, so the prerendered page and the first render agree.
  useEffect(() => { setPicked((p) => p ?? readTab()); }, []);
  const index = Math.max(0, tabs.findIndex((tab) => tab.id === picked));
  const active = tabs[index];
  const choose = (i: number) => {
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
    <div role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-${active.id}`}>
      <CopyCode
        code={active.code}
        lang={active.lang}
        what={active.label}
        label={(
          <span role="tablist" aria-label={label} onKeyDown={onKeyDown} className="-ml-1.5 flex gap-1">
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
                className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                  i === index ? 'bg-white/10 text-white' : 'text-[#9a9aa3] hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </span>
        )}
      />
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; to?: string }[] }) {
  const { t } = useI18n();
  return (
    <nav aria-label={t('iconPage.breadcrumb')} className="text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden="true" className="text-faint">/</span>}
            {item.to
              ? <LocalLink to={item.to} className="rounded underline-offset-2 hover:text-ink hover:underline">{item.label}</LocalLink>
              : <span aria-current="page" className="text-ink">{item.label}</span>}
          </li>
        ))}
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

