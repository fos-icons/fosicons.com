import { describe, expect, it } from 'vitest';
import { componentName, reactSnippet, vueSnippet } from '../src/lib/react-snippet';

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
});
