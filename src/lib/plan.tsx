import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { entitledPlan, legacyAllows, planAllows, type Feature, type Plan } from './entitlements';

/** Billing runs only where the sandbox is switched on and Supabase is configured (never on production yet). */
export const billingEnabled = import.meta.env.VITE_BILLING_SANDBOX_ENABLED === 'true'
  && Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);

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
}

const noop = () => {};
const legacy: PlanState = { plan: 'free', enforced: false, loading: false, can: legacyAllows, refresh: noop };
const PlanContext = createContext<PlanState>(legacy);

/** The current plan and what it unlocks. This is a convenience gate in the browser, not access control. */
export const usePlan = () => useContext(PlanContext);

function stateFor(plan: Plan, loading: boolean, refresh: () => void): PlanState {
  return { plan, enforced: true, loading, can: (feature) => planAllows(plan, feature), refresh };
}

/** A fixed plan with the matrix enforced, for tests and stories. */
export function StaticPlanProvider({ plan, children }: { plan: Plan; children: ReactNode }) {
  const value = useMemo(() => stateFor(plan, false, noop), [plan]);
  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

async function readPlan(token: string, signal: AbortSignal): Promise<Plan> {
  const response = await fetch('/api/billing/status', { headers: { Authorization: `Bearer ${token}` }, signal });
  if (!response.ok) throw new Error('Unable to read subscription');
  return entitledPlan(await response.json());
}

function LivePlanProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [plan, setPlan] = useState<Plan>('free');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    let unsubscribe = noop;
    let live = true;
    // Supabase loads only where billing is on, so it stays out of the main bundle elsewhere.
    void import('./billing-client').then(({ getBillingClient }) => {
      if (!live) return;
      const { data } = getBillingClient().auth.onAuthStateChange((_event, session) => setToken(session?.access_token ?? null));
      unsubscribe = () => data.subscription.unsubscribe();
    }).catch(() => { if (live) setToken(null); });
    return () => { live = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    if (token === undefined) return;
    if (token === null) {
      setPlan('free');
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    readPlan(token, controller.signal).then(
      (next) => { if (!controller.signal.aborted) setPlan(next); },
      // Unknown means locked: a failed read never unlocks paid features.
      () => { if (!controller.signal.aborted) setPlan('free'); },
    ).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, revision]);

  const value = useMemo(() => stateFor(plan, loading, refresh), [plan, loading, refresh]);
  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

/** Provides the signed-in subscriber's plan where billing is enabled, and today's free access elsewhere. */
export function PlanProvider({ children }: { children: ReactNode }) {
  return billingEnabled ? <LivePlanProvider>{children}</LivePlanProvider> : <>{children}</>;
}
