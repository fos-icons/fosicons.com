import { describe, expect, it } from 'vitest';
import animatedArtwork from '../public/icons/animated.json';
import { animatedNames, iconsByName } from '../src/lib/catalog';
import { prepareGridSvg } from '../src/lib/svg';
import { animateSvg, parseParts } from '../server/mcp/animate-core.js';
import regular from '../public/icons/regular.json';

const animated = animatedArtwork as Record<string, string>;

describe('animated icons', () => {
  it('lists real icons, each with artwork', () => {
    expect(animatedNames.size).toBeGreaterThanOrEqual(20);
    for (const name of animatedNames) {
      expect(iconsByName.has(name)).toBe(true);
      expect(animated[name]).toContain(`class="fa-${name}"`);
    }
  });

  it('keeps every class scoped when stroke weights are made live for the grid', () => {
    for (const [name, svg] of Object.entries(animated)) {
      const grid = prepareGridSvg(svg);
      expect(grid).toContain('<style>');
      for (const [, cls] of grid.matchAll(/class="([^"]+)"/g)) expect(cls.startsWith(`fa-${name}`)).toBe(true);
    }
  });

  it('the synced compiler animates any icon', () => {
    const svg = animateSvg('plus', (regular as Record<string, string>).plus, { motions: [{ type: 'spin', parts: [0], deg: 90, hold: 0.4 }] });
    expect(svg).toContain('@keyframes fa-plus-m0');
    expect(parseParts((regular as Record<string, string>).wifi, { split: true })).toHaveLength(4);
  });
});

describe('retimeAnimatedSvg', () => {
  it('divides every duration and delay by the speed, and leaves geometry alone', async () => {
    const { retimeAnimatedSvg } = await import('../src/lib/svg');
    const svg = '<svg><style>.a{animation:x 2.4s ease 0.12s infinite}</style><path d="M1.5 2s"/></svg>';
    expect(retimeAnimatedSvg(svg, 2)).toBe('<svg><style>.a{animation:x 1.2s ease 0.06s infinite}</style><path d="M1.5 2s"/></svg>');
    expect(retimeAnimatedSvg(svg, 1)).toBe(svg);
  });
});

describe('gifTimeline', () => {
  it('loops on the least common multiple of the durations, sampled at 25 fps', async () => {
    const { gifTimeline } = await import('../src/lib/gif');
    expect(gifTimeline([2400])).toEqual({ cycle: 2400, frames: 60, delay: 40 });
    // A clock's 3s minute hand and 36s hour hand meet again at 36s; frames are capped.
    expect(gifTimeline([3000, 36000])).toEqual({ cycle: 36000, frames: 300, delay: 120 });
    // Durations with no short common loop fall back to the longest one.
    expect(gifTimeline([1370, 1930]).cycle).toBe(1930);
  });
});
