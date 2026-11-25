/**
 * Fos Icons MCP server: https://www.fosicons.com/mcp (rewritten here by vercel.json).
 *
 * Streamable HTTP, stateless and read-only: every POST builds a fresh server,
 * answers with JSON, and keeps nothing. No sign-in. Per-IP rate limiting is a
 * Vercel Firewall rule on /mcp (see docs/MCP.md), not code.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createServer, type ToolLogger } from '../server/mcp/server.js';

export const MCP_PATH = '/mcp';
const MAX_BODY_BYTES = 64 * 1024;

/** Browser-based clients (MCP Inspector, web agents) call cross-origin; nothing here is credentialed. */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id, Mcp-Protocol-Version',
  'Access-Control-Max-Age': '86400',
};

const productionLog: ToolLogger = (event) => console.log(JSON.stringify({ mcp: event }));

function withHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS)) headers.set(key, value);
  headers.set('Cache-Control', 'no-store');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function jsonRpcError(status: number, message: string): Response {
  return withHeaders(Response.json({ jsonrpc: '2.0', error: { code: -32000, message }, id: null }, { status }));
}

export async function handleMcp(request: Request, log: ToolLogger = productionLog): Promise<Response> {
  if (request.method === 'OPTIONS') return withHeaders(new Response(null, { status: 204 }));
  if (request.method !== 'POST') {
    // Stateless: no server-initiated stream (GET) and no session to end (DELETE).
    const response = jsonRpcError(405, 'Method not allowed. Send JSON-RPC requests with POST.');
    response.headers.set('Allow', 'POST, OPTIONS');
    return response;
  }
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > MAX_BODY_BYTES) return jsonRpcError(413, 'Request body too large.');

  const server = createServer(log);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  try {
    await server.connect(transport);
    return withHeaders(await transport.handleRequest(request));
  } catch (error) {
    console.error('MCP request failed', error);
    return jsonRpcError(500, 'Internal server error.');
  } finally {
    void transport.close();
    void server.close();
  }
}

/** Node entry point shared by the Vercel function and the Vite dev server. */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const scheme = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(', '));
  }
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS';
  const request = new Request(`${scheme}://${req.headers.host}${MCP_PATH}`, {
    method: req.method,
    headers,
    ...(hasBody ? { body: Readable.toWeb(req) as ReadableStream<Uint8Array>, duplex: 'half' as const } : {}),
  });
  const response = await handleMcp(request);
  res.writeHead(response.status, Object.fromEntries(response.headers)).end(Buffer.from(await response.arrayBuffer()));
}
