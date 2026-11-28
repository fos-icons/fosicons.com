import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { parseBillingMode, type BillingMode } from './billing-mode';
import { isPaidPlan } from './billing-plans';
import { entitledPlan, legacyAllows, planAllows, type Feature, type Plan } from './entitlements';

/**
 * Where billing runs, from the build's `VITE_` settings: `null` when it's off
 * or Supabase isn't configured. The server enforces its own, stricter rules.
 */
export const billingMode: BillingMode | null = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  ? parseBillingMode(import.meta.env.VITE_BILLING_MODE, import.meta.env.VITE_BILLING_SANDBOX_ENABLED)
  : null;
export const billingEnabled = billingMode !== null;

/** The stored billing status for the signed-in account, as `/api/billing/status` reports it. */
export interface Subscription {
  /** The plan of the account's current or most recent subscription; `free` when there is none. */
  plan: Plan;
  /** The Polar subscription status, or `null` when there has never been one. */
  status: string | null;
}

/** Statuses after which a subscription is over and a new Checkout is allowed. */
const ENDED = new Set(['canceled', 'incomplete_expired']);

/** Whether an account has a subscription that isn't over, which it manages in the billing portal rather than buying again. */
export function hasOpenSubscription(subscription: Subscription | null) {
  return !!subscription?.status && !ENDED.has(subscription.status);
}

export interface PlanState {
  /** The plan the signed-in subscriber's billing status grants; `free` when signed out. */
  plan: Plan;
  /**
   * Whether the pricing matrix is enforced. Off where billing is disabled: then
   * only the paid styles stay locked, as before billing existed.
   */
  enforced: boolean;
  /** True until the first billing status has loaded. */
  loading: boolean;
  /** Whether the current plan unlocks a feature. */
  can: (feature: Feature) => boolean;
  /** Read the billing status again, e.g. after returning from Checkout. */
  refresh: () => void;
  /** The signed-in account, or `null` when signed out (or billing is off). */
  session: { token: string; email: string | null } | null;
  /** The account's billing status; `null` while signed out, loading, or unreadable. */
  subscription: Subscription | null;
  /** True when the billing status couldn't be read. Paid features stay locked. */
  statusError: boolean;
}

const noop = () => {};
const legacy: PlanState = {
  plan: 'free', enforced: false, loading: false, can: legacyAllows, refresh: noop,
  session: null, subscription: null, statusError: false,
};
const PlanContext = createContext<PlanState>(legacy);

/** The current plan and what it unlocks. This is a convenience gate in the browser, not access control. */
export const usePlan = () => useContext(PlanContext);

/** A fixed plan with the matrix enforced, for tests and stories. */
export function StaticPlanProvider({ plan, children }: { plan: Plan; children: ReactNode }) {
  const value = useMemo<PlanState>(() => ({
    ...legacy, plan, enforced: true, can: (feature) => planAllows(plan, feature),
  }), [plan]);
  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

async function readStatus(token: string, signal: AbortSignal): Promise<Subscription> {
  const response = await fetch('/api/billing/status', { headers: { Authorization: `Bearer ${token}` }, signal });
  if (!response.ok) throw new Error('Unable to read subscription');
  const data = await response.json();
  if (data.plan !== 'free' && !isPaidPlan(data.plan)) throw new Error('Unknown plan');
  return { plan: data.plan, status: typeof data.status === 'string' ? data.status : null };
}

function LivePlanProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<PlanState['session'] | undefined>(undefined);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((r) => r + 1), []);
  const token = session?.token;
  /** False until Supabase reports whether anyone is signed in. */
  const known = session !== undefined;

  useEffect(() => {
    let unsubscribe = noop;
    let live = true;
    // Supabase loads only where billing is on, so it stays out of the main bundle elsewhere.
    void import('./billing-client').then(({ getBillingClient }) => {
      if (!live) return;
      const { data } = getBillingClient().auth.onAuthStateChange((_event, current) => setSession(
        current ? { token: current.access_token, email: current.user?.email ?? null } : null,
      ));
      unsubscribe = () => data.subscription.unsubscribe();
    }).catch(() => { if (live) setSession(null); });
    return () => { live = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!known) return;
    if (!token) {
      setSubscription(null);
      setStatusError(false);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    readStatus(token, controller.signal).then(
      (next) => {
        if (controller.signal.aborted) return;
        setSubscription(next);
        setStatusError(false);
      },
      // Unknown means locked: a failed read never unlocks paid features.
      () => {
        if (controller.signal.aborted) return;
        setSubscription(null);
        setStatusError(true);
      },
    ).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [known, token, revision]);

  const value = useMemo<PlanState>(() => {
    const plan = entitledPlan(subscription);
    return {
      plan, enforced: true, loading, can: (feature) => planAllows(plan, feature), refresh,
      session: session ?? null, subscription, statusError,
    };
  }, [subscription, loading, refresh, session, statusError]);
  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

/** Provides the signed-in subscriber's plan where billing is enabled, and today's free access elsewhere. */
export function PlanProvider({ children }: { children: ReactNode }) {
  return billingEnabled ? <LivePlanProvider>{children}</LivePlanProvider> : <>{children}</>;
}
