import { describe, expect, it } from 'vitest';
import { catalog, iconsByName } from '../src/lib/catalog';
import { parseState, serializeState, type UrlStateConfig } from '../src/lib/url-state';

const config: UrlStateConfig = {
  styles: catalog.styles,
  core: { categories: [...catalog.categories.map((c) => c.name), 'Brands'], icons: new Set([...iconsByName.keys(), 'acme']) },
  brands: { categories: [], icons: new Set(['acme']) },
};

describe('URL state', () => {
  it('round-trips search, category, style, and icon', () => {
    const state = { q: 'arrow up', category: 'Navigation', style: 'filled' as const, brandStyle: 'regular' as const, icon: 'arrow-up', modifier: null, corner: null };
    const url = serializeState(state, config);
    expect(url).toContain('style=solid');
    expect(parseState(url, config)).toEqual(state);
  });

  it('omits defaults', () => {
    expect(serializeState({ q: '', category: null, style: 'regular', brandStyle: 'regular', icon: null, modifier: null, corner: null }, config)).toBe('');
  });

  it('discards values the catalog cannot honor', () => {
    expect(parseState('?style=neon&category=Nope&icon=not-real&q=x', config)).toEqual({
      q: 'x', category: null, style: 'regular', brandStyle: 'regular', icon: null, modifier: null, corner: null,
    });
  });

  it('clears the retired Time & weather filter while preserving the search and selected icon', () => {
    const state = parseState('?category=Time+%26+weather&q=cloud&style=duotone&icon=cloud', config);
    expect(state).toMatchObject({ category: null, q: 'cloud', style: 'duotone', icon: 'cloud' });
    expect(serializeState(state, config)).toBe('?q=cloud&style=duotone&icon=cloud');
    for (const category of ['Time & calendar', 'Weather']) {
      expect(parseState(new URLSearchParams({ category }).toString(), config).category).toBe(category);
    }
  });

  it('opens old Brands-tab links in the Brands category of the one catalog', () => {
    expect(parseState('?style=brands', config)).toMatchObject({ style: 'regular', category: 'Brands' });
    expect(parseState('?style=brands&icon=acme', config).icon).toBe('acme');
    // Brand marks never take modifiers.
    expect(parseState('?icon=acme&modifier=sparkle', config).modifier).toBeNull();
  });

  it('keeps a modifier and corner only alongside a core icon', () => {
    const state = { q: '', category: null, style: 'regular' as const, brandStyle: 'regular' as const, icon: 'clock', modifier: 'sparkle', corner: 'top-right' as const };
    const url = serializeState(state, config);
    expect(url).toBe('?icon=clock&modifier=sparkle&corner=top-right');
    expect(parseState(url, config)).toEqual(state);
    expect(parseState('?modifier=sparkle', config).modifier).toBeNull();
    expect(parseState('?icon=clock&modifier=sparkle&corner=middle', config)).toMatchObject({ modifier: 'sparkle', corner: null });
    expect(parseState('?icon=clock&modifier=%3Cscript%3E', config).modifier).toBeNull();
  });
});
