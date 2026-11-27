import { LocalizedError } from '../i18n/errors';
/** Browser export helpers. Each rejects with a user-presentable message. */

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser time to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const svgBlob = (svg: string) => new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });

/**
 * Rasterize a standalone SVG to a transparent PNG. `pixels` is the output
 * edge length; the SVG is drawn at that size rather than scaled from a bitmap.
 */
export async function svgToPng(svg: string, pixels: number): Promise<Blob> {
  return svgToImage(svg, pixels, 'image/png');
}

/** Rasterize to a JPG. JPG has no transparency, so the icon sits on white. */
export async function svgToJpg(svg: string, pixels: number): Promise<Blob> {
  return svgToImage(svg, pixels, 'image/jpeg', '#FFFFFF');
}

export async function svgToWebp(svg: string, pixels: number): Promise<Blob> {
  return svgToImage(svg, pixels, 'image/webp');
}

async function svgToImage(svg: string, pixels: number, type: 'image/png' | 'image/jpeg' | 'image/webp', background?: string): Promise<Blob> {
  const url = URL.createObjectURL(svgBlob(svg));
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode().catch(() => {
      throw new LocalizedError('error.render');
    });
    const canvas = document.createElement('canvas');
    canvas.width = pixels;
    canvas.height = pixels;
    const context = canvas.getContext('2d');
    if (!context) throw new LocalizedError('error.canvas');
    context.clearRect(0, 0, pixels, pixels);
    if (background) {
      context.fillStyle = background;
      context.fillRect(0, 0, pixels, pixels);
    }
    context.drawImage(image, 0, 0, pixels, pixels);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        // Browsers can return PNG when the requested encoder is unavailable.
        if (type === 'image/webp' && blob?.type !== type) {
          reject(new LocalizedError('error.webp'));
        } else if (blob) {
          resolve(blob);
        } else {
          reject(new LocalizedError('error.png'));
        }
      }, type, 0.92);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function copyText(text: string) {
  if (!navigator.clipboard?.writeText) {
    throw new LocalizedError('error.clipboardUnavailable');
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    throw new LocalizedError('error.clipboardBlocked');
  }
}

/** Copy a PNG to the clipboard. The promise form keeps Safari's user-gesture. */
export async function copyPng(png: Promise<Blob>) {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
    throw new LocalizedError('error.imageCopyUnsupported');
  }
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
  } catch (error) {
    if (error instanceof Error && /render|encod|canvas/i.test(error.message)) throw error;
    throw new LocalizedError('error.imageCopyBlocked');
  }
}
