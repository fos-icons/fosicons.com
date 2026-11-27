import { createContext, useContext } from 'react';

/** The header and workspace share this width even when the inspector opens. */
export const SITE_FRAME = 'mx-auto w-full max-w-[1280px]';
export const CONTAINER = `${SITE_FRAME} px-4 sm:px-6`;

/** Shared sidebar width and gutter align the docs search with the article. */
export const DOCS_GRID = 'md:[--docs-nav-width:11rem] md:gap-x-12';

/** The layout's full-height slot beside the main column, for a page's side pane. */
export const PaneHostContext = createContext<HTMLElement | null>(null);
export const usePaneHost = () => useContext(PaneHostContext);

/** A slot in the site header (md and up) between the logo and the actions, for a page's own controls. */
export const HeaderSlotContext = createContext<HTMLElement | null>(null);
export const useHeaderSlot = () => useContext(HeaderSlotContext);
