import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { handleMcp } from '../api/mcp';
import { ToastProvider } from '../src/components/ui';
import AiAgentsPage, { AGENT_TOOLS, CURSOR_INSTALL, MCP_URL, VSCODE_INSTALL } from '../src/pages/AiAgentsPage';
import { pageFor } from '../src/lib/seo';

afterEach(cleanup);

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
});
