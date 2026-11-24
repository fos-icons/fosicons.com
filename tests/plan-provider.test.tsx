import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

type AuthCallback = (event: string, session: { access_token: string } | null) => void;
const auth = vi.hoisted(() => ({ onAuthStateChange: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth }) }));

let signIn: AuthCallback;
const unsubscribe = vi.fn();

async function loadPlan(enabled: boolean) {
  vi.resetModules();
  vi.stubEnv('VITE_BILLING_SANDBOX_ENABLED', enabled ? 'true' : 'false');
  vi.stubEnv('VITE_SUPABASE_URL', 'https://sandbox.supabase.test');
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
  return import('../src/lib/plan');
}

async function renderPlan(enabled = true) {
  const { PlanProvider, usePlan } = await loadPlan(enabled);
  function Probe() {
    const { plan, enforced, loading, can } = usePlan();
    return <p data-testid="plan">{[plan, enforced ? 'enforced' : 'legacy', loading ? 'loading' : 'ready', can('modifiers') ? 'modifiers' : 'no-modifiers'].join(' ')}</p>;
  }
  render(<PlanProvider><Probe /></PlanProvider>);
  return () => screen.getByTestId('plan').textContent;
}

beforeEach(() => {
  vi.resetAllMocks();
  auth.onAuthStateChange.mockImplementation((callback: AuthCallback) => {
    signIn = callback;
    return { data: { subscription: { unsubscribe } } };
  });
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it('reads the signed-in subscriber’s plan from billing status and locks again on sign-out', async () => {
  const api = vi.fn().mockResolvedValue(Response.json({ plan: 'advanced', status: 'active', entitlement: 'advanced' }));
  vi.stubGlobal('fetch', api);
  const text = await renderPlan();
  expect(text()).toBe('free enforced loading no-modifiers');
  await waitFor(() => expect(auth.onAuthStateChange).toHaveBeenCalled());
  act(() => signIn('INITIAL_SESSION', { access_token: 'test-token' }));
  await waitFor(() => expect(text()).toBe('advanced enforced ready modifiers'));
  expect(api).toHaveBeenCalledWith('/api/billing/status', expect.objectContaining({ headers: { Authorization: 'Bearer test-token' } }));
  act(() => signIn('SIGNED_OUT', null));
  await waitFor(() => expect(text()).toBe('free enforced ready no-modifiers'));
});

it('does not unlock anything when the status is not active or cannot be read', async () => {
  const api = vi.fn().mockResolvedValueOnce(Response.json({ plan: 'pro', status: 'past_due' }))
    .mockResolvedValueOnce(new Response(null, { status: 503 }));
  vi.stubGlobal('fetch', api);
  const text = await renderPlan();
  await waitFor(() => expect(auth.onAuthStateChange).toHaveBeenCalled());
  act(() => signIn('INITIAL_SESSION', { access_token: 'test-token' }));
  await waitFor(() => expect(text()).toBe('free enforced ready no-modifiers'));
  act(() => signIn('TOKEN_REFRESHED', { access_token: 'test-token-2' }));
  await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
  expect(text()).toBe('free enforced ready no-modifiers');
});

it('makes no billing requests and keeps today’s access where billing is off', async () => {
  const api = vi.fn();
  vi.stubGlobal('fetch', api);
  const text = await renderPlan(false);
  expect(text()).toBe('free legacy ready modifiers');
  expect(auth.onAuthStateChange).not.toHaveBeenCalled();
  expect(api).not.toHaveBeenCalled();
});
