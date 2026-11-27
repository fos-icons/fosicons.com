import { useI18n } from '../i18n';
import { useEffect, useRef, useState, type ReactNode } from 'react';


/**
 * A dark code block with syntax colors. Plain text renders first; the
 * highlighter is loaded on demand and swaps in colored markup.
 */
const CODE_LANGS = ['tsx', 'ts', 'sh', 'html', 'svg', 'vue', 'svelte', 'css', 'dart', 'yaml'] as const;
type CodeLang = (typeof CODE_LANGS)[number];

export function CodeBlock({ code, lang, action, label, wrap = false, className = '' }: {
  code: string;
  lang: string;
  /** Replaces the language name in the title bar, e.g. with tabs. */
  label?: ReactNode;
  /** Wrap long lines instead of scrolling sideways (for one-line markup such as SVG). */
  wrap?: boolean;
  /** Optional control in the title bar, e.g. a Copy button. */
  action?: ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  const preRef = useRef<HTMLPreElement>(null);
  const [near, setNear] = useState(false);
  const [scrollable, setScrollable] = useState(false);
  const [html, setHtml] = useState<{ code: string; lang: string; value: string | null } | null>(null);

  useEffect(() => {
    const pre = preRef.current;
    if (!pre || typeof IntersectionObserver === 'undefined') { setNear(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setNear(true);
      observer.disconnect();
    }, { rootMargin: '240px' });
    observer.observe(pre);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!near) return;
    let live = true;
    import('../lib/highlight').then(({ highlight }) => {
      if (live) setHtml({ code, lang, value: highlight(code, lang) });
    }, () => {});
    return () => { live = false; };
  }, [code, lang, near]);
  const colored = html && html.code === code && html.lang === lang ? html.value : null;
  const terminal = lang === 'sh';

  useEffect(() => {
    const pre = preRef.current;
    if (!pre || wrap) { setScrollable(false); return; }
    const measure = () => setScrollable(pre.scrollWidth > pre.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(pre);
    return () => observer.disconnect();
  }, [code, colored, wrap]);

  return (
    <div className={`code-block overflow-hidden rounded-xl ${className}`} data-lang={lang}>
      <div className="code-bar flex h-9 items-center gap-2 px-3 text-xs font-medium">
        {terminal && (
          <span aria-hidden="true" className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-[#ff5f57]" />
            <span className="size-2.5 rounded-full bg-[#febc2e]" />
            <span className="size-2.5 rounded-full bg-[#28c840]" />
          </span>
        )}
        {label ?? <span>{CODE_LANGS.includes(lang as CodeLang) ? t(`code.${lang as CodeLang}`) : lang}</span>}
        {action && <span className="ml-auto shrink-0">{action}</span>}
      </div>
      <pre ref={preRef} tabIndex={scrollable ? 0 : undefined} className={`${wrap ? 'whitespace-pre-wrap break-all' : 'overflow-x-auto'} px-4 pb-4 pt-1 font-mono text-[13px] leading-relaxed focus-visible:outline-offset-[-2px]`}>
        {colored !== null
          ? <code dangerouslySetInnerHTML={{ __html: colored }} />
          : <code>{code}</code>}
      </pre>
    </div>
  );
}
