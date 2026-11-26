import { SlashHint, UiIcon } from '../components/ui';
import { DEFAULT_LOCALE, LocalLink, useI18n } from '../i18n';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { animatedNames, catalogMeta as catalog, ICONS_ROUNDED, lock, palettes, STYLE_META } from '../lib/catalog-meta';
import { copyText } from '../lib/export';
import { editorPath } from '../lib/icon-pages';
import { angularSnippet, solidSnippet } from '../lib/react-snippet';
import { FIGMA_URL, FLUTTER_PACKAGE, FRAMEWORK_PACKAGES, LIBRARY_URL, packageSource, PLATFORM_NAMES } from '../lib/links';
import { CodeBlock } from '../components/CodeBlock';
import { useToast } from '../components/ui';
import { createPortal } from 'react-dom';
import { CONTAINER, DOCS_GRID, useHeaderSlot } from '../lib/layout';
import { useMediaQuery } from '../lib/theme';
import { useSlashToFocus } from '../hooks/useSlashToFocus';
import { useActiveSection } from '../hooks/useActiveSection';

const nf = new Intl.NumberFormat('en-US');

const CONTENTS: { id: string; title: string; sections: readonly (readonly [string, string])[] }[] = [
  {
    id: 'design',
    title: 'Design',
    sections: [
      ['styles', 'Styles'],
      ['figma', 'Figma'],
      ['colors', 'Colors'],
      ['sizes', 'Sizes'],
      ['modifiers', 'Modifiers'],
      ['animated', 'Animated'],
    ],
  },
  {
    id: 'code',
    title: 'Code',
    sections: [
      ['svg', 'SVG'],
      ...Object.entries(FRAMEWORK_PACKAGES).map(([id, { label }]) => [id, label] as const),
      ['flutter', FLUTTER_PACKAGE.label],
    ],
  },
  {
    id: 'plugins',
    title: 'Plugins',
    sections: [['framer', 'Framer'], ['ai-agents', 'AI agents']],
  },
  {
    id: 'reference',
    title: 'Reference',
    sections: [
      ['accessibility', 'Accessibility'],
      ['licensing', 'Licensing'],
      ['privacy', 'Privacy'],
      ['terms', 'Terms'],
      ['source', 'Source data'],
    ],
  },
];

const ALL_IDS = CONTENTS.flatMap(({ sections }) => sections.map(([id]) => id));

function Code({ children, lang }: { children: string; lang: string }) {
  const toast = useToast();
  return (
    <CodeBlock
      code={children}
      lang={lang}
      className="my-4"
      action={(
        <button
          type="button"
          onClick={() => copyText(children).then(() => toast('success', 'Copied'), (e: Error) => toast('error', e.message))}
          className="min-h-8 rounded-md px-2 text-xs font-medium text-[var(--code-muted)] transition hover:bg-[var(--code-hover)] hover:text-[var(--code-ink)]"
        >
          Copy
        </button>
      )}
    />
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6 border-t border-line pt-10">
      <h2 id={`${id}-title`} tabIndex={-1} className="rounded text-2xl font-semibold">{title}</h2>
      <div className="prose-docs mt-4 space-y-4">{children}</div>
    </section>
  );
}

const HIGHLIGHT = 'docs-search';

/** Lowercased words of a query; a section matches when it contains all of them. */
const queryWords = (q: string) => q.toLowerCase().split(/\s+/).filter(Boolean);

/** Text nodes a reader sees as content: skips button labels (Copy) and aria-hidden chrome. */
function contentTextNodes(root: Element): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (node.parentElement?.closest('button, [aria-hidden="true"]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  return nodes;
}

/**
 * Filters the docs sections by a query: hides sections that don't contain
 * every word and highlights the matches where the browser supports
 * CSS.highlights. Returns the ids still shown, in page order.
 */
function useSectionFilter(query: string) {
  const [shown, setShown] = useState<readonly string[]>(ALL_IDS);
  const words = queryWords(query).join(' ');

  useEffect(() => {
    const terms = words ? words.split(' ') : [];
    const ranges: Range[] = [];
    const matched: string[] = [];
    for (const id of ALL_IDS) {
      const section = document.getElementById(id);
      if (!section) continue;
      const nodes = terms.length ? contentTextNodes(section) : [];
      const text = nodes.map((n) => n.data).join('').toLowerCase();
      const match = terms.every((w) => text.includes(w));
      section.hidden = !match;
      if (!match) continue;
      matched.push(id);
      for (const node of nodes) {
        const lower = node.data.toLowerCase();
        for (const w of terms) {
          for (let i = lower.indexOf(w); i !== -1; i = lower.indexOf(w, i + w.length)) {
            const range = document.createRange();
            range.setStart(node, i);
            range.setEnd(node, i + w.length);
            ranges.push(range);
          }
        }
      }
    }
    setShown(matched);
    const highlights = typeof CSS !== 'undefined' ? CSS.highlights : undefined;
    if (highlights && typeof Highlight !== 'undefined') {
      if (ranges.length) highlights.set(HIGHLIGHT, new Highlight(...ranges));
      else highlights.delete(HIGHLIGHT);
    }
  }, [words]);

  useEffect(() => () => {
    if (typeof CSS !== 'undefined') CSS.highlights?.delete(HIGHLIGHT);
  }, []);

  return shown;
}

function DocsSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useSlashToFocus(ref);
  return (
    <div className="relative">
      <UiIcon name="search" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
      <input
        ref={ref}
        type="search"
        name="q"
        aria-label="Search the docs"
        placeholder="Search docs"
        value={value}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape' && value) { e.preventDefault(); onChange(''); } }}
        className="h-11 w-full rounded-lg border border-line-strong bg-surface pl-9 pr-9 text-base text-ink outline-none transition placeholder:text-muted focus:border-brand focus:ring-4 focus:ring-brand/15 md:h-9 md:text-sm [&::-webkit-search-cancel-button]:hidden"
      />
      {/* A 32px slot centered 20px from the right edge, mirroring the search icon. */}
      <div className="absolute right-1 top-1/2 flex w-8 -translate-y-1/2 justify-center">
        {value ? (
          <button type="button" aria-label="Clear search" onClick={() => { onChange(''); ref.current?.focus(); }} className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-sunken hover:text-ink md:size-6">
            <UiIcon name="x" className="size-4" />
          </button>
        ) : (
          <SlashHint className="max-md:hidden" />
        )}
      </div>
    </div>
  );
}

