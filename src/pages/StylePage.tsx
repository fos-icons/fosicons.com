import { useId, type ReactNode } from 'react';
import { Breadcrumbs, CodeTabs, Glyph, LandingSection, useStyleVars } from '../components/LandingParts';
import { IconCardContent, iconCardClass, iconCardGlyphClass } from '../components/IconCard';
import { ButtonLink, Chip, UiIcon } from '../components/ui';
import { LocalLink, useI18n } from '../i18n';
import { useArtwork } from '../lib/artwork';
import { catalogMeta as catalog, ICONS_ROUNDED, STYLE_META, type StyleId } from '../lib/catalog-meta';
import { categoryPath, iconPath, POPULAR_ICONS, STYLE_PATHS } from '../lib/icon-pages';
import { CONTAINER } from '../lib/layout';
import { componentName } from '../lib/react-snippet';

/**
 * Landing pages for each style: /regular-icons, /filled-icons,
 * /duocolor-icons, /duotone-icons. They show real artwork in that style and
 * say plainly where it is free. `?style=` on the catalog stays the filter;
 * these are the pages search engines index. Long-form English, like Docs.
 */

const code = (text: string) => <code className="rounded bg-sunken px-1 py-0.5 text-ink">{text}</code>;
const FREE_STYLE = catalog.styles[0];
const POPULAR_NAMES = POPULAR_ICONS.map((icon) => icon.name);
/** The icon the code samples and the style switcher draw. */
const SAMPLE = POPULAR_NAMES.includes('camera') ? 'camera' : POPULAR_NAMES[0];

const browseHref = (style: StyleId) => (style === FREE_STYLE ? '/' : `/?style=${STYLE_META[style].slug}`);
const iconHref = (name: string, style: StyleId) =>
  (style === FREE_STYLE ? iconPath(name) : `${iconPath(name)}?style=${STYLE_META[style].slug}`);

interface StyleCopy {
  lead: (count: string) => ReactNode;
  points: ReactNode[];
  /** Extra props in the code samples. */
  react: string;
  vue: string;
}

const COPY: Record<StyleId, StyleCopy> = {
  regular: {
    lead: (count) => <>{count} line icons drawn with 1.25px strokes on a 24px grid. Regular is the default style: it inherits {code('currentColor')}, sits quietly next to text, and is free to copy and download here.</>,
    points: [
      <>One stroke weight across the set, with rounded joins and caps, so icons from different categories sit together.</>,
      <>Change the stroke width and size on the site before you copy or download; other optical sizes are drawn for 16, 32, 48, and 64px.</>,
      <>Copy SVG, PNG, or framework code from any icon page, or download every Regular icon as a ZIP.</>,
      <>Use Regular for navigation, toolbars, and body text; switch to Filled for selected or active states.</>,
    ],
    react: 'size={24}',
    vue: ':size="24"',
  },
  filled: {
    lead: (count) => <>{count} filled icons: silhouettes with transparent cutouts, matched shape for shape to Regular. Filled reads well at small sizes and marks what is selected or active.</>,
    points: [
      <>Inner details are real cutouts, not white shapes, so Filled icons work on any background, including images and dark mode.</>,
      <>Every Filled icon has a Regular twin with the same name. Pair them for tab bars and toggles: Regular at rest, Filled when active.</>,
      <>One color that inherits {code('currentColor')}, like Regular.</>,
      <>Component names end in {code('Filled')}: {code('camera')} becomes {code(componentName('camera', 'filled'))}.</>,
    ],
    react: 'size={24}',
    vue: ':size="24"',
  },
  duocolor: {
    lead: (count) => <>{count} duocolor icons in two colors: the primary color draws the structure and the secondary color picks out the details. Set each color yourself, or keep the default brand pair.</>,
    points: [
      <>Each part of an icon is assigned to the primary or the secondary color by hand, so the accent always lands on what matters.</>,
      <>Pass {code('primaryColor')} and {code('secondaryColor')} to the React and Vue components, or set the {code('--fos-primary')} and {code('--fos-secondary')} CSS variables.</>,
      <>Good for feature lists, empty states, and onboarding, where icons are larger and carry some color.</>,
      <>Light and dark themes have their own default pair, so the icons stay legible on either.</>,
    ],
    react: 'size={32} primaryColor="#245B9E" secondaryColor="#60A5FA"',
    vue: ':size="32" primary-color="#245B9E" secondary-color="#60A5FA"',
  },
  duotone: {
    lead: (count) => <>{count} duotone icons: Regular line work over a 16% tint of the same color inside each shape. They keep the weight of line icons with a little more presence.</>,
    points: [
      <>The tint follows the line color by default, so a single color still gives a two-tone icon.</>,
      <>Set {code('primaryColor')} and {code('secondaryColor')} separately when the fill should be a different hue.</>,
      <>Shapes match Regular exactly, so you can mix the two in one interface without a jump in weight.</>,
      <>Good for cards, dashboards, and larger sizes, where a flat line icon can look thin.</>,
    ],
    react: 'size={32}',
    vue: ':size="32"',
  },
};

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

