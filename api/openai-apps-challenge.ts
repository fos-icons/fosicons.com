/**
 * OpenAI plugin domain verification: https://www.fosicons.com/.well-known/openai-apps-challenge
 * (rewritten here by vercel.json). Returns the token from the OpenAI Platform
 * dashboard, as plain text, from the OPENAI_APPS_CHALLENGE environment variable.
 * 404 while it isn't set. See docs/MCP.md.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

export function challengeResponse(token = process.env.OPENAI_APPS_CHALLENGE?.trim()): Response {
  if (!token) return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  return new Response(token, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export default async function handler(_req: IncomingMessage, res: ServerResponse) {
  const response = challengeResponse();
  res.writeHead(response.status, Object.fromEntries(response.headers)).end(await response.text());
}
