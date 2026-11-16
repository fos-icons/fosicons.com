import type { CSSProperties, ReactNode } from 'react';
import { LocalLink, useI18n } from '../i18n';
import { scopeIds } from '../lib/artwork';
import type { IconEntry, StyleId } from '../lib/catalog';
import { copyText } from '../lib/export';
import { iconPath, svgFilePath } from '../lib/icon-pages';
import { DEFAULT_LOOK, gridVars } from '../lib/look';
import { useTheme } from '../lib/theme';
import { CodeBlock } from './CodeBlock';
import { useToast } from './ui';

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

/** A code block with a Copy button. */
export function CopyCode({ code, lang, what, className = '' }: { code: string; lang: string; what: string; className?: string }) {
  const toast = useToast();
  const { t } = useI18n();
  return (
    <CodeBlock
      code={code}
      lang={lang}
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

export function LandingSection({ id, title, children, className = '' }: { id: string; title: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={`border-t border-line pt-8 ${className}`}>
      <h2 id={id} className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export const primaryButton = 'inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-medium text-brand-ink transition hover:brightness-110';
export const secondaryButton = 'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface px-4 text-sm font-medium text-ink transition hover:bg-sunken';
