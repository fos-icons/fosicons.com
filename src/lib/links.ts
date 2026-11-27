/** Outbound links used across the site. */
export const LIBRARY_URL = 'https://github.com/fos-icons/fos-icons';
/** The GitHub organization: library, packages, plugins, and this site. */
export const ORG_URL = 'https://github.com/fos-icons';

export const FRAMEWORK_PACKAGES = {
  react: { label: 'React', name: '@fos-icons/react' },
  vue: { label: 'Vue', name: '@fos-icons/vue' },
  svelte: { label: 'Svelte', name: '@fos-icons/svelte' },
  solid: { label: 'Solid', name: '@fos-icons/solid' },
  angular: { label: 'Angular', name: '@fos-icons/angular' },
} as const;

/** The Flutter package, from the same monorepo (not on npm). */
export const FLUTTER_PACKAGE = { label: 'Flutter', name: 'fos_icons' } as const;

/** Frameworks with a Fos Icons package. */
export const FRAMEWORK_NAMES = [...Object.values(FRAMEWORK_PACKAGES).map(({ label }) => label), FLUTTER_PACKAGE.label];
/** Everywhere the icons can be used, for page descriptions. */
export const PLATFORM_NAMES = [...FRAMEWORK_NAMES, 'Figma'];
export const packageSource = (id: keyof typeof FRAMEWORK_PACKAGES | 'flutter') => `${LIBRARY_URL}/tree/main/packages/${id}`;

/** The Figma file behind the header's Figma link. Set to '' to hide the button. */
export const FIGMA_URL: string = 'https://www.figma.com/design/5zcUV9E4Bu8FSssDfhyOWw/Fos-Icons?node-id=0-1';

/** The Fos Icons npm organization page. */
export const NPM_URL = 'https://www.npmjs.com/org/fos-icons';
export const X_URL = 'https://x.com/fosicons';
