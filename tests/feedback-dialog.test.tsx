import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import FeedbackDialog from '../src/components/FeedbackDialog';

HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.open = true; };

afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllGlobals(); });

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
