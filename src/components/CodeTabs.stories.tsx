import type { Meta, StoryObj } from '@storybook/react-vite';
import { CodeBlock } from './CodeBlock';
import { CodeTabs, CopyCode } from './LandingParts';

const REACT = "import { AgentRegular } from '@fos-icons/react';\n\nexport function Example() {\n  return <AgentRegular size={24} />;\n}";
const VUE = "<script setup>\nimport { AgentRegular } from '@fos-icons/vue';\n</script>\n\n<template>\n  <AgentRegular :size=\"24\" />\n</template>";
const SVELTE = "<script lang=\"ts\">\nimport { AgentRegular } from '@fos-icons/svelte';\n</script>\n\n<AgentRegular size={24} />";
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.25" d="M8 4h8a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Z"/></svg>';

/**
 * Code with syntax colors. `CodeTabs` puts snippets that do the same job in
 * one block with a tab each (the last tab picked is remembered); `CopyCode`
 * adds a Copy button; `wrap` suits one-line markup such as SVG.
 */
const meta = {
  title: 'Content/Code',
  component: CodeTabs,
  args: {
    label: 'Framework',
    tabs: [
      { id: 'react', label: 'React', code: REACT, lang: 'tsx' },
      { id: 'vue', label: 'Vue', code: VUE, lang: 'vue' },
      { id: 'svelte', label: 'Svelte', code: SVELTE, lang: 'svelte' },
    ],
  },
  decorators: [(Story) => <div className="max-w-3xl"><Story /></div>],
} satisfies Meta<typeof CodeTabs>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Tabs: Story = {};
export const WithCopy: Story = { render: () => <CopyCode code={REACT} lang="tsx" what="React" /> };
export const WrappedSvg: Story = { render: () => <CopyCode code={SVG} lang="svg" what="SVG" wrap /> };
export const Terminal: Story = { render: () => <CodeBlock code="pnpm add @fos-icons/react" lang="sh" /> };