/** The popular icons drawn in this style, each linking to its icon page in that style. */
function StyleGrid({ style }: { style: StyleId }) {
  const id = useId();
  const art = useArtwork(style, POPULAR_NAMES);
  return (
    <ul className="icon-card-grid" style={useStyleVars(style)}>
      {POPULAR_ICONS.map((icon) => (
        <li key={icon.name}>
          <LocalLink to={iconHref(icon.name, style)} aria-label={icon.name} className={iconCardClass()}>
            <IconCardContent name={icon.name}>
              <Glyph svg={art[icon.name]} idPrefix={`${id}-${icon.name}-`} className={iconCardGlyphClass} />
            </IconCardContent>
          </LocalLink>
        </li>
      ))}
    </ul>
  );
}

/** Links to the other style pages, each showing the sample icon in its style. */
function OtherStyles({ current }: { current: StyleId }) {
  const { t } = useI18n();
  return (
    <ul className="grid gap-3 sm:grid-cols-3">
      {catalog.styles.filter((s) => s !== current).map((style) => <StyleLink key={style} style={style} label={t(`style.${style}`)} />)}
    </ul>
  );
}

function StyleLink({ style, label }: { style: StyleId; label: string }) {
  const id = useId();
  const art = useArtwork(style, [SAMPLE]);
  return (
    <li>
      <LocalLink
        to={STYLE_PATHS[style]}
        className="flex items-center gap-4 rounded-xl border border-line bg-surface p-4 transition hover:bg-sunken"
        style={useStyleVars(style)}
      >
        <Glyph svg={art[SAMPLE]} idPrefix={`${id}-`} className="size-8 shrink-0" />
        <span>
          <span className="block font-medium text-ink">{label} icons</span>
          <span className="block text-sm text-muted">{STYLE_META[style].description}</span>
        </span>
      </LocalLink>
    </li>
  );
}

export default function StylePage({ style }: { style: StyleId }) {
  const { t, n } = useI18n();
  const label = t(`style.${style}`);
  const count = `${n(ICONS_ROUNDED)}+`;
  const copy = COPY[style];
  const free = style === FREE_STYLE;
  const name = componentName(SAMPLE, style);

  return (
    <div className={`${CONTAINER} pb-24 pt-8 sm:pt-10`}>
      <Breadcrumbs items={[{ label: t('iconPage.allIcons'), to: '/' }, { label: `${label} icons` }]} />
      <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
        {free ? `Free ${label} icons` : `${label} icons`}
      </h1>
      <p className="mt-4 max-w-2xl text-base text-muted sm:text-lg">{copy.lead(count)}</p>
      <div className="mt-6 flex flex-wrap gap-2">
        <ButtonLink to={browseHref(style)} variant="primary" size="lg" icon="search">Browse {label} icons</ButtonLink>
        <ButtonLink to="/docs#styles" size="lg">About the styles</ButtonLink>
      </div>

      <LandingSection id="popular" title={`Popular ${label} icons`} className="mt-12">
        <StyleGrid style={style} />
      </LandingSection>

      <LandingSection id="details" title={`About ${label}`} className="mt-12">
        <Points items={copy.points} />
      </LandingSection>

      <LandingSection id="usage" title="Use them in code" className="code-stone mt-12">
        <p className="mb-4 max-w-2xl text-sm leading-relaxed text-muted">
          The {code('@fos-icons/react')} and {code('@fos-icons/vue')} packages include every style, {catalog.license} licensed.
          Each icon is its own tree-shakeable component.
        </p>
        <CodeTabs
          label="Framework"
          tabs={[
            { id: 'react', label: 'React', lang: 'tsx', code: `import { ${name} } from '@fos-icons/react';\n\n<${name} ${copy.react} />` },
            { id: 'vue', label: 'Vue', lang: 'vue', code: `<script setup lang="ts">\nimport { ${name} } from '@fos-icons/vue';\n</script>\n\n<template>\n  <${name} ${copy.vue} />\n</template>` },
          ]}
        />
      </LandingSection>

      <LandingSection id="availability" title="Where it's free" className="mt-12">
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          {free ? (
            <>Regular is free everywhere: copy SVG, PNG, and code from this site, download the full set as a ZIP, or install the packages.</>
          ) : (
            <>{label} is free in the {code('@fos-icons/react')} and {code('@fos-icons/vue')} packages and the Figma library. On this site you can browse
              and preview every {label} icon; copying and downloading {label} files from the site comes with <LocalLink to="/pricing" className="text-brand underline underline-offset-2">Pro</LocalLink>.</>
          )}
        </p>
      </LandingSection>

      <LandingSection id="styles" title="Other styles" className="mt-12">
        <OtherStyles current={style} />
      </LandingSection>

      <LandingSection id="categories" title="Browse by category" className="mt-12">
        <ul className="flex flex-wrap gap-2">
          {catalog.categories.map((c) => (
            <li key={c.name}>
              <Chip to={categoryPath(c.name)} count={n(c.count)}>{c.name}</Chip>
            </li>
          ))}
        </ul>
      </LandingSection>
    </div>
  );
}
