import { describe, expect, it } from 'vitest';
import { angularSnippet, componentName, reactSnippet, svelteSnippet, vueSnippet } from '../src/lib/react-snippet';

describe('React snippet', () => {
  it('follows the package naming rule', () => {
    expect(componentName('fuel-pump', 'regular')).toBe('FuelPumpRegular');
    expect(componentName('camera', 'filled')).toBe('CameraFilled');
    expect(componentName('4k', 'duotone')).toBe('Icon4kDuotone');
  });

  it('uses documented props only', () => {
    expect(reactSnippet('camera', 'regular', { size: 24, color: null })).toBe(
      "import { CameraRegular } from '@fos-icons/react';\n\n<CameraRegular />",
    );
    const duo = reactSnippet('user-add', 'duocolor', { size: 32, color: null, primary: '#111111', secondary: '#222222', modifier: '#333333' });
    expect(duo).toContain('<UserAddDuocolor size={32} primaryColor="#111111" secondaryColor="#222222" modifierColor="#333333" />');
    expect(reactSnippet('camera', 'duotone', { size: 24, color: null, primary: '#111111', secondary: '#222222' })).not.toContain('secondaryColor');
  });

  it('writes the same props for Vue, in kebab-case', () => {
    expect(vueSnippet('camera', 'regular', { size: 24, color: null })).toBe(
      "<script setup>\nimport { CameraRegular } from '@fos-icons/vue';\n</script>\n\n<template>\n  <CameraRegular />\n</template>",
    );
    const duo = vueSnippet('user-add', 'duocolor', { size: 32, color: null, primary: '#111111', secondary: '#222222', modifier: '#333333' });
    expect(duo).toContain('<UserAddDuocolor :size="32" primary-color="#111111" secondary-color="#222222" modifier-color="#333333" />');
  });

  it('writes a complete Svelte component with camelCase props and numeric expressions', () => {
    expect(svelteSnippet('camera', 'regular', { size: 24, color: null })).toBe(
      '<script lang="ts">\nimport { CameraRegular } from \'@fos-icons/svelte\';\n</script>\n\n<CameraRegular />',
    );
    expect(svelteSnippet('user-add', 'duocolor', {
      size: 32, color: null, primary: '#111111', secondary: '#222222', modifier: '#333333',
    })).toContain('<UserAddDuocolor size={32} primaryColor="#111111" secondaryColor="#222222" modifierColor="#333333" />');
    expect(svelteSnippet('camera', 'regular', { size: 16, color: '#123456' }))
      .toContain('<CameraRegular size={16} color="#123456" />');
    expect(svelteSnippet('camera', 'duotone', { size: 24, color: null, primary: '#111111', secondary: '#222222' }))
      .not.toContain('secondaryColor');
  });

  it.each(['regular', 'filled', 'duocolor', 'duotone'] as const)('uses the %s component in Svelte', (style) => {
    const component = componentName('triangle-right', style);
    const code = svelteSnippet('triangle-right', style, { size: 24, color: null });
    expect(code).toContain(`import { ${component} } from '@fos-icons/svelte';`);
    expect(code).toContain(`<${component} />`);
    expect(code).not.toContain('<template>');
    expect(code).not.toContain('setup');
  });
});

describe('Angular snippet', () => {
  it('imports the standalone component and binds numeric inputs on the native SVG', () => {
    const code = angularSnippet('user-add', 'duocolor', {
      size: 32, color: null, primary: '#111111', secondary: '#222222', modifier: '#333333',
    });
    expect(code).toContain("import { UserAddDuocolor } from '@fos-icons/angular';");
    expect(code).toContain('imports: [UserAddDuocolor]');
    expect(code).toContain('<svg fos-user-add-duocolor [size]="32" primaryColor="#111111" secondaryColor="#222222" modifierColor="#333333"></svg>');
  });

  it('uses the canonical selector for Solid and omits the default size', () => {
    const code = angularSnippet('pie-clock', 'filled', { size: 24, color: null });
    expect(code).toContain('PieClockFilled');
    expect(code).toContain('<svg fos-pie-clock-filled></svg>');
  });
});
