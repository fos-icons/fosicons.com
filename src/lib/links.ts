/** Outbound links used across the site. */
export const LIBRARY_URL = 'https://github.com/fos-icons/fos-icons';

export const FRAMEWORK_PACKAGES = {
  react: { label: 'React', name: '@fos-icons/react' },
  vue: { label: 'Vue', name: '@fos-icons/vue' },
  svelte: { label: 'Svelte', name: '@fos-icons/svelte' },
  solid: { label: 'SolidJS', name: '@fos-icons/solid' },
  angular: { label: 'Angular', name: '@fos-icons/angular' },
} as const;

export const FRAMEWORK_NAMES = Object.values(FRAMEWORK_PACKAGES).map(({ label }) => label);
export const PLATFORM_NAMES = [...FRAMEWORK_NAMES, 'Figma'];
export const packageSource = (id: keyof typeof FRAMEWORK_PACKAGES) => `${LIBRARY_URL}/tree/main/packages/${id}`;

/** The Figma file behind the header's Figma link. Set to '' to hide the button. */
export const FIGMA_URL: string = 'https://www.figma.com/design/5zcUV9E4Bu8FSssDfhyOWw/Fos-Icons?node-id=0-1';

/** Where the header's Feedback link files a report. */
export const FEEDBACK_URL = 'https://github.com/fos-icons/fosicons.com/issues/new';

/** The Fos Icons npm organization page. */
export const NPM_URL = 'https://www.npmjs.com/org/fos-icons';
