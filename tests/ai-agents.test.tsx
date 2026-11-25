import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleMcp } from '../api/mcp';
import { ToastProvider } from '../src/components/ui';
import AiAgentsPage, { AGENT_TOOLS, CURSOR_INSTALL, MCP_URL, PAGE_SECTIONS, VSCODE_INSTALL } from '../src/pages/AiAgentsPage';
import { pageFor } from '../src/lib/seo';

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

const renderPage = () => render(<ToastProvider><MemoryRouter><AiAgentsPage /></MemoryRouter></ToastProvider>);

describe('AI agents page', () => {
  it('is a routed page with metadata that fits search results', () => {
    const page = pageFor('/ai-agents');
    expect(page.id).toBe('ai-agents');
    expect(page.title.length).toBeLessThanOrEqual(60);
    expect(page.description.length).toBeLessThanOrEqual(160);
  });

  it('builds one-click installs that decode to the production server', () => {
    const cursor = new URL(CURSOR_INSTALL);
    expect(cursor.protocol).toBe('cursor:');
    expect(cursor.searchParams.get('name')).toBe('fos-icons');
    expect(JSON.parse(atob(cursor.searchParams.get('config')!))).toEqual({ url: MCP_URL });
    expect(VSCODE_INSTALL.startsWith('vscode:mcp/install?')).toBe(true);
    expect(JSON.parse(decodeURIComponent(VSCODE_INSTALL.split('?')[1]))).toEqual({ name: 'fos-icons', type: 'http', url: MCP_URL });
    expect(MCP_URL).toBe('https://www.fosicons.com/mcp');
  });

  it('shows a card for each client and links the install buttons', () => {
    renderPage();
    for (const name of ['Claude Code', 'Codex', 'ChatGPT', 'Cursor', 'VS Code', 'Any MCP client', 'Agent Skills', 'Cursor rule']) {
      expect(screen.getByRole('region', { name })).toBeTruthy();
    }
    expect(screen.getByRole('link', { name: 'Add to Cursor' }).getAttribute('href')).toBe(CURSOR_INSTALL);
    expect(screen.getByRole('link', { name: 'Add to VS Code' }).getAttribute('href')).toBe(VSCODE_INSTALL);
    const claude = within(screen.getByRole('region', { name: 'Claude Code' }));
    expect(claude.getByText(/\/plugin install fos-icons@fos-icons/)).toBeTruthy();
  });

  it('documents exactly the tools the server registers', async () => {
    const response = await handleMcp(new Request(`${MCP_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'Mcp-Protocol-Version': '2025-06-18' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    }), () => {});
    const { result } = await response.json() as { result: { tools: { name: string }[] } };
    expect(AGENT_TOOLS.map(([name]) => name).sort()).toEqual(result.tools.map((t) => t.name).sort());
  });
  it('opens and closes the questions as an accordion', async () => {
    renderPage();
    const question = screen.getByText('Is it free?');
    const details = question.closest('details')!;
    expect(details.open).toBe(false);
    question.click();
    expect(details.open).toBe(true);
  });
});

describe('AI agents page navigation', () => {
  it('uses the docs code palette for its snippets', () => {
    renderPage();
    const blocks = document.querySelectorAll('.code-block');
    expect(blocks.length).toBeGreaterThan(0);
    expect([...blocks].every((block) => block.closest('.code-stone'))).toBe(true);
  });

  it('lists every section in the on-this-page nav and scrolls smoothly to one', () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    renderPage();
    const nav = within(screen.getByRole('navigation', { name: 'On this page' }));
    for (const { id, label } of PAGE_SECTIONS) {
      expect(nav.getByRole('link', { name: label }).getAttribute('href')).toBe(`#${id}`);
      expect(document.getElementById(id)).not.toBeNull();
    }
    fireEvent.click(nav.getByRole('link', { name: 'Cursor' }));
    expect(scroll).toHaveBeenLastCalledWith({ behavior: 'smooth' });
    expect(nav.getByRole('link', { name: 'Cursor' }).getAttribute('aria-current')).toBe('location');
  });

  it('says when an editor did not open and points to the manual steps', () => {
    vi.useFakeTimers();
    renderPage();
    const button = screen.getByRole('link', { name: 'Add to VS Code' });
    button.addEventListener('click', (event) => event.preventDefault()); // jsdom can't follow vscode: links
    fireEvent.click(button);
    act(() => { vi.advanceTimersByTime(1600); });
    const status = document.getElementById('install-status')!;
    expect(status.textContent).toMatch(/VS Code didn’t open/);
    expect(within(status).getByRole('link', { name: 'add the server by hand' }).getAttribute('href')).toBe('#vscode');
  });

  it('stays quiet when the editor takes focus', () => {
    vi.useFakeTimers();
    renderPage();
    const button = screen.getByRole('link', { name: 'Add to Cursor' });
    button.addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(button);
    fireEvent.blur(window);
    act(() => { vi.advanceTimersByTime(1600); });
    expect(document.getElementById('install-status')!.textContent).toBe('');
  });
});
