import { LocalizedError } from '../i18n/errors';
import { svgBlob } from './export';

/** GIF has on/off transparency only, so a solid background gives smoother edges. */
export const GIF_BACKGROUNDS = ['transparent', 'white', 'black'] as const;
export type GifBackground = (typeof GIF_BACKGROUNDS)[number];
const FILL: Record<Exclude<GifBackground, 'transparent'>, string> = { white: '#FFFFFF', black: '#000000' };

const MAX_FRAMES = 300;
const FRAME_MS = 40; // 25 fps
const MAX_CYCLE_MS = 40_000;

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/**
 * How long one seamless loop of all the animations lasts, and how to sample it.
 * The loop is the least common multiple of the durations (a clock's 3s minute
 * hand and 36s hour hand loop together at 36s), capped; frames are spread
 * evenly over it, at most `MAX_FRAMES`.
 */
export function gifTimeline(durationsMs: readonly number[]): { cycle: number; frames: number; delay: number } {
  const steps = durationsMs.filter((d) => d > 0).map((d) => Math.max(1, Math.round(d / 10)));
  let cycle = steps.reduce((acc, d) => (acc * d) / gcd(acc, d), 1) * 10;
  if (!steps.length) cycle = FRAME_MS;
  else if (cycle > MAX_CYCLE_MS) cycle = Math.max(...steps) * 10;
  const frames = Math.max(1, Math.min(MAX_FRAMES, Math.round(cycle / FRAME_MS)));
  return { cycle, frames, delay: cycle / frames };
}

async function rasterize(svg: string, px: number, context: CanvasRenderingContext2D, background: GifBackground) {
  const url = URL.createObjectURL(svgBlob(svg));
  try {
    const image = new Image();
    image.src = url;
    await image.decode().catch(() => { throw new LocalizedError('error.render'); });
    context.clearRect(0, 0, px, px);
    if (background !== 'transparent') {
      context.fillStyle = FILL[background];
      context.fillRect(0, 0, px, px);
    }
    context.drawImage(image, 0, 0, px, px);
    return context.getImageData(0, 0, px, px).data;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Bake an animated SVG (CSS keyframes inside its <style>) into a looping GIF.
 * The SVG is mounted off-screen, its animations are paused and stepped through
 * the loop, and each step's computed transform, opacity and dash offset is
 * frozen into a static copy that is rasterized and encoded.
 */
export async function svgToGif(svg: string, px: number, background: GifBackground = 'transparent'): Promise<Blob> {
  // Loaded only when a GIF is made. The browser gets gifenc's ES build (named
  // exports; its default is GIFEncoder alone); Node gets CommonJS, whose
  // functions sit on the default export.
  const gifenc = await import('gifenc');
  const { applyPalette, GIFEncoder, quantize } = typeof gifenc.GIFEncoder === 'function' ? gifenc : gifenc.default;
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;pointer-events:none';
  host.innerHTML = svg;
  document.body.append(host);
  try {
    const root = host.querySelector('svg');
    if (!root) throw new LocalizedError('error.render');
    root.setAttribute('width', String(px));
    root.setAttribute('height', String(px));
    const animations = root.getAnimations({ subtree: true });
    animations.forEach((a) => a.pause());
    const timing = animations.map((a) => a.effect?.getComputedTiming());
    const { cycle, frames, delay } = gifTimeline(timing.map((t) => Number(t?.duration) || 0));
    // Start once every staggered part has begun, on a whole number of loops.
    const lead = Math.max(0, ...timing.map((t) => Number(t?.delay) || 0));
    const start = Math.ceil(lead / cycle) * cycle;

    const elements = [...root.querySelectorAll<SVGElement>('*')];
    const animated = new Set(animations.map((a) => (a.effect as KeyframeEffect | null)?.target).filter(Boolean));
    const canvas = document.createElement('canvas');
    canvas.width = px;
    canvas.height = px;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new LocalizedError('error.canvas');

    const transparent = background === 'transparent';
    const format = transparent ? 'rgba4444' : 'rgb565';
    const gif = GIFEncoder();
    for (let i = 0; i < frames; i += 1) {
      const t = start + i * delay;
      animations.forEach((a) => { a.currentTime = t; });
      const still = root.cloneNode(true) as SVGSVGElement;
      const copies = [...still.querySelectorAll<SVGElement>('*')];
      elements.forEach((el, k) => {
        if (!animated.has(el)) return;
        const cs = getComputedStyle(el);
        copies[k].style.cssText += `;transform:${cs.transform};opacity:${cs.opacity};stroke-dashoffset:${cs.strokeDashoffset}`;
      });
      const style = still.querySelector('style');
      if (style) style.textContent += '*{animation:none!important}';
      const rgba = await rasterize(new XMLSerializer().serializeToString(still), px, context, background);
      const palette = quantize(rgba, 256, { format, oneBitAlpha: transparent });
      const index = applyPalette(rgba, palette, format);
      const transparentIndex = transparent ? Math.max(0, palette.findIndex((c) => c[3] === 0)) : undefined;
      gif.writeFrame(index, px, px, { palette, delay, repeat: 0, transparent, transparentIndex, dispose: transparent ? 2 : -1 });
    }
    gif.finish();
    return new Blob([gif.bytes() as Uint8Array<ArrayBuffer>], { type: 'image/gif' });
  } finally {
    host.remove();
  }
}
