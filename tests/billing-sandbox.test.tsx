import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import BillingSandbox from '../src/pages/BillingSandbox';

const auth = vi.hoisted(() => ({
  onAuthStateChange: vi.fn(),
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth }) }));

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('requests a code for an existing tester, then verifies it before showing billing actions', async () => {
  const session = { access_token: 'test-token', user: { id: 'test-user' } };
  const unsubscribe = vi.fn();
  auth.onAuthStateChange.mockImplementation((callback) => {
    callback('INITIAL_SESSION', null);
    auth.verifyOtp.mockImplementation(() => {
      callback('SIGNED_IN', session);
      return Promise.resolve({ error: null });
    });
    return { data: { subscription: { unsubscribe } } };
  });
  auth.signInWithOtp.mockResolvedValue({ error: null });
  const api = vi.fn().mockResolvedValue(Response.json({ plan: 'free', status: null }));
  vi.stubGlobal('fetch', api);
  const user = userEvent.setup();
  render(<MemoryRouter><BillingSandbox /></MemoryRouter>);

  await user.type(await screen.findByLabelText('Email address'), 'tester@example.test');
  await user.click(screen.getByRole('button', { name: 'Send sign-in code' }));
  expect(auth.signInWithOtp).toHaveBeenCalledWith({
    email: 'tester@example.test', options: { shouldCreateUser: false },
  });
  expect(api).not.toHaveBeenCalled();
  await user.type(await screen.findByLabelText('Email sign-in code'), '123456');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'tester@example.test', token: '123456', type: 'email' });
  expect(await screen.findByText('Sandbox plan: Free')).toBeTruthy();
  expect(api).toHaveBeenCalledWith('/api/billing/status', expect.objectContaining({
    headers: { Authorization: 'Bearer test-token' },
  }));
  api.mockResolvedValueOnce(new Response(null, { status: 409 }));
  await user.click(screen.getByRole('button', { name: 'Test Pro checkout' }));
  expect(api).toHaveBeenLastCalledWith('/api/billing/checkout', expect.objectContaining({
    method: 'POST', body: JSON.stringify({ plan: 'pro' }),
  }));
  expect((await screen.findByRole('alert')).textContent).toContain('already exists');
});

it('offers the portal rather than a second checkout for a paid account', async () => {
  auth.onAuthStateChange.mockImplementation((callback) => {
    callback('INITIAL_SESSION', { access_token: 'test-token', user: { id: 'test-user' } });
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
  const api = vi.fn().mockResolvedValueOnce(Response.json({ plan: 'advanced', status: 'active' }))
    .mockResolvedValueOnce(new Response(null, { status: 503 }));
  vi.stubGlobal('fetch', api);
  const user = userEvent.setup();
  render(<MemoryRouter><BillingSandbox /></MemoryRouter>);

  expect(await screen.findByText('Sandbox plan: Advanced')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Test Pro checkout' })).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Open test billing portal' }));
  await waitFor(() => expect(api).toHaveBeenLastCalledWith('/api/billing/portal', expect.objectContaining({ method: 'POST' })));
  expect((await screen.findByRole('alert')).textContent).toContain('Couldn’t open the billing portal');
});

it('does not unlock a subscription from the checkout return URL', async () => {
  auth.onAuthStateChange.mockImplementation((callback) => {
    callback('INITIAL_SESSION', { access_token: 'test-token', user: { id: 'test-user' } });
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ plan: 'free', status: null })));
  render(<MemoryRouter initialEntries={['/pricing?billing=success']}><BillingSandbox /></MemoryRouter>);

  expect(screen.getByText('You’re back from Stripe. Refresh your sandbox subscription to confirm its status.')).toBeTruthy();
  expect(await screen.findByText('Sandbox plan: Free')).toBeTruthy();
});
