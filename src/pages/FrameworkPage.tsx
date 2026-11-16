import type { ReactNode } from 'react';
import {
  Breadcrumbs, CopyCode, IconLinkGrid, LandingSection, primaryButton, secondaryButton,
} from '../components/LandingParts';
import { UiIcon } from '../components/ui';
import { LocalLink, useI18n } from '../i18n';
import { catalog, ICONS_ROUNDED } from '../lib/catalog';
import { categoryPath, POPULAR_ICONS, type FrameworkId } from '../lib/icon-pages';
import { CONTAINER } from '../lib/layout';
import { FIGMA_URL } from '../lib/links';
import { NPM_REACT_URL, NPM_VUE_URL } from '../lib/seo';

/**
 * Landing pages for "React icons", "Vue icons", and "Figma icons": what the
 * library is in that tool, how to start, and links into every icon. Long-form
 * English, like the Docs page.
 */

const external = (href: string, children: ReactNode) => (
  <a href={href} target="_blank" rel="noreferrer" className="text-brand underline underline-offset-2">{children}</a>
);

function Lead({ children }: { children: ReactNode }) {
  return <p className="mt-4 max-w-2xl text-base text-muted sm:text-lg">{children}</p>;
}

function Points({ items }: { items: ReactNode[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 rounded-xl border border-line bg-surface p-4 text-sm leading-relaxed">
          <UiIcon name="check" className="mt-0.5 size-4 shrink-0 text-brand" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

const code = (text: string) => <code className="rounded bg-sunken px-1 py-0.5 text-ink">{text}</code>;

export default function FrameworkPage({ framework }: { framework: FrameworkId }) {
  const { t, list, n } = useI18n();
  const count = `${n(ICONS_ROUNDED)}+`;
  const styles = list(catalog.styles.map((s) => t(`style.${s}`)));
  const title = { react: 'React icons', vue: 'Vue icons', figma: 'Figma icons' }[framework];

  let body: ReactNode;
  if (framework === 'react') {
    body = (<>
      <Lead>
        {code('@fos-icons/react')} gives you {count} free, open-source SVG icons as React components, in {styles}.
        Each icon is its own tree-shakeable component, typed for TypeScript, and works with React 18 and 19,
        Next.js, Vite, and server rendering.
      </Lead>
      <Actions npm={NPM_REACT_URL} docs="/docs#react" />
      <LandingSection id="install" title="Install" className="mt-12">
        <CopyCode code={'npm install @fos-icons/react'} lang="sh" what="Install command" />
      </LandingSection>
      <LandingSection id="usage" title="Usage" className="mt-10">
        <CopyCode
          lang="tsx"
          what="React example"
          code={`import { CameraRegular, CameraDuocolor } from '@fos-icons/react';

export function Toolbar() {
  return (
    <>
      <CameraRegular size={24} />
      <CameraDuocolor size={32} primaryColor="#245B9E" secondaryColor="#60A5FA" />
    </>
  );
}`}
        />
        <div className="mt-6">
          <Points items={[
            <>Component names are the icon name in PascalCase plus a style: {code('fuel-pump')} becomes {code('FuelPumpRegular')}, {code('FuelPumpFilled')}, {code('FuelPumpDuocolor')}, or {code('FuelPumpDuotone')}.</>,
            <>{code('size')} sets width and height (default 24). Regular and Solid inherit {code('currentColor')}, so they follow your text color.</>,
            <>Duocolor and Duotone take {code('primaryColor')} and {code('secondaryColor')} for two-tone designs.</>,
            <>Icons are hidden from screen readers by default; pass {code('title')} or {code('aria-label')} when an icon carries meaning.</>,
          ]} />
        </div>
      </LandingSection>
    </>);
  } else if (framework === 'vue') {
    body = (<>
      <Lead>
        {code('@fos-icons/vue')} gives you {count} free, open-source SVG icons as Vue 3 components, in {styles}.
        Components are plain render functions: tree-shakeable, typed for TypeScript and SFC templates, ready for
        Nuxt and server rendering, with no build plugin.
      </Lead>
      <Actions npm={NPM_VUE_URL} docs="/docs#vue" />
      <LandingSection id="install" title="Install" className="mt-12">
        <CopyCode code={'npm install @fos-icons/vue'} lang="sh" what="Install command" />
      </LandingSection>
      <LandingSection id="usage" title="Usage" className="mt-10">
        <CopyCode
          lang="vue"
          what="Vue example"
          code={`<script setup lang="ts">
import { CameraRegular, CameraDuocolor } from '@fos-icons/vue';
</script>

<template>
  <CameraRegular :size="24" />
  <CameraDuocolor :size="32" primary-color="#245B9E" secondary-color="#60A5FA" />
</template>`}
        />
        <div className="mt-6">
          <Points items={[
            <>Names match {code('@fos-icons/react')}: {code('fuel-pump')} becomes {code('FuelPumpRegular')}, {code('FuelPumpFilled')}, {code('FuelPumpDuocolor')}, or {code('FuelPumpDuotone')}.</>,
            <>Supports Vue 3.3 and later, with ESM and CommonJS builds; Vue itself is not bundled.</>,
            <>Render functions and JSX work too: {code("h(CameraRegular, { size: 32, title: 'Camera' })")}.</>,
            <>Regular and Solid inherit {code('currentColor')}; give icon-only buttons an {code('aria-label')}.</>,
          ]} />
        </div>
      </LandingSection>
    </>);
  } else {
    body = (<>
      <Lead>
        The Fos Icons Figma library holds all {count} icons as components, with a {code('Style')} variant for {styles}.
        Swap styles from the properties panel, recolor with variables for light and dark themes, and add modifiers
        such as badges and status dots.
      </Lead>
      <div className="mt-6 flex flex-wrap gap-2">
        {FIGMA_URL && (
          <a href={FIGMA_URL} target="_blank" rel="noreferrer" className={primaryButton}>
            Open the Figma library <UiIcon name="link-external" className="size-4" />
            <span className="sr-only">{t('site.newTab')}</span>
          </a>
        )}
        <LocalLink to="/docs#figma" className={secondaryButton}>Figma docs</LocalLink>
      </div>
      <LandingSection id="start" title="Get started" className="mt-12">
        <Points items={[
          <>Open the library{FIGMA_URL ? <> ({external(FIGMA_URL, 'Figma')})</> : null} and duplicate it, or publish it as a team library.</>,
          <>Insert any icon from the Assets panel; switch {code('Style')} between Regular, Filled, Duocolor, and Duotone without replacing the instance.</>,
          <>Every icon is drawn on a 24px grid with 1.25px strokes and real transparent cutouts, so it matches the React and Vue packages exactly.</>,
          <>Need a single file instead? Download SVG or PNG from any icon page here and drop it into Figma; colors are already resolved.</>,
        ]} />
      </LandingSection>
    </>);
  }

  return (
    <div className={`${CONTAINER} pb-24 pt-8 sm:pt-10`}>
      <Breadcrumbs items={[{ label: t('iconPage.allIcons'), to: '/' }, { label: title }]} />
      <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
        Free {title.replace(' icons', '')} icons
      </h1>
      {body}
      <LandingSection id="popular" title="Popular icons" className="mt-12">
        <IconLinkGrid icons={POPULAR_ICONS} />
      </LandingSection>
      <LandingSection id="categories" title="Browse by category" className="mt-12">
        <ul className="flex flex-wrap gap-2">
          {catalog.categories.map((c) => (
            <li key={c.name}>
              <LocalLink to={categoryPath(c.name)} className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-sm text-ink transition hover:border-brand hover:bg-brand-soft">
                {c.name} <span className="text-xs tabular-nums text-faint">{n(c.count)}</span>
              </LocalLink>
            </li>
          ))}
        </ul>
      </LandingSection>
      <LandingSection id="license" title="License" className="mt-12">
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Fos Icons is {catalog.license} licensed: free for personal and commercial projects. Keep the license notice when you
          redistribute the files. <LocalLink to="/docs#licensing" className="text-brand underline underline-offset-2">Licensing details</LocalLink>.
        </p>
      </LandingSection>
    </div>
  );
}

function Actions({ npm, docs }: { npm: string; docs: string }) {
  const { t } = useI18n();
  return (
    <div className="mt-6 flex flex-wrap gap-2">
      <LocalLink to="/" className={primaryButton}>
        <UiIcon name="search" className="size-4" /> Browse all icons
      </LocalLink>
      <LocalLink to={docs} className={secondaryButton}>Docs</LocalLink>
      <a href={npm} target="_blank" rel="noreferrer" className={secondaryButton}>
        npm <UiIcon name="link-external" className="size-4" />
        <span className="sr-only">{t('site.newTab')}</span>
      </a>
    </div>
  );
}
