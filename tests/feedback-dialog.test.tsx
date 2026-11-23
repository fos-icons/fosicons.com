import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import FeedbackDialog from '../src/components/FeedbackDialog';

HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.open = true; };

afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it('restores a dismissed draft and clears it only after a successful submission', async () => {
  const user = userEvent.setup();
  const send = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({ ok: false }, { status: 503 }))
    .mockResolvedValueOnce(Response.json({ ok: true }));
  vi.stubGlobal('fetch', send);
  const open = () => render(<FeedbackDialog onClose={() => {}} />);
  const type = () => screen.getByRole<HTMLSelectElement>('combobox', { name: 'Feedback type' });
  const description = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Description' });

  let dialog = open();
  await user.selectOptions(type(), 'package');
  await user.type(description(), 'The install example is outdated.');
  dialog.unmount();

  dialog = open();
  expect(type().value).toBe('package');
  expect(description().value).toBe('The install example is outdated.');
  await user.click(screen.getByRole('button', { name: 'Submit feedback' }));
  await screen.findByRole('alert');
  dialog.unmount();

  dialog = open();
  expect(description().value).toBe('The install example is outdated.');
  await user.click(screen.getByRole('button', { name: 'Submit feedback' }));
  await screen.findByText('Thanks. Your report was sent.');
  dialog.unmount();

  open();
  expect(type().value).toBe('');
  expect(description().value).toBe('');
});

it('starts a fresh verification on retry and preserves the draft after a rate limit', async () => {
  vi.stubEnv('VITE_FEEDBACK_TURNSTILE_SITE_KEY', 'test-site-key');
  const tokens = ['first-token', 'fresh-token'];
  const remove = vi.fn();
  const renderWidget = vi.fn((_container: HTMLElement, { callback }: { callback: (token: string) => void }) => {
    callback(tokens.shift()!);
    return 'widget';
  });
  vi.stubGlobal('turnstile', { render: renderWidget, remove });
  const send = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(new Response('Too Many Requests', { status: 429 }))
    .mockResolvedValueOnce(Response.json({ ok: true }));
  vi.stubGlobal('fetch', send);

  const user = userEvent.setup();
  render(<FeedbackDialog onClose={() => {}} />);
  const description = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Description' });
  await user.selectOptions(screen.getByRole('combobox', { name: 'Feedback type' }), 'site');
  await user.type(description, 'The site has an issue.');
  const submit = screen.getByRole('button', { name: 'Submit feedback' });
  await user.click(submit);
  await screen.findByText('Too many submissions');
  expect(description.value).toBe('The site has an issue.');
  await user.click(submit);
  await screen.findByText('Thanks. Your report was sent.');

  expect(renderWidget.mock.calls[0][1]).toMatchObject({ sitekey: 'test-site-key', appearance: 'interaction-only' });
  expect(remove).toHaveBeenCalledTimes(2);
  expect(send.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).turnstileToken)).toEqual(['first-token', 'fresh-token']);
});
