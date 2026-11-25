/**
 * The /ai-agents setup cards, in page order. The header's MCP menu links to
 * each one, so this lives outside the lazily loaded page.
 */
export const AGENT_CLIENTS = [
  { id: 'claude-code', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' },
  { id: 'chatgpt', label: 'ChatGPT' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'vscode', label: 'VS Code' },
  { id: 'other', label: 'Any MCP client' },
  { id: 'skills', label: 'Agent Skills' },
] as const;
