import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { FEEDBACK_MAX_LENGTH, FEEDBACK_PATH, FEEDBACK_TURNSTILE_ACTION, FEEDBACK_TYPES, isFeedbackType } from '../src/lib/feedback.js';

const MAX_BODY_BYTES = 16 * 1024;

function reply(status: number) {
  return Response.json({ ok: status === 200 }, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function verifyTurnstile(secret: string, token: unknown, hostname: string) {
  if (typeof token !== 'string' || !token || token.length > 2048) return 422;

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret, response: token }),
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return 503;
    const result = await response.json();
    if (!result || typeof result !== 'object' || !('success' in result)) return 503;
    if ('error-codes' in result && Array.isArray(result['error-codes']) && result['error-codes'].includes('internal-error')) return 503;
    if (result.success !== true) return 422;
    return 'hostname' in result && result.hostname === hostname && 'action' in result && result.action === FEEDBACK_TURNSTILE_ACTION ? 200 : 422;
  } catch {
    return 503;
  }
}

export async function submitFeedback(request: Request, requireTurnstile = true) {
  const { origin, hostname } = new URL(request.url);
  if (request.headers.get('origin') !== origin) return reply(403);
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return reply(415);

  const reader = request.body?.getReader();
  if (!reader) return reply(400);
  const decoder = new TextDecoder();
  let input = '';
  let bytes = 0;
  let payload: unknown;
  try {
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      bytes += chunk.value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel();
        return reply(413);
      }
      input += decoder.decode(chunk.value, { stream: true });
    }
    payload = JSON.parse(input + decoder.decode());
  } catch {
    return reply(400);
  }

  if (!payload || typeof payload !== 'object') return reply(400);
  const { type, description, website, turnstileToken } = payload as Record<string, unknown>;
  if (website) return reply(400);
  if (!isFeedbackType(type) || typeof description !== 'string' || description.length > FEEDBACK_MAX_LENGTH || !description.trim()) {
    return reply(400);
  }

  const message = description.trim();
  const newIcon = type === 'new-icon';
  const token = newIcon ? process.env.FEEDBACK_GITHUB_TOKEN : process.env.FEEDBACK_RESEND_API_KEY;
  const from = process.env.FEEDBACK_FROM_EMAIL;
  if (!token || (!newIcon && !from)) return reply(503);

  const turnstileSecret = process.env.FEEDBACK_TURNSTILE_SECRET;
  if (turnstileSecret) {
    const verification = await verifyTurnstile(turnstileSecret, turnstileToken, hostname);
    if (verification !== 200) return reply(verification);
  } else if (requireTurnstile) {
    return reply(503);
  }

  const endpoint = newIcon ? 'https://api.github.com/repos/fos-icons/fos-icons/issues' : 'https://api.resend.com/emails';
  const body = newIcon ? {
    title: `Icon request: ${message.replace(/\s+/g, ' ').replaceAll('@', '＠').slice(0, 80)}`,
    // Render the submission as literal text so it cannot inject links, mentions, or Markdown.
    body: `Submitted via fosicons.com.\n\n${message.split(/\r\n?|\n/).map((line) => `    ${line}`).join('\n')}`,
  } : {
    from,
    to: ['icon@fosicons.com'],
    subject: `Fos Icons feedback: ${FEEDBACK_TYPES[type]}`,
    text: message,
  };

  try {
    const result = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(newIcon ? { Accept: 'application/vnd.github+json', 'User-Agent': 'fosicons.com' } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (result.ok) return reply(200);
    console.error('Feedback delivery rejected', type, result.status);
  } catch {
    console.error('Feedback delivery failed', type);
  }
  return reply(502);
}

/** Node entry point shared by the Vercel function and the Vite dev server. */
export default async function handleFeedback(req: IncomingMessage, res: ServerResponse) {
  await handleFeedbackRequest(req, res, true);
}

export async function handleFeedbackRequest(req: IncomingMessage, res: ServerResponse, requireTurnstile: boolean) {
  if (req.method !== 'POST') {
    res.writeHead(405, { Allow: 'POST', 'Cache-Control': 'no-store' }).end();
    return;
  }

  // Vercel terminates TLS before handing the request to the Node function.
  const scheme = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  const options = {
    method: 'POST',
    headers: {
      Origin: req.headers.origin ?? '',
      'Content-Type': req.headers['content-type'] ?? '',
    },
    body: Readable.toWeb(req) as ReadableStream<Uint8Array>,
    duplex: 'half' as const, // Node requires duplex when Request receives a stream.
  };
  const request = new Request(`${scheme}://${req.headers.host}${FEEDBACK_PATH}`, options);
  const response = await submitFeedback(request, requireTurnstile);
  res.writeHead(response.status, Object.fromEntries(response.headers)).end(await response.text());
}
