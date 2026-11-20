import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '../src/components/ui';
import DocsPage from '../src/pages/DocsPage';

afterEach(cleanup);

describe('Docs page', () => {
  it('lists the sections in the order they appear in the article', async () => {
    const user = userEvent.setup();
    render(<ToastProvider><MemoryRouter><DocsPage /></MemoryRouter></ToastProvider>);
    const nav = within(screen.getByRole('navigation', { name: 'Documentation' }));
    await user.click(nav.getByRole('button', { name: 'On this page' }));
    for (const name of ['Design', 'Code', 'Reference']) {
      await user.click(nav.getByRole('button', { name }));
    }
    const links = nav.getAllByRole('link').map((link) => link.getAttribute('href'));
    const sections = within(screen.getByRole('article')).getAllByRole('region').map((section) => `#${section.id}`);
    expect(links).toEqual(sections);
  });

  it('marks the current section in the side nav', async () => {
    render(<ToastProvider><MemoryRouter><DocsPage /></MemoryRouter></ToastProvider>);
    const nav = screen.getByRole('navigation', { name: 'Documentation' });
    // jsdom has no layout, so only the click path is testable here.
    await userEvent.click(within(nav).getByRole('button', { name: 'Design' }));
    await userEvent.click(within(nav).getByRole('link', { name: 'Sizes' }));
    expect(within(nav).getByRole('link', { name: 'Sizes' }).getAttribute('aria-current')).toBe('location');
    expect(nav.querySelectorAll('[aria-current]')).toHaveLength(1);
  });

  it('renders code samples in dark, labeled blocks', () => {
    render(<ToastProvider><MemoryRouter><DocsPage /></MemoryRouter></ToastProvider>);
    const blocks = document.querySelectorAll('.code-block');
    expect(blocks.length).toBeGreaterThan(0);
    const shell = document.querySelector('#react .code-block[data-lang="sh"]')?.textContent;
    expect(shell).toMatch(/^Terminal/);
    expect(shell).toContain('npm install @fos-icons/react');
    expect(shell).toContain('pnpm add @fos-icons/react');
  });

  it('documents what the site stores in a Privacy section', async () => {
    render(<ToastProvider><MemoryRouter><DocsPage /></MemoryRouter></ToastProvider>);
    const nav = screen.getByRole('navigation', { name: 'Documentation' });
    await userEvent.click(within(nav).getByRole('button', { name: 'Reference' }));
    expect(within(nav).getByRole('link', { name: 'Privacy' }).getAttribute('href')).toBe('#privacy');
    const section = document.getElementById('privacy')!;
    expect(section.textContent).toMatch(/no cookies/);
    expect(section.textContent).toContain('fos-theme');
    expect(section.textContent).toContain('fos-pane-collapsed');
    expect(section.textContent).toContain('fos-pane-width');
  });

  it('documents Svelte setup and copies a complete Svelte example', async () => {
    const user = userEvent.setup();
    render(<ToastProvider><MemoryRouter><DocsPage /></MemoryRouter></ToastProvider>);
    const nav = screen.getByRole('navigation', { name: 'Documentation' });
    const group = within(nav).getByRole('button', { name: 'Code' });
    expect(group.getAttribute('aria-expanded')).toBe('false');
    expect(within(nav).queryByRole('link', { name: 'Svelte' })).toBeNull();
    await user.click(group);
    expect(within(nav).getByRole('link', { name: 'Svelte' }).getAttribute('href')).toBe('#svelte');
    await user.click(group);
    expect(within(nav).queryByRole('link', { name: 'Svelte' })).toBeNull();
    const section = document.getElementById('svelte')!;
    expect(section.textContent).toContain('Svelte 5.20');
    expect(section.textContent).toContain('Not yet published to npm');
    expect(section.textContent).toContain('one shared Svelte renderer');
    expect(within(section).getByRole('link', { name: 'packages/svelte' }).getAttribute('href'))
      .toBe('https://github.com/fos-icons/fos-icons/tree/main/packages/svelte');
    const block = section.querySelector('.code-block[data-lang="svelte"]')!;
    expect(block.textContent).toMatch(/^Svelte/);
    const code = block.querySelector('code')!.textContent;
    expect(code).toContain('<script lang="ts">');
    expect(code).toContain("from '@fos-icons/svelte'");
    expect(code).toContain('<CameraDuocolor size={32} primaryColor="#245B9E" secondaryColor="#60A5FA" />');
    await user.click(within(block as HTMLElement).getByRole('button', { name: 'Copy' }));
    expect(await navigator.clipboard.readText()).toBe(code);
  });

  it('documents Solid 2 setup and copies its TSX example', async () => {
    const user = userEvent.setup();
    render(<ToastProvider><MemoryRouter><DocsPage /></MemoryRouter></ToastProvider>);
    const nav = screen.getByRole('navigation', { name: 'Documentation' });
    await user.click(within(nav).getByRole('button', { name: 'Code' }));
    expect(within(nav).getByRole('link', { name: 'SolidJS' }).getAttribute('href')).toBe('#solid');
    const section = document.getElementById('solid')!;
    expect(section.textContent).toContain('@solidjs/web@2.0.0-rc.21');
    expect(section.textContent).toContain('Solid 1.x is not supported');
    expect(section.textContent).toContain('npm pack');
    expect(within(section).getByRole('link', { name: 'packages/solid' }).getAttribute('href'))
      .toBe('https://github.com/fos-icons/fos-icons/tree/main/packages/solid');
    const block = section.querySelector<HTMLElement>('.code-block[data-lang="tsx"]')!;
    const code = block.querySelector('code')!.textContent;
    expect(code).toContain("import { TelescopeDuocolor } from '@fos-icons/solid';");
    expect(section.textContent).toContain("import TelescopeRegular from '@fos-icons/solid/regular/telescope';");
    await user.click(within(block).getByRole('button', { name: 'Copy' }));
    expect(await navigator.clipboard.readText()).toBe(code);
  });

  it('lists Angular in the sidebar and copies a standalone example', async () => {
    const user = userEvent.setup();
    render(<ToastProvider><MemoryRouter><DocsPage /></MemoryRouter></ToastProvider>);
    const nav = screen.getByRole('navigation', { name: 'Documentation' });
    await user.click(within(nav).getByRole('button', { name: 'Code' }));
    expect(within(nav).getByRole('link', { name: 'Angular' }).getAttribute('href')).toBe('#angular');
    const section = document.getElementById('angular')!;
    expect(section.textContent).toContain('npm pack');
    expect(within(section).getByRole('link', { name: 'packages/angular' }).getAttribute('href'))
      .toBe('https://github.com/fos-icons/fos-icons/tree/main/packages/angular');
    const block = section.querySelector<HTMLElement>('.code-block[data-lang="ts"]')!;
    const code = block.querySelector('code')!.textContent;
    expect(code).toContain('imports: [CameraDuocolor]');
    expect(code).toContain('<svg fos-camera-duocolor [size]="32"');
    await user.click(within(block).getByRole('button', { name: 'Copy' }));
    expect(await navigator.clipboard.readText()).toBe(code);
  });

  it('filters sections and the side nav with the search box', async () => {
    render(<ToastProvider><MemoryRouter><DocsPage /></MemoryRouter></ToastProvider>);
    const nav = screen.getByRole('navigation', { name: 'Documentation' });
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search the docs' }), 'fos-theme');
    expect(document.getElementById('privacy')!.hidden).toBe(false);
    expect(document.getElementById('react')!.hidden).toBe(true);
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual(['Privacy']);
    expect(screen.getByText('1 section matches').getAttribute('role')).toBe('status');
  });

  it('needs every word to match, and offers to clear when nothing does', async () => {
    render(<ToastProvider><MemoryRouter><DocsPage /></MemoryRouter></ToastProvider>);
    const box = screen.getByRole('searchbox', { name: 'Search the docs' });
    await userEvent.type(box, 'figma zzqx');
    expect(document.querySelectorAll('section:not([hidden])')).toHaveLength(0);
    // "Copy" button labels are not searchable content.
    await userEvent.clear(box);
    await userEvent.type(box, 'copy');
    expect(document.getElementById('colors')!.hidden).toBe(true);
    await userEvent.clear(box);
    await userEvent.type(box, 'zzqx');
    await userEvent.click(screen.getAllByRole('button', { name: 'Clear search' }).at(-1)!);
    expect(box).toHaveProperty('value', '');
    expect(document.querySelectorAll('section[hidden]')).toHaveLength(0);
  });
});