function DocsContents({ shown, active, section, searching, desktop, onChoose }: {
  shown: readonly string[];
  active: string;
  section: string;
  searching: boolean;
  desktop: boolean;
  onChoose: (id: string) => void;
}) {
  const contentsId = useId();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [groups, setGroups] = useState<Record<string, boolean>>({});
  const readingGroup = desktop
    ? CONTENTS.find((group) => group.id !== 'design' && group.sections.some(([id]) => id === active))?.id
    : undefined;

  useEffect(() => { setGroups({}); }, [searching, section]);
  // Reopen a group on entry while leaving manual toggles available within it.
  useEffect(() => {
    if (readingGroup) setGroups((previous) => ({ ...previous, [readingGroup]: true }));
  }, [readingGroup, searching, section]);

  return (
    <aside className="min-w-0 self-start md:sticky md:top-8 md:col-start-1 md:row-span-2 md:row-start-1 md:max-h-[calc(100dvh-4rem)] md:overflow-y-auto md:p-1">
      <nav aria-label="Documentation">
        <button
          type="button"
          aria-expanded={mobileOpen}
          aria-controls={contentsId}
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink md:hidden"
        >
          On this page
          <UiIcon name="chevron-down" className={`size-4 ${mobileOpen ? 'rotate-180' : ''}`} />
        </button>
        <div id={contentsId} className={`${mobileOpen ? 'block' : 'hidden'} pt-2 md:block md:pt-0`}>
          <p aria-hidden="true" className="mb-2 hidden pl-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted md:block">On this page</p>
          {shown.length === 0 && <p className="px-2 py-2 text-sm text-muted">No matches</p>}
          {CONTENTS.map((group) => {
            const links = group.sections.filter(([id]) => shown.includes(id));
            if (!links.length) return null;
            const expanded = groups[group.id] ?? (searching || (section ? group.sections.some(([id]) => id === section) : desktop && group.id === 'design'));
            const groupId = `${contentsId}-${group.id}`;
            return (
              <div key={group.id} className="border-b border-line last:border-0">
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={groupId}
                  onClick={() => setGroups((previous) => ({ ...previous, [group.id]: !expanded }))}
                  className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-2 text-left text-sm font-medium text-ink hover:bg-sunken md:min-h-9"
                >
                  {group.title}
                  <UiIcon name="chevron-down" className={`size-4 text-muted ${expanded ? 'rotate-180' : ''}`} />
                </button>
                <ul id={groupId} hidden={!expanded} className="space-y-0.5 pb-2 pl-3">
                  {links.map(([id, label]) => (
                    <li key={id}>
                      <a
                        href={`#${id}`}
                        aria-current={active === id ? 'location' : undefined}
                        onClick={(event) => {
                          if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
                          event.preventDefault();
                          onChoose(id);
                          setMobileOpen(false);
                        }}
                        className={`flex min-h-11 items-center rounded-md px-2 text-sm md:min-h-8 ${active === id ? 'bg-brand-soft font-medium text-brand' : 'text-muted hover:bg-sunken hover:text-ink'}`}
                      >
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}

function goToSection(id: string, initial = false) {
  document.getElementById(`${id}-title`)?.focus({ preventScroll: true });
  document.getElementById(id)?.scrollIntoView(initial ? { behavior: 'instant' } : undefined);
}

export default function DocsPage() {
  const { hash } = useLocation();
  const navigate = useNavigate();
  const handledSection = useRef<string | null>(null);
  const [query, setQuery] = useState('');
  const shown = useSectionFilter(query);
  const [active, setActive] = useActiveSection(shown, ALL_IDS[0]);
  const searching = queryWords(query).length > 0;
  const section = hash.slice(1);
  useEffect(() => {
    if (handledSection.current === section) return;
    const target = ALL_IDS.includes(section) ? document.getElementById(section) : null;
    if (target?.hidden) {
      setQuery('');
      return;
    }
    if (target) {
      setActive(section);
      goToSection(section, handledSection.current === null);
    }
    handledSection.current = section;
  }, [section, shown, setActive]);
  const chooseSection = (id: string) => {
    if (id !== section) {
      navigate({ hash: `#${id}` }, { preventScrollReset: true });
    } else {
      setActive(id);
      goToSection(id);
    }
  };
  // Other languages show this English page until a translation exists (see src/i18n/content.ts).
  const { t, config, path } = useI18n();
  const english = config.code !== DEFAULT_LOCALE;
  // On desktop the search box sits in the site header; on phones (and without a header) in the page.
  const headerSlot = useHeaderSlot();
  const desktop = useMediaQuery('(min-width: 768px)');
  const search = <DocsSearch value={query} onChange={setQuery} />;
  const inHeader = headerSlot && desktop;

  return (
    <div className={`docs-page ${CONTAINER} ${DOCS_GRID} grid gap-y-6 pb-20 pt-8 sm:pt-12 md:grid-cols-[var(--docs-nav-width)_minmax(0,720px)] md:gap-y-10`}>
      {inHeader && createPortal(<div className="w-full max-w-md">{search}</div>, headerSlot)}
      <p role="status" className="sr-only">
        {searching ? `${shown.length} ${shown.length === 1 ? 'section matches' : 'sections match'}` : ''}
      </p>
      <header lang={english ? 'en' : undefined} className="min-w-0 md:col-start-2 md:row-start-1">
        {english && (
          <p lang={config.code} className="inline-flex items-center gap-2 rounded-lg bg-sunken px-3 py-1.5 text-sm text-muted">
            <UiIcon name="globe" className="size-4" /> {t('docs.englishOnly')}
          </p>
        )}
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Documentation</h1>
        <p className="mt-3 text-base text-muted">
          Use Fos Icons as plain SVG or with {new Intl.ListFormat('en').format([...PLATFORM_NAMES, 'Framer'])}. {nf.format(ICONS_ROUNDED)}+ icons,
          each in {catalog.styles.length} styles and {catalog.sizes.length} optical sizes from {catalog.sizes[0]} to {catalog.sizes[catalog.sizes.length - 1]}px,
          plus {animatedNames.size} <a href="#animated">animated</a> icons.
        </p>
        {!inHeader && <div className="mt-5 md:mt-4">{search}</div>}
      </header>
      <DocsContents shown={shown} active={active} section={section} searching={searching} desktop={desktop} onChoose={chooseSection} />

      <article lang={english ? 'en' : undefined} className="code-stone min-w-0 space-y-10 md:col-start-2 md:row-start-2">
        {shown.length === 0 && (
          <div className="rounded-xl border border-line p-6 text-center">
            <p className="font-medium text-ink">Nothing in the docs matches “{query.trim()}”</p>
            <p className="mt-1 text-sm text-muted">Try a shorter or different word.</p>
            <button type="button" onClick={() => setQuery('')} className="mt-4 rounded-lg border border-line-strong px-3 py-1.5 text-sm font-medium text-ink hover:bg-sunken">
              Clear search
            </button>
          </div>
        )}

        <Section id="styles" title="Styles">
          <ul className="list-disc space-y-1 pl-5">
            {catalog.styles.map((s) => (
              <li key={s}><strong>{STYLE_META[s].label}</strong>{s === 'filled' && <> (<code>filled</code> in files and code)</>} — {STYLE_META[s].description}.</li>
            ))}
            <li><strong>Animated</strong> — {animatedNames.size} common icons, drawn in Regular with a CSS animation inside the SVG (see <a href="#animated">Animated</a>).</li>
          </ul>
          <p>
            Every icon ships in all {catalog.styles.length} static styles under the same canonical kebab-case name; Animated is a
            curated set, not a version of every icon. Line styles
            use {catalog.strokeWidth}px strokes at {catalog.grid}px; each optical size has its own weight
            (see <a href="#sizes">Sizes</a>). Negative space and modifier clearances are genuinely
            transparent, not painted with a background color.
          </p>
        </Section>

        <Section id="figma" title="Figma">
          <p>The {FIGMA_URL ? <a href={FIGMA_URL} target="_blank" rel="noreferrer">Fos Icons Figma library</a> : 'Fos Icons Figma library'} holds every core icon as a component set with <code>Style=Regular/Filled/Duocolor/Duotone</code> and <code>Size={catalog.sizes.join('/')}</code>. Its <strong>Get Started</strong> page covers styles, instances, themes, modifiers, and exports.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Fos / Theme</strong> switches Light and Dark, and holds the duo palettes.</li>
            <li>Each <strong>Size</strong> variant is drawn for its size and binds its stroke to the matching <strong>Fos / Stroke</strong> mode: {catalog.sizes.map((size) => `${size}px (${catalog.strokeWidths[String(size)]}px)`).join(', ')}. To draw an icon at another size, pick the nearest Size variant and scale the instance.</li>
            <li>Named icon instances expose their nested <strong>Modifier</strong> controls in the properties panel.</li>
          </ul>
          <p>SVGs downloaded here can also be pasted or dropped into Figma; their colors are already resolved.</p>
        </Section>

        <Section id="colors" title="Colors">
          <p>Regular and Filled are single-color icons. Duocolor and Duotone use two CSS custom properties with blue defaults:</p>
          <Code lang="css">{`.toolbar svg {
  --fos-primary: #245B9E;
  --fos-secondary: #5B87B7;
}`}</Code>
          <p>Duocolor uses the secondary color for details; single-contour icons stay primary-only. Duotone tints closed shapes with 16% of the primary color. Named presets add <code>--fos-modifier</code> for their solid glyph.</p>
          <p>The {palettes.palettes.length} library palettes each have Light and Dark pairs.</p>
          <ul className="grid grid-cols-2 gap-2 !pl-0 sm:grid-cols-3" role="list">
            {palettes.palettes.map((p) => (
              <li key={p.name} className="flex list-none items-center gap-2 rounded-lg border border-line px-2.5 py-2 text-sm">
                <span className="flex h-5 w-10 overflow-hidden rounded" aria-hidden="true">
                  <span className="flex-1" style={{ background: p.light.primary }} />
                  <span className="flex-1" style={{ background: p.light.secondary }} />
                  <span className="flex-1" style={{ background: p.dark.primary }} />
                  <span className="flex-1" style={{ background: p.dark.secondary }} />
                </span>
                <span className="text-ink">{p.name}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="sizes" title="Sizes">
          <p>Every icon is drawn separately at {catalog.sizes.length} optical sizes. Each size has its own grid, padding, and stroke weight, so small icons stay open and large ones don&apos;t look heavy:</p>
          <table className="w-full text-left text-sm">
            <thead><tr className="text-muted"><th className="py-1 font-medium">Size</th><th className="py-1 font-medium">Stroke</th><th className="py-1 font-medium">Files</th></tr></thead>
            <tbody>
              {catalog.sizes.map((size) => (
                <tr key={size} className="border-t border-line">
                  <td className="py-1.5">{size}px{size === catalog.grid && ' (canonical)'}</td>
                  <td className="py-1.5">{catalog.strokeWidths[String(size)]}px</td>
                  <td className="py-1.5"><code>{size === catalog.grid ? 'icons/<style>/' : `icons/${size}/<style>/`}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>Filled icons have no stroke: at every size they are the 24px design scaled. For other sizes, use the nearest optical size and scale it. The site does this for you: the grid, the inspector, and every download draw from the nearest size, and <strong>Auto</strong> stroke follows each size&apos;s weight.</p>
          <p>The framework packages ship the 24px design only; their <code>size</code> prop scales it. For a crisp 16px or a lighter 48px, use the matching SVG.</p>
        </Section>

        <Section id="modifiers" title="Modifiers">
          <p>Modifiers combine a base icon with a small solid glyph — Add, Delete, Lock, file-type labels, and more — with a designed corner position and a transparent clearance gap so the glyph never touches the base.</p>
          <p>The library currently includes <strong>{catalog.compositions.count} authored compositions</strong> across {catalog.compositions.bases} base icons, using {catalog.compositions.modifiers} modifiers. In the inspector, open a base icon such as <a href={path(editorPath('user'))}>user</a> or <a href={path(editorPath('file'))}>file</a> and choose from the <strong>Modifier</strong> menu.</p>
          <p>Opening an icon with one modifier starts with the base icon and that modifier selected. You can also choose a modifier and corner in the inspector, or compose the SVG with the Python tool.</p>
          <Code lang="sh">{`python3 scripts/compose_svg.py home-smile --modifier key --position bottom-right --output home-key.svg`}</Code>
        </Section>

        <Section id="animated" title="Animated">
          <p><strong>{animatedNames.size} common icons</strong> also come animated: check, heart, wifi, loaders, the hourglass, every chevron, and more. Browse them in the <a href={path('/?style=animated')}>Animated</a> tab, where each one plays on hover. Copying and downloading them comes with the Advanced plan.</p>
          <p>Where available, choose <strong>Animated</strong> on an icon page such as <a href={path('/icons/download?style=animated')}>Download</a> to preview the motion on its 24px grid, see it at actual sizes, and get framework examples. Opening an icon page from the Animated grid keeps that style selected.</p>
          <p>Each file is a plain SVG built from the Regular artwork, with its CSS animation inside a <code>&lt;style&gt;</code> block. No JavaScript or runtime is needed, so it plays in an <code>&lt;img&gt;</code> tag, inline in HTML, or as a CSS background. The library files are in <code>icons/animated/</code>.</p>
          <Code lang="html">{`<img src="./icons/animated/check.svg" width="24" height="24" alt="Done">`}</Code>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Rest pose.</strong> When the animation is stopped, the icon shows its normal drawing, so it is safe to pause or turn off.</li>
            <li><strong>Reduced motion.</strong> Each file stops its own animation when the visitor has <code>prefers-reduced-motion</code> turned on.</li>
            <li><strong>Inline safely.</strong> Every class and keyframe is prefixed with <code>fa-&lt;name&gt;-</code>, so several animated icons can share a page without clashing. To play on hover only, set <code>animation: none</code> on <code>.fa-&lt;name&gt; *</code> until hover.</li>
            <li><strong>Color and stroke.</strong> Inline icons follow <code>currentColor</code> like Regular ones. Website downloads use your size, color, stroke, and <strong>Animation speed</strong> from Customize.</li>
            <li><strong>GIF.</strong> Where SVG isn&apos;t supported (email, some chat apps), export a GIF from the inspector. It loops the animation as frames. GIF transparency is on or off, so pick a solid background for the smoothest edges.</li>
          </ul>
          <p>To animate any other icon, use the <code>fos-icons-animate</code> skill or the <code>animate_icon</code> tool in the <a href={path('/ai-agents')}>MCP server</a>: describe which parts move and how, and it returns the SVG. The library builds its set the same way, with <code>npm run animate</code>.</p>
        </Section>

        <Section id="svg" title="SVG">
          <p>Download a Regular icon from the inspector or find SVG files in the <a target="_blank" rel="noreferrer" href={LIBRARY_URL}>library repository</a>. The 24px files are organized by style under <code>icons/</code>, and other sizes are in <code>icons/&lt;size&gt;/&lt;style&gt;/</code>. There is no runtime dependency or icon font.</p>
          <Code lang="html">{`<img src="./icons/regular/text-align-left.svg" width="24" height="24" alt="Align text left">`}</Code>
          <p>To theme with CSS, inline the markup instead: the library&apos;s <code>currentColor</code> follows the parent element&apos;s <code>color</code>. Don&apos;t globally override <code>fill</code> on paths — Filled icons rely on real transparent cutouts.</p>
          <p><strong>Website downloads are standalone.</strong> Files exported here have every color resolved to a concrete value, so they render the same in any viewer or design tool. Masks, clip paths, and the Duotone tint are kept intact. If you want live theming, use the library SVGs.</p>
        </Section>

        <Section id="react" title="React">
          <p><a target="_blank" rel="noreferrer" href="https://www.npmjs.com/package/@fos-icons/react"><code>@fos-icons/react</code></a> is on npm. It supports React 18 and 19, ships TypeScript types, and tree-shakes to the icons you import. Source: <a target="_blank" rel="noreferrer" href={packageSource('react')}>packages/react</a>.</p>
          <Code lang="sh">{`npm install @fos-icons/react\n# or\npnpm add @fos-icons/react`}</Code>
          <p>Each style is a separate component: the canonical name in PascalCase plus a style suffix. <code>fuel-pump</code> becomes <code>FuelPumpRegular</code>, <code>FuelPumpFilled</code>, <code>FuelPumpDuocolor</code>, and <code>FuelPumpDuotone</code>. Names starting with a digit get an <code>Icon</code> prefix.</p>
          <Code lang="tsx">{`import { CameraRegular, CameraDuocolor } from '@fos-icons/react';

<CameraRegular size={24} />
<CameraDuocolor size={32} primaryColor="#245B9E" secondaryColor="#60A5FA" />`}</Code>
          <ul className="list-disc space-y-1 pl-5">
            <li><code>size</code> defaults to 24 and sets width and height. It scales the 24px artwork; it does not select a different optical size (see <a href="#sizes">Sizes</a>).</li>
            <li>Regular and Filled inherit <code>currentColor</code>. Duo styles default to blue; set <code>color</code> or <code>primaryColor</code>, and <code>secondaryColor</code> for accents.</li>
            <li>Named presets with an independent glyph color accept <code>modifierColor</code>.</li>
            <li>Icons are decorative by default (<code>aria-hidden</code>). Pass <code>title</code>, <code>aria-label</code>, or <code>aria-labelledby</code> for meaningful icons.</li>
            <li>Root imports are tree-shakeable; <code>@fos-icons/react/filled</code> and <code>@fos-icons/react/regular/camera</code> entry points also exist.</li>
          </ul>
          <p>The icon page and inspector provide copyable examples for each supported framework.</p>
        </Section>

        <Section id="vue" title="Vue">
          <p><a target="_blank" rel="noreferrer" href="https://www.npmjs.com/package/@fos-icons/vue"><code>@fos-icons/vue</code></a> is on npm. It supports Vue 3.3 and later, ships TypeScript types (including SFC template checking), tree-shakes to the icons you import, and renders on the server (Nuxt included). Source: <a target="_blank" rel="noreferrer" href={packageSource('vue')}>packages/vue</a>.</p>
          <Code lang="sh">{`npm install @fos-icons/vue\n# or\npnpm add @fos-icons/vue`}</Code>
          <p>Component names are the same as in the React package: <code>fuel-pump</code> becomes <code>FuelPumpRegular</code>, <code>FuelPumpFilled</code>, <code>FuelPumpDuocolor</code>, and <code>FuelPumpDuotone</code>.</p>
          <Code lang="vue">{`<script setup lang="ts">
import { CameraRegular, CameraDuocolor } from '@fos-icons/vue';
</script>

<template>
  <CameraRegular :size="24" />
  <CameraDuocolor :size="32" primary-color="#245B9E" secondary-color="#60A5FA" />
</template>`}</Code>
          <ul className="list-disc space-y-1 pl-5">
            <li>Props match React: <code>size</code>, <code>color</code>, <code>primaryColor</code>, <code>secondaryColor</code>, and <code>title</code>.</li>
            <li>Components are plain render functions, so <code>h(CameraRegular, {'{'} size: 32 {'}'})</code> and JSX work without an SFC compiler.</li>
            <li>Icons are decorative by default. Pass <code>title</code> or <code>aria-label</code> for meaningful icons.</li>
          </ul>
        </Section>

        <Section id="svelte" title="Svelte">
          <p><code>@fos-icons/svelte</code> supports Svelte 5.20 and later, including SvelteKit, with TypeScript props, tree-shakeable imports, and server rendering. Source: <a target="_blank" rel="noreferrer" href={packageSource('svelte')}>packages/svelte</a>.</p>
          <p><strong>Not yet published to npm.</strong> Build the package from source and create a local tarball:</p>
          <Code lang="sh">{`git clone https://github.com/fos-icons/fos-icons.git
cd fos-icons/packages/svelte
npm ci
npm pack`}</Code>
          <p>Then, from your Svelte app, install the generated tarball using its local path:</p>
          <Code lang="sh">{`npm install /path/to/fos-icons/packages/svelte/fos-icons-svelte-0.1.0.tgz`}</Code>
          <Code lang="svelte">{`<script lang="ts">
import { CameraRegular, CameraDuocolor } from '@fos-icons/svelte';
</script>

<CameraRegular size={24} />
<CameraDuocolor size={32} primaryColor="#245B9E" secondaryColor="#60A5FA" />`}</Code>
          <ul className="list-disc space-y-1 pl-5">
            <li>Names match React and Vue: <code>CameraRegular</code>, <code>CameraFilled</code>, <code>CameraDuocolor</code>, and <code>CameraDuotone</code>. Use camelCase props and braces for numeric values, such as <code>size={'{'}32{'}'}</code>.</li>
            <li><code>size</code>, <code>color</code>, <code>primaryColor</code>, <code>secondaryColor</code>, <code>modifierColor</code>, and <code>title</code> work as in the other packages. Svelte also accepts <code>strokeWidth</code> for existing stroked elements, plus native SVG attributes and event handlers.</li>
            <li>Icons are decorative by default. Give meaningful icons a <code>title</code> or <code>aria-label</code>, and label icon-only buttons on the button itself.</li>
            <li>The package uses JavaScript icon modules and one shared Svelte renderer, not thousands of <code>.svelte</code> files. Title, mask, and clip-path IDs stay unique and stable during hydration.</li>
            <li>Style imports such as <code>@fos-icons/svelte/filled</code> and individual imports such as <code>@fos-icons/svelte/regular/camera</code> are available. Prefer one import style consistently in your app.</li>
          </ul>
        </Section>

        <Section id="solid" title="SolidJS">
          <p><code>@fos-icons/solid</code> targets Solid 2 and includes TypeScript types, tree-shakeable imports, and browser and server rendering. It is tested with <code>2.0.0-rc.21</code> of <code>solid-js</code> and <code>@solidjs/web</code>. Source: <a target="_blank" rel="noreferrer" href={packageSource('solid')}>packages/solid</a>.</p>
          <p>Use an application configured for Solid 2; Solid 1.x is not supported. The SolidJS framework is separate from the icon style labeled Solid, whose components use the <code>Filled</code> suffix.</p>
          <p>Build a local tarball from a monorepo checkout that includes <code>packages/solid</code>. Use Node.js 22.12 or later.</p>
          <Code lang="sh">{`cd fos-icons/packages/solid
npm ci
npm pack`}</Code>
          <p>From your Solid application, install the tarball and its peer dependencies.</p>
          <Code lang="sh">{`npm install /path/to/fos-icons/packages/solid/fos-icons-solid-0.1.0.tgz solid-js@2.0.0-rc.21 @solidjs/web@2.0.0-rc.21`}</Code>
          <Code lang="tsx">{solidSnippet('telescope', 'duocolor', { size: 32, color: null, primary: '#245B9E', secondary: '#60A5FA' })}</Code>
          <ul className="list-disc space-y-1 pl-5">
            <li>Set <code>size</code>, <code>strokeWidth</code>, and color props directly in JSX. The same component works with reactive props and server hydration.</li>
            <li>Icons are decorative by default. Add <code>title</code>, <code>aria-label</code>, or <code>aria-labelledby</code> for meaningful icons.</li>
            <li>Import named components by style from <code>@fos-icons/solid/filled</code>, or use the default export for an individual icon:</li>
          </ul>
          <Code lang="tsx">{`import TelescopeRegular from '@fos-icons/solid/regular/telescope';

<TelescopeRegular />`}</Code>
        </Section>

        <Section id="angular" title="Angular">
          <p><code>@fos-icons/angular</code> supports Angular 20 through 22. The package provides standalone components with typed inputs and tree-shakeable imports. Get the source from <a target="_blank" rel="noreferrer" href={packageSource('angular')}>packages/angular</a>.</p>
          <p>To install a local build, clone the source and create a tarball.</p>
          <Code lang="sh">{`git clone https://github.com/fos-icons/fos-icons.git
cd fos-icons/packages/angular
npm ci
npm pack`}</Code>
          <p>From your Angular application, install the tarball and add the icon component to your component&apos;s <code>imports</code>.</p>
          <Code lang="sh">{`npm install /path/to/fos-icons/packages/angular/fos-icons-angular-0.1.0.tgz`}</Code>
          <Code lang="ts">{angularSnippet('camera', 'duocolor', { size: 32, color: null, primary: '#245B9E', secondary: '#60A5FA' })}</Code>
          <ul className="list-disc space-y-1 pl-5">
            <li>Put the icon selector on a native <code>svg</code> element. Use bindings such as <code>[size]="32"</code> for numbers, or pass a CSS size such as <code>size="2em"</code>.</li>
            <li>Customize colors with <code>color</code>, <code>primaryColor</code>, <code>secondaryColor</code>, and <code>modifierColor</code>. <code>strokeWidth</code> adjusts existing strokes.</li>
            <li>Icons are decorative by default. Use <code>title</code> or <code>label</code> for a meaningful standalone icon. Give an icon-only button its own accessible name.</li>
            <li>Use <code>@fos-icons/angular/filled</code> for a style entry point or <code>@fos-icons/angular/regular/camera</code> for an individual default import.</li>
          </ul>
        </Section>

        <Section id="flutter" title={FLUTTER_PACKAGE.label}>
          <p><code>{FLUTTER_PACKAGE.name}</code> brings every icon in all four styles to Flutter as typed constants, drawn with <code>flutter_svg</code>. Release builds keep only the icons your app uses. It needs Flutter 3.44 or later and isn&apos;t on pub.dev yet. Source: <a target="_blank" rel="noreferrer" href={packageSource('flutter')}>packages/flutter</a>.</p>
          <p>Clone the source, then add the package to your app&apos;s <code>pubspec.yaml</code> as a path dependency.</p>
          <Code lang="sh">{`git clone https://github.com/fos-icons/fos-icons.git`}</Code>
          <Code lang="yaml">{`# pubspec.yaml
dependencies:
  fos_icons:
    path: ../fos-icons/packages/flutter`}</Code>
          <Code lang="dart">{`import 'package:fos_icons/fos_icons.dart';

FosIcon(
  FosIcons.telescopeDuocolor,
  size: 32,
  primaryColor: Color(0xFF245B9E),
  secondaryColor: Color(0xFF60A5FA),
)`}</Code>
          <ul className="list-disc space-y-1 pl-5">
            <li>Each constant is the icon name in camelCase plus its style: <code>fuel-pump</code> becomes <code>FosIcons.fuelPumpRegular</code>, <code>fuelPumpFilled</code>, <code>fuelPumpDuocolor</code>, and <code>fuelPumpDuotone</code>. Names that start with a digit get an <code>icon</code> prefix.</li>
            <li>Regular and Filled icons follow the ambient <code>IconTheme</code> size and color. Duocolor and Duotone keep their palette unless you set <code>primaryColor</code>, <code>secondaryColor</code>, or <code>modifierColor</code>. <code>strokeWidth</code> adjusts existing strokes.</li>
            <li>Icons are decorative by default. Pass <code>semanticLabel</code> for a meaningful standalone icon.</li>
          </ul>
        </Section>

        <Section id="framer" title="Framer">
          <p>The Fos Icons plugin lets you search the library in the Framer editor. Pick Regular, Filled, Duocolor, or Duotone, then adjust the size, colors, and stroke weight where supported.</p>
          <p>Select an icon and choose <strong>Insert icon</strong> to add it to the canvas as an SVG. With one SVG selected on the canvas, <strong>Replace selected SVG</strong> swaps in the new icon.</p>
          <p>To run the plugin locally, follow the <a target="_blank" rel="noreferrer" href={`${LIBRARY_URL}/tree/main/plugins/framer#development`}>Framer plugin setup guide</a>.</p>
        </Section>

        <Section id="ai-agents" title="AI agents">
          <p>Coding agents can use Fos Icons through a free, read-only MCP server at <code>https://www.fosicons.com/mcp</code> (Streamable HTTP, no authentication). Its tools search the catalog, return install and import code for every framework, list icons by category, and check that icon names exist, so agents don&apos;t invent names or draw SVG by hand.</p>
          <p>Plugins for Claude Code and Codex bundle the server with Agent Skills, including one for switching a project from another icon library. <LocalLink to="/ai-agents">Set up your agent</LocalLink> for install steps for Claude Code, Codex, ChatGPT, Cursor, VS Code, and other MCP clients.</p>
        </Section>

        <Section id="accessibility" title="Accessibility">
          <ul className="list-disc space-y-1 pl-5">
            <li>Decorative inline icons: add <code>aria-hidden=&quot;true&quot;</code>.</li>
            <li>Icon-only buttons and links need an accessible name on the control, e.g. <code>aria-label=&quot;Delete&quot;</code>.</li>
            <li>Meaningful standalone icons: <code>role=&quot;img&quot;</code> with a label, or an <code>alt</code> on <code>&lt;img&gt;</code>.</li>
            <li>Check contrast against the background (3:1 for meaningful graphics) and keep interactive targets at least 24×24px.</li>
          </ul>
          <p>An icon library alone can&apos;t make an interface accessible — pair icons with clear labels.</p>
        </Section>

        <Section id="licensing" title="Licensing">
          <p>The core icons and tooling are available under the <a href="/licenses/fos-icons-LICENSE.txt">MIT License</a>.</p>
          <p>Brand icons are <strong>not</strong> covered by the MIT license. All brand icons belong to their respective owners, and their use is governed by each owner&apos;s brand guidelines. No affiliation or endorsement is implied.</p>
        </Section>

        <Section id="privacy" title="Privacy">
          <p>This site sets no cookies. We use Vercel Web Analytics on the public site to count visitors and page views. The page URLs we report omit search terms, inspector settings, and fragments. See <a href="https://vercel.com/docs/analytics/privacy-policy" target="_blank" rel="noreferrer">Vercel Web Analytics privacy</a> for details.</p>
          <p>When you submit feedback, new icon requests are posted publicly to GitHub. Site, package, and icon issue reports are sent by email to the Fos Icons maintainers.</p>
          {import.meta.env.VITE_FEEDBACK_TURNSTILE_SITE_KEY && <p>We use Cloudflare Turnstile to check feedback submissions for automated traffic. See <a href="https://www.cloudflare.com/turnstile-privacy-policy/" target="_blank" rel="noreferrer">Cloudflare’s Turnstile Privacy Addendum</a>.</p>}
          <p>Unsubmitted feedback stays in the current tab so you can resume it after dismissing the form or reloading the page.</p>
          <p>Your browser&apos;s local storage keeps preferences on your device:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><code>fos-theme</code>: light, warm (Ivory), or dark, when you pick one instead of following your system.</li>
            <li><code>fos-pane-collapsed</code>: whether the side pane is collapsed.</li>
            <li><code>fos-learned-tips</code>: which learning tips this browser has already shown.</li>
            <li><code>fos-pane-width</code>: the side pane&apos;s width, when you resize it.</li>
          </ul>
          <p>Icon searches, customizations, and downloads are processed in your browser. We do not track them as separate analytics events. Links to GitHub, npm, and Figma take you to those services, which have their own privacy policies. Like any website, the server hosting this one may keep standard request logs.</p>
          <p>To clear the stored preferences, clear this site&apos;s data in your browser settings.</p>
          <p>The MCP server at <code>/mcp</code>, used by AI agents and the Fos Icons plugins, needs no account and stores no conversation content. For each tool call it logs the tool name and options such as the framework and style, and, for searches that find no icon, the first 60 characters of the search text, so we can see which icons people need. Requests are rate limited by IP address.</p>
        </Section>

        {/* Draft terms: review before publishing (see the PR that added them). */}
        <Section id="terms" title="Terms">
          <p>These terms cover fosicons.com, the Fos Icons MCP server at <code>/mcp</code>, and the Fos Icons plugins for AI tools. By using them, you agree to these terms.</p>
          <p><strong>Icons and packages.</strong> The icons and framework packages are open source under the MIT license. That license, not these terms, governs how you use, copy, and change them. See <a href="#licensing">Licensing</a>.</p>
          <p><strong>Paid plans.</strong> Pro and Advanced unlock features on fosicons.com, as described on the <LocalLink to="/pricing">Pricing</LocalLink> page. Payments are handled by Stripe. Plans renew annually until you cancel; cancelling stops the next renewal, and the plan stays active until the end of the paid period.</p>
          <p><strong>MCP server and plugins.</strong> The MCP server and the plugins for Claude Code, ChatGPT, and Codex are free and need no account. They return icon names, setup instructions, and code from the public catalog. Requests are rate limited. Don&apos;t try to get around the limits or use the service to copy the catalog in bulk; the library repository and packages are the place for that.</p>
          <p><strong>AI output.</strong> AI tools decide how to use what the server returns. Check generated code before you ship it.</p>
          <p><strong>No warranty.</strong> The site, server, and plugins are provided as is, without warranties of any kind. They may change, be unavailable, or stop. To the extent the law allows, Fos Icons is not liable for indirect or consequential damages arising from their use.</p>
          <p><strong>Changes.</strong> We may update these terms. The current version is always on this page; continuing to use the services after a change means you accept it.</p>
          <p><strong>Contact.</strong> Questions about these terms: <a href="mailto:icon@fosicons.com">icon@fosicons.com</a>.</p>
        </Section>

        <Section id="source" title="Source data">
          <p>
            This site is built from the <a target="_blank" rel="noreferrer" href="https://github.com/fos-icons/fos-icons">fos-icons</a> library
            {lock.revision && <> at <a target="_blank" rel="noreferrer" href={`https://github.com/fos-icons/fos-icons/commit/${lock.revision}`}><code>{lock.revision.slice(0, 7)}</code></a></>}.
            Counts, categories, names, and aliases come from its manifest.
          </p>
        </Section>
      </article>
    </div>
  );
}
