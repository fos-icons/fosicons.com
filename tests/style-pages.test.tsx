import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ToastProvider } from '../src/components/ui';
import { primeArtwork } from '../src/lib/artwork';
import { ThemeProvider } from '../src/lib/theme';
import { catalog, type StyleId } from '../src/lib/catalog';
import { POPULAR_ICONS, STYLE_PATHS } from '../src/lib/icon-pages';
import { PAGES, pageFor, structuredData } from '../src/lib/seo';
import StylePage from '../src/pages/StylePage';
import { styleSvgs } from './helpers';

beforeAll(() => {
  primeArtwork(Object.fromEntries(catalog.styles.map((style) => [style, styleSvgs(style)])));
});
afterEach(cleanup);

const renderPage = (style: StyleId) =>
  render(<ThemeProvider><ToastProvider><MemoryRouter><StylePage style={style} /></MemoryRouter></ToastProvider></ThemeProvider>);

describe('Style landing pages', () => {
  it('gives each style its own path and metadata that fits search results', () => {
    expect(STYLE_PATHS).toEqual({
      regular: '/regular-icons', filled: '/filled-icons', duocolor: '/duocolor-icons', duotone: '/duotone-icons',
    });
    const titles = new Set<string>();
    const descriptions = new Set<string>();
    for (const style of catalog.styles) {
      const page = pageFor(`${STYLE_PATHS[style]}/`);
      expect(page.id).toBe(`style-${style}`);
      expect(page.path).toBe(STYLE_PATHS[style]);
      expect(page.title.length).toBeLessThanOrEqual(60);
      expect(page.description.length).toBeLessThanOrEqual(160);
      titles.add(page.title);
      descriptions.add(page.description);
      expect(JSON.stringify(structuredData(page))).toContain('"CollectionPage"');
    }
    expect(titles.size).toBe(catalog.styles.length);
    expect(descriptions.size).toBe(catalog.styles.length);
    expect(PAGES['style-filled'].title).toMatch(/^Filled Icons/);
    // The catalog filter stays a query string that canonicalizes to home.
    expect(pageFor('/', '?style=solid').id).toBe('home');
  });

  it('draws the popular icons in the page style and links each to its icon page in that style', () => {
    renderPage('filled');
    expect(screen.getByRole('heading', { level: 1, name: 'Filled icons' })).toBeTruthy();
    const grid = within(screen.getByRole('region', { name: 'Popular Filled icons' }));
    const links = grid.getAllByRole('link');
    expect(links).toHaveLength(POPULAR_ICONS.length);
    const first = POPULAR_ICONS[0].name;
    expect(links[0].getAttribute('href')).toBe(`/icons/${first}?style=filled`);
    // Inline Filled artwork, not the Regular preview image.
    expect(links[0].querySelector('img')).toBeNull();
    expect(links[0].querySelector('svg')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Browse Filled icons/ }).getAttribute('href')).toBe('/?style=filled');
  });

  it('shows code with the style suffix and says honestly where the style is free', () => {
    renderPage('filled');
    const usage = screen.getByRole('region', { name: 'Use them in code' });
    expect(usage.classList.contains('code-stone')).toBe(true);
    expect(within(usage).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['React', 'Vue']);
    expect(usage.textContent).toMatch(/CameraFilled/);
    const availability = screen.getByRole('region', { name: "Where it's free" });
    expect(availability.textContent).toMatch(/free in the @fos-icons\/react and @fos-icons\/vue packages/);
    expect(within(availability).getByRole('link', { name: 'Pro' }).getAttribute('href')).toBe('/pricing');
    cleanup();

    renderPage('regular');
    expect(screen.getByRole('heading', { level: 1, name: 'Free Regular icons' })).toBeTruthy();
    expect(screen.getByRole('region', { name: "Where it's free" }).textContent).toMatch(/Regular is free everywhere/);
    expect(screen.getAllByRole('link').some((a) => a.getAttribute('href') === `/icons/${POPULAR_ICONS[0].name}`)).toBe(true);
  });

  it('links to the other three styles', () => {
    renderPage('duotone');
    const others = within(screen.getByRole('region', { name: 'Other styles' }));
    expect(others.getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/regular-icons', '/filled-icons', '/duocolor-icons']);
  });
});
