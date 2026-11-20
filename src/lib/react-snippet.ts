import type { StyleId } from './catalog';
import { isDuo } from './svg';

/** Mirrors the Fos Icons package naming rule. */
export function componentName(name: string, style: StyleId): string {
  const pascal = name.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join('');
  return `${/^\d/.test(pascal) ? 'Icon' : ''}${pascal}${style[0].toUpperCase()}${style.slice(1)}`;
}

export interface SnippetOptions {
  size: number;
  /** Regular/Solid color, or `null` to inherit `currentColor`. */
  color: string | null;
  primary?: string;
  secondary?: string;
  modifier?: string;
}

/** The props a usage example sets, in order: [camelCase name, value, numeric?]. Only documented props. */
function snippetProps(style: StyleId, options: SnippetOptions): [string, string | number][] {
  const props: [string, string | number][] = [];
  if (options.size !== 24) props.push(['size', options.size]);
  if (isDuo(style)) {
    if (options.primary) props.push(['primaryColor', options.primary]);
    if (options.secondary && style === 'duocolor') props.push(['secondaryColor', options.secondary]);
  } else if (options.color) {
    props.push(['color', options.color]);
  }
  if (options.modifier) props.push(['modifierColor', options.modifier]);
  return props;
}

function componentAttributes(style: StyleId, options: SnippetOptions): string {
  return snippetProps(style, options)
    .map(([k, v]) => (typeof v === 'number' ? ` ${k}={${v}}` : ` ${k}="${v}"`))
    .join('');
}

/** React usage example (@fos-icons/react). */
export function reactSnippet(name: string, style: StyleId, options: SnippetOptions): string {
  const component = componentName(name, style);
  const attrs = componentAttributes(style, options);
  return `import { ${component} } from '@fos-icons/react';\n\n<${component}${attrs} />`;
}

/** Solid 2 usage example (@fos-icons/solid). */
export function solidSnippet(name: string, style: StyleId, options: SnippetOptions): string {
  const component = componentName(name, style);
  return `import { ${component} } from '@fos-icons/solid';\n\n<${component}${componentAttributes(style, options)} />`;
}

/** Svelte usage example (@fos-icons/svelte), using the same camelCase props. */
export function svelteSnippet(name: string, style: StyleId, options: SnippetOptions): string {
  const component = componentName(name, style);
  return `<script lang="ts">\nimport { ${component} } from '@fos-icons/svelte';\n</script>\n\n<${component}${componentAttributes(style, options)} />`;
}

/** Angular usage example with a standalone component and a native SVG host. */
export function angularSnippet(name: string, style: StyleId, options: SnippetOptions): string {
  const component = componentName(name, style);
  const attrs = snippetProps(style, options)
    .map(([key, value]) => typeof value === 'number' ? ` [${key}]="${value}"` : ` ${key}="${value}"`)
    .join('');
  return `import { Component } from '@angular/core';
import { ${component} } from '@fos-icons/angular';

@Component({
  selector: 'app-icon-example',
  imports: [${component}],
  template: '<svg fos-${name}-${style}${attrs}></svg>',
})
export class IconExample {}`;
}

/** Vue usage example (@fos-icons/vue): the same props, in kebab-case. */
export function vueSnippet(name: string, style: StyleId, options: SnippetOptions): string {
  const component = componentName(name, style);
  const kebab = (k: string) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  const attrs = snippetProps(style, options)
    .map(([k, v]) => (typeof v === 'number' ? ` :${kebab(k)}="${v}"` : ` ${kebab(k)}="${v}"`))
    .join('');
  return `<script setup>\nimport { ${component} } from '@fos-icons/vue';\n</script>\n\n<template>\n  <${component}${attrs} />\n</template>`;
}
