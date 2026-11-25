# MCP server

Fos Icons runs a public, read-only [MCP](https://modelcontextprotocol.io) server
so AI agents can find icons and write correct code for them instead of guessing
names or drawing SVG paths.

- **URL:** `https://www.fosicons.com/mcp` (Streamable HTTP, JSON responses)
- **Auth:** none. Nothing is stored and no user data is read.
- **Code:** [`api/mcp.ts`](../api/mcp.ts) (HTTP), [`server/mcp/server.ts`](../server/mcp/server.ts)
  (tools and agent instructions), [`server/mcp/icons.ts`](../server/mcp/icons.ts) (lookups over
  the synchronized catalog). `vercel.json` rewrites `/mcp` to the function.
- **Tests:** [`tests/mcp.test.ts`](../tests/mcp.test.ts)

The server is stateless: each POST builds a fresh server, answers, and exits.
GET and DELETE return 405, which Streamable HTTP clients accept for stateless servers.

## Tools

All are annotated read-only.

| Tool | Does |
| --- | --- |
| `search_icons` | Up to 20 queries per call, over names, tags, aliases and categories. Suggestions when nothing matches. |
| `get_icon_code` | Install, import and usage code for one icon in React, Vue, Svelte, SolidJS, Angular, Flutter, or plain SVG. |
| `check_icon_names` | Validates names (canonical, component, or Flutter constant) and suggests real icons for invalid ones. |
| `list_icons` | Alphabetical pages, optionally by category, plus category counts. |
| `get_framework_setup` | Package install steps, naming rule, props, example, and accessibility guidance. |

## Paid styles

Every style's **code** is returned, since the packages are MIT and ship all four
styles. **Raw SVG** is returned for Regular only, matching the public
`/svg/regular/<name>.svg` files. Other styles point to the library repository,
the packages, or the website export.

## Rate limiting

Add a Vercel Firewall rate-limit rule (Project → Firewall → Rules):
path equals `/mcp`, 300 requests per 60 seconds per IP, action **Too Many Requests (429)**.
It's not in code, so it doesn't count against function invocations.

## Logs

Each tool call logs one JSON line, `{"mcp": {...}}`, with the tool name and
framework. Searches that match nothing log their query text (first 60 characters)
under `misses`, which shows which icons people look for and don't find.

## Testing locally

```sh
pnpm run dev
```

The dev server serves `/mcp` too. Connect a client:

```sh
claude mcp add --transport http fos-icons-dev http://localhost:5173/mcp
```

Or open the MCP Inspector (`npx @modelcontextprotocol/inspector`) and connect
to `http://localhost:5173/mcp` with the Streamable HTTP transport.
