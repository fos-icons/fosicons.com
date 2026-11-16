import type { StorybookConfig } from '@storybook/react-vite';

/** The component catalog. Stories sit next to their components as *.stories.tsx. */
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  framework: { name: '@storybook/react-vite', options: {} },
  // The site's own vite.config.ts (React, Tailwind, the dev SVG server) is picked up as is.
};

export default config;
