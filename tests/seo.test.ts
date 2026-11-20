import { readFileSync } from 'node:fs';
import { FRAMEWORK_NAMES } from '../src/lib/links';
import { describe, expect, it } from 'vitest';
import catalog from '../src/data/catalog.json';
import { ICONS_ROUNDED } from '../src/lib/catalog';
import { createIndex, suggest } from '../src/lib/search';
import { categoryMeta, headTags, iconMeta, PAGES, pageFor, structuredData } from '../src/lib/seo';
import { categorySlug, relatedIcons } from '../src/lib/icon-pages';
import { scopeIds } from '../src/lib/artwork';

describe('page metadata', () => {
  it('maps every route to its page, with Brands and unknown paths handled', () => {
    expect(pageFor('/').id).toBe('home');
    expect(pageFor('/', '?style=brands').id).toBe('brands');
    expect(pageFor('/docs/').id).toBe('docs');
    expect(pageFor('/pricing').id).toBe('not-found');
    expect(pageFor('/brands').id).toBe('brands');
    expect(pageFor('/nope').id).toBe('not-found');
  });

  it('derives counts from the catalog and keeps titles and descriptions search-friendly', () => {
    expect(PAGES.home.description).toContain(`${new Intl.NumberFormat('en-US').format(ICONS_ROUNDED)}+ free`);
    for (const page of Object.values(PAGES)) {
      expect(page.title.length).toBeLessThanOrEqual(60);
      expect(page.description.length).toBeGreaterThan(50);
      expect(page.description.length).toBeLessThanOrEqual(200);
    }
  });

  it('lists supported frameworks in both the Vite fallback and generated descriptions', () => {
    const html = readFileSync('index.html', 'utf8');
    const fallback = html.match(/<meta name="description" content="([^"]+)"/)![1];
    for (const framework of [...FRAMEWORK_NAMES, 'Flutter']) {
      expect(fallback).toContain(framework);
      expect(PAGES.home.description).toContain(framework);
      expect(PAGES.docs.description).toContain(framework);
      expect(iconMeta('telescope')!.description).toContain(framework);
      expect(categoryMeta('food-drink')!.description).toContain(framework);
    }
  });

  it('writes canonical, Open Graph, Twitter, and JSON-LD tags', () => {
    const tags = headTags(PAGES.docs);
    expect(PAGES.docs.title).toContain('Svelte');
    expect(PAGES.docs.description).toContain('Svelte');
    expect(tags).toContain('<link rel="canonical" href="https://www.fosicons.com/docs" />');
    expect(tags).toContain('<meta property="og:image" content="https://www.fosicons.com/og-image.png" />');
    expect(tags).toContain('<meta name="twitter:card" content="summary_large_image" />');
    const json = JSON.parse(tags.match(/<script type="application\/ld\+json">(.*)<\/script>/)![1]);
    expect(json['@graph'].map((n: { '@type': string }) => n['@type'])).toEqual(['WebSite', 'Organization', 'TechArticle', 'BreadcrumbList']);
  });

  it('keeps the 404 page out of search results', () => {
    const tags = headTags(PAGES['not-found']);
    expect(tags).toContain('content="noindex, follow"');
    expect(tags).not.toContain('rel="canonical"');
    expect(JSON.stringify(structuredData(PAGES['not-found']))).not.toContain('BreadcrumbList');
  });
});

describe('landing pages', () => {
  const icons = catalog.icons as Parameters<typeof relatedIcons>[0][];

  it('routes icon, category, and framework pages, and 404s unknown ones', () => {
    expect(pageFor('/icons/calendar').id).toBe('icon');
    expect(pageFor('/icons/not-an-icon').id).toBe('not-found');
    expect(pageFor('/categories/ai-agents').id).toBe('category');
    expect(pageFor('/categories/nope').id).toBe('not-found');
    expect(pageFor('/react-icons').id).toBe('react');
    expect(pageFor('/vue-icons/').id).toBe('vue');
    expect(pageFor('/figma-icons').id).toBe('figma');
  });

  it('gives every icon and category a title that fits search results and a unique description', () => {
    const descriptions = new Set<string>();
    for (const icon of icons) {
      const page = iconMeta(icon.name)!;
      expect(page.title.length).toBeLessThanOrEqual(60);
      expect(page.description.length).toBeLessThanOrEqual(160);
      descriptions.add(page.description);
    }
    expect(descriptions.size).toBe(icons.length);
    for (const c of catalog.categories) {
      const page = categoryMeta(categorySlug(c.name))!;
      expect(page.title.length).toBeLessThanOrEqual(60);
      expect(page.description.length).toBeLessThanOrEqual(160);
    }
    expect(categoryMeta('food-drink')!.title).toMatch(/^Food & Drink Icons/);
  });

  it('describes an icon page with breadcrumbs and a licensed image', () => {
    const tags = headTags(iconMeta('calendar')!);
    expect(tags).toContain('<link rel="canonical" href="https://www.fosicons.com/icons/calendar" />');
    const json = JSON.parse(tags.match(/<script type="application\/ld\+json">(.*)<\/script>/)![1]);
    const types = json['@graph'].map((n: { '@type': string }) => n['@type']);
    expect(types).toEqual(['WebSite', 'Organization', 'ItemPage', 'BreadcrumbList', 'ImageObject']);
    const crumbs = json['@graph'][3].itemListElement;
    expect(crumbs).toHaveLength(3);
    expect(crumbs[1].item).toMatch(/\/categories\//);
    expect(json['@graph'][4].contentUrl).toBe('https://www.fosicons.com/svg/regular/calendar.svg');
  });

  it('suggests related icons without the icon itself', () => {
    const calendar = icons.find((i) => i.name === 'calendar')!;
    const related = relatedIcons(calendar);
    expect(related.length).toBeGreaterThan(0);
    expect(related.map((i) => i.name)).not.toContain('calendar');
  });

  it('scopes SVG ids and their references', () => {
    const svg = '<svg><mask id="m"><path/></mask><path mask="url(#m)"/><use href="#m"/></svg>';
    expect(scopeIds(svg, 'x-')).toBe('<svg><mask id="x-m"><path/></mask><path mask="url(#x-m)"/><use href="#x-m"/></svg>');
  });
});

describe('suggestions', () => {
  const index = createIndex(catalog.icons as Parameters<typeof createIndex>[0]);
  it('finds icons despite a typo', () => {
    expect(suggest(index, 'calender')[0].name).toBe('calendar');
  });
  it('falls back to icons matching some of the words', () => {
    expect(suggest(index, 'rocket zzzz').map((i) => i.name)).toContain('rocket');
  });
});
