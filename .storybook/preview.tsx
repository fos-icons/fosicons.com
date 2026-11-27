import type { Decorator, Preview } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router';
import { ToastProvider } from '../src/components/ui';
import { I18nProvider } from '../src/i18n';
import { ThemeProvider } from '../src/lib/theme';
import '../src/styles/index.css';

// The site turns on motion and skips its page-load fade once React has rendered; do the same here.
document.documentElement.setAttribute('data-hydrated', '');
document.documentElement.setAttribute('data-motion', '');

/**
 * Every story renders inside the site's real providers: a router (links work
 * without leaving the story), English messages, the theme, and toasts.
 * The toolbar's Theme switch sets the site's own stored preference.
 */
const withSite: Decorator = (Story, context) => {
  const theme = context.globals.theme as 'light' | 'dark';
  try { localStorage.setItem('fos-theme', theme); } catch { /* falls back to the system theme */ }
  return (
    <MemoryRouter>
      <I18nProvider locale="en">
        <ThemeProvider key={theme}>
          <ToastProvider>
            <div className="bg-canvas p-6 text-ink">
              <Story />
            </div>
          </ToastProvider>
        </ThemeProvider>
      </I18nProvider>
    </MemoryRouter>
  );
};

const preview: Preview = {
  decorators: [withSite],
  globalTypes: {
    theme: {
      description: 'Site theme',
      toolbar: { title: 'Theme', icon: 'mirror', items: ['light', 'dark'], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: 'light' },
  parameters: {
    layout: 'fullscreen',
    controls: { expanded: true },
  },
};

export default preview;
