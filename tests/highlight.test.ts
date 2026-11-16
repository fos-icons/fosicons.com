import { describe, expect, it } from 'vitest';
import { highlight } from '../src/lib/highlight';

const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');

describe('highlight', () => {
  it('colors TSX without changing the text', () => {
    const code = `import { CameraRegular } from '@fos-icons/react';\n\n<CameraRegular size={24} />`;
    const html = highlight(code, 'tsx')!;
    expect(html).toContain('<span class="hljs-keyword">import</span>');
    expect(text(html)).toBe(code);
  });

  it('marks the command word on each terminal line', () => {
    const html = highlight('git clone x\nnpm ci', 'sh')!;
    expect(html).toContain('<span class="hljs-title function_">git</span>');
    expect(html).toContain('<span class="hljs-title function_">npm</span>');
  });

  it('highlights Svelte without changing the copyable component text', () => {
    const code = '<script lang="ts">\nimport { CameraRegular } from \'@fos-icons/svelte\';\n</script>\n\n<CameraRegular size={32} />';
    const html = highlight(code, 'svelte')!;
    expect(html).toContain('hljs-tag');
    expect(html).not.toContain('<script');
    expect(text(html)).toBe(code);
  });

  it('escapes markup and returns null for unknown languages', () => {
    expect(highlight('<svg onload="x">', 'html')).not.toContain('<svg');
    expect(highlight('x', 'cobol')).toBeNull();
  });
});
