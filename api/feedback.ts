import { FEEDBACK_MAX_LENGTH, FEEDBACK_TYPES, isFeedbackType } from '../src/lib/feedback';

const MAX_BODY_BYTES = 16 * 1024;

function reply(status: number) {
  return Response.json({ ok: status === 200 }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return reply(403);
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
  const { type, description, website } = payload as Record<string, unknown>;
  if (website) return reply(400);
  if (!isFeedbackType(type) || typeof description !== 'string' || description.length > FEEDBACK_MAX_LENGTH || !description.trim()) {
    return reply(400);
  }

  const message = description.trim();
  const newIcon = type === 'new-icon';
  const token = newIcon ? process.env.FEEDBACK_GITHUB_TOKEN : process.env.FEEDBACK_RESEND_API_KEY;
  const from = process.env.FEEDBACK_FROM_EMAIL;
  if (!token || (!newIcon && !from)) return reply(503);

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
