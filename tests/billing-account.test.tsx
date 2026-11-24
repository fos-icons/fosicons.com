import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

type Session = { access_token: string; user: { id: string; email: string } };
type AuthCallback = (event: string, session: Session | null) => void;

const auth = vi.hoisted(() => ({
  onAuthStateChange: vi.fn(),
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth }) }));

const signedIn: Session = { access_token: 'test-token', user: { id: 'test-user', email: 'buyer@example.test' } };
let listeners: AuthCallback[] = [];
const emit = (event: string, session: Session | null) => act(() => listeners.forEach((listener) => listener(event, session)));

/** Mocks the billing API: anonymous status reads get `anonymous` (401 = billing is up), signed-in reads get `status`. */
function billingApi(status: object, anonymous = 401) {
  const api = vi.fn(async (url: string, init?: RequestInit) => {
    const signed = new Headers(init?.headers).has('Authorization');
    if (url === '/api/billing/status') return signed ? Response.json(status) : new Response(null, { status: anonymous });
    if (url === '/api/billing/checkout') return Response.json({ url: 'https://checkout.stripe.com/c/pay/cs_live_fixture' });
    if (url === '/api/billing/portal') return Response.json({ url: 'https://billing.stripe.com/p/session' });
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', api);
  return api;
}

async function renderPricing(mode: 'sandbox' | 'live', session: Session | null, entry = '/pricing') {
  vi.resetModules();
  vi.stubEnv('VITE_BILLING_MODE', mode);
  vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.test');
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
  auth.onAuthStateChange.mockImplementation((callback: AuthCallback) => {
    listeners.push(callback);
    callback('INITIAL_SESSION', session);
    return { data: { subscription: { unsubscribe: () => { listeners = listeners.filter((l) => l !== callback); } } } };
  });
  const [{ default: PricingPage }, { PlanProvider }, { primeArtwork }] = await Promise.all([
    import('../src/pages/PricingPage'), import('../src/lib/plan'), import('../src/lib/artwork'),
  ]);
  const sample = '<svg viewBox="0 0 64 64"></svg>';
  primeArtwork({
    'regular@64': { calendar: sample }, 'filled@64': { calendar: sample },
    'duocolor@64': { calendar: sample }, 'duotone@64': { calendar: sample, 'calendar-add': sample },
  });
  render(<MemoryRouter initialEntries={[entry]}><PlanProvider><PricingPage /></PlanProvider></MemoryRouter>);
}

const card = (name: string) => within(screen.getByRole('article', { name }));

beforeEach(() => {
  vi.resetAllMocks();
  listeners = [];
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('signs a new customer up from a plan card, then continues to that plan’s Checkout', async () => {
  const api = billingApi({ plan: 'free', status: null });
  auth.signInWithOtp.mockResolvedValue({ error: null });
  auth.verifyOtp.mockImplementation(async () => {
    emit('SIGNED_IN', signedIn);
    return { error: null };
  });
  const user = userEvent.setup();
  await renderPricing('live', null);

  expect(screen.queryByRole('heading', { name: 'Your account' })).toBeNull();
  expect(screen.queryByText(/aren’t available to buy yet/)).toBeNull();
  const getPro = await card('Pro').findByRole('button', { name: 'Get Pro' });
  await waitFor(() => expect((getPro as HTMLButtonElement).disabled).toBe(false));
  await user.click(getPro);

  expect(await screen.findByRole('heading', { name: 'Your account' })).toBeTruthy();
  expect(await screen.findByText('Sign in to continue with Pro.')).toBeTruthy();
  await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Email address')));
  await user.type(screen.getByLabelText('Email address'), 'buyer@example.test');
  await user.click(screen.getByRole('button', { name: 'Send sign-in code' }));
  expect(auth.signInWithOtp).toHaveBeenCalledWith({ email: 'buyer@example.test', options: { shouldCreateUser: true } });
  await user.type(await screen.findByLabelText('Email sign-in code'), '123456');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  expect(await screen.findByText('Signed in as buyer@example.test')).toBeTruthy();
  expect(await screen.findByText('Your plan: Free')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Continue to Pro checkout' }));
  expect(api).toHaveBeenCalledWith('/api/billing/checkout', expect.objectContaining({
    method: 'POST', body: JSON.stringify({ plan: 'pro' }),
  }));
  expect(screen.queryByRole('alert')).toBeNull();
});

it('lets testers in only with an existing sandbox account and always shows the sandbox notice', async () => {
  billingApi({ plan: 'free', status: null });
  auth.signInWithOtp.mockResolvedValue({ error: null });
  const user = userEvent.setup();
  await renderPricing('sandbox', null);

  expect(await screen.findByRole('heading', { name: 'Test Stripe checkout' })).toBeTruthy();
  expect(screen.getByText(/No money moves/)).toBeTruthy();
  await user.type(await screen.findByLabelText('Email address'), 'tester@example.test');
  await user.click(screen.getByRole('button', { name: 'Send sign-in code' }));
  expect(auth.signInWithOtp).toHaveBeenCalledWith({ email: 'tester@example.test', options: { shouldCreateUser: false } });
});

it('sends a signed-in Free account straight to Checkout and explains a conflict', async () => {
  const api = billingApi({ plan: 'free', status: null });
  const user = userEvent.setup();
  await renderPricing('live', signedIn);

  const getAdvanced = card('Advanced').getByRole('button', { name: 'Get Advanced' });
  await waitFor(() => expect((getAdvanced as HTMLButtonElement).disabled).toBe(false));
  api.mockImplementationOnce(async () => new Response(null, { status: 409 }));
  await user.click(getAdvanced);
  expect(api).toHaveBeenLastCalledWith('/api/billing/checkout', expect.objectContaining({ body: JSON.stringify({ plan: 'advanced' }) }));
  expect((await card('Advanced').findByRole('alert')).textContent).toContain('already exists');
});

it('shows a subscriber their current plan and offers the portal instead of a second purchase', async () => {
  const api = billingApi({ plan: 'advanced', status: 'active', entitlement: 'advanced' });
  const user = userEvent.setup();
  await renderPricing('live', signedIn);

  expect(await card('Advanced').findByText('Your current plan')).toBeTruthy();
  expect(card('Pro').queryByRole('button', { name: 'Get Pro' })).toBeNull();
  expect(await screen.findByText('Your plan: Advanced')).toBeTruthy();
  await user.click(card('Pro').getByRole('button', { name: 'Manage billing' }));
  expect(api).toHaveBeenLastCalledWith('/api/billing/portal', expect.objectContaining({ method: 'POST' }));
});

it('keeps “Coming soon” when the billing endpoint is off, e.g. a live build on a preview deployment', async () => {
  billingApi({ plan: 'free', status: null }, 503);
  await renderPricing('live', null);

  expect(await card('Pro').findByText('Coming soon')).toBeTruthy();
  expect(card('Pro').queryByRole('button')).toBeNull();
  expect(screen.getByText(/aren’t available to buy yet/)).toBeTruthy();
});

it('does not unlock a plan from the Checkout return URL alone, and re-reads the status', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  try {
    const api = billingApi({ plan: 'free', status: null });
    await renderPricing('live', signedIn, '/pricing?billing=success');

    expect(await screen.findByText(/Thanks for subscribing/)).toBeTruthy();
    expect(await screen.findByText('Your plan: Free')).toBeTruthy();
    const reads = () => api.mock.calls.filter(([url, init]) => url === '/api/billing/status' && new Headers(init?.headers).has('Authorization')).length;
    const before = reads();
    await act(() => vi.advanceTimersByTimeAsync(2500));
    await waitFor(() => expect(reads()).toBe(before + 1));
  } finally {
    vi.useRealTimers();
  }
});
