import { afterEach, describe, expect, it, vi } from 'vitest';
import { submitFeedback as POST } from '../api/feedback';

const origin = 'https://www.fosicons.com';
const request = (payload: unknown, sender = origin) => new Request(`${origin}/api/feedback`, {
  method: 'POST',
  headers: { Origin: sender, 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('feedback delivery', () => {
  it('creates a GitHub issue for a new icon request', async () => {
    vi.stubEnv('FEEDBACK_GITHUB_TOKEN', 'test-token');
    const send = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', send);
    const response = await POST(request({ type: 'new-icon', description: 'Desk lamp\nWith an adjustable arm.' }));
    expect(response.status).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
    const [url, init] = send.mock.calls[0];
    expect(url).toBe('https://api.github.com/repos/fos-icons/fos-icons/issues');
    expect(JSON.parse(String(init?.body))).toEqual({
      title: 'Icon request: Desk lamp With an adjustable arm.',
      body: 'Submitted via fosicons.com.\n\n    Desk lamp\n    With an adjustable arm.',
    });
  });

  it.each(['site', 'package', 'icon'])('emails %s reports privately', async (type) => {
    vi.stubEnv('FEEDBACK_RESEND_API_KEY', 'test-key');
    vi.stubEnv('FEEDBACK_FROM_EMAIL', 'feedback@fosicons.com');
    const send = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', send);
    expect((await POST(request({ type, description: 'Can you check this?' }))).status).toBe(200);
    const [url, init] = send.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(JSON.parse(String(init?.body))).toMatchObject({ to: ['icon@fosicons.com'], text: 'Can you check this?' });
  });

  it('rejects invalid, automated, and cross-origin submissions before delivery', async () => {
    const send = vi.fn();
    vi.stubGlobal('fetch', send);
    const valid = { type: 'new-icon', description: 'Desk lamp' };
    expect((await POST(request(valid, 'https://example.com'))).status).toBe(403);
    expect((await POST(request({ ...valid, type: 'constructor' }))).status).toBe(400);
    expect((await POST(request({ ...valid, description: ' ' }))).status).toBe(400);
    expect((await POST(request({ ...valid, website: 'spam' }))).status).toBe(400);
    expect((await POST(request({ ...valid, description: 'x'.repeat(17000) }))).status).toBe(413);
    expect(send).not.toHaveBeenCalled();
  });

  it('reports unconfigured delivery without calling a provider', async () => {
    vi.stubEnv('FEEDBACK_GITHUB_TOKEN', undefined);
    const send = vi.fn();
    vi.stubGlobal('fetch', send);
    const response = await POST(request({ type: 'new-icon', description: 'Desk lamp' }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false });
    expect(send).not.toHaveBeenCalled();
  });
});
