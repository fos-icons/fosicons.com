import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { PaidPlan } from '../../src/lib/billing-plans.js';
import { BillingError, type BillingConfig } from './config.js';

export type BillingStatus = { plan: 'free' | PaidPlan; status: string | null };
export type SubscriptionProjection = BillingStatus & { subscription_id: string | null };
export type CheckoutAttempt = { id: string; plan: PaidPlan; started_at: string; session_id: string | null };

type BillingRow = {
  user_id: string;
  customer_id: string | null;
  customer_key: string;
  customer_started_at: string;
  checkout_id: string | null;
  checkout_plan: PaidPlan | null;
  checkout_started_at: string | null;
  checkout_session_id: string | null;
  plan: BillingStatus['plan'];
  status: BillingStatus['status'];
  subscription_id: string | null;
  projection_revision: number;
  projected_at: string | null;
};

type Database = {
  public: {
    Tables: {
      billing_sandbox_customers: {
        Row: BillingRow;
        Insert: Pick<BillingRow, 'user_id'> & Partial<Omit<BillingRow, 'user_id'>>;
        Update: Partial<BillingRow>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
  };
};

export function getAttempt(row: BillingRow): CheckoutAttempt | null {
  return row.checkout_id && row.checkout_plan && row.checkout_started_at ? {
    id: row.checkout_id,
    plan: row.checkout_plan,
    started_at: row.checkout_started_at,
    session_id: row.checkout_session_id,
  } : null;
}

export function createBillingStore(config: BillingConfig) {
  const db = createClient<Database>(config.supabaseUrl, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) => fetch(input, {
        ...init,
        signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000),
      }),
    },
  });
  const table = () => db.from('billing_sandbox_customers');

  return {
    async verifyUser(token: string) {
      const { data, error } = await db.auth.getUser(token);
      if (error) {
        if (error.status === 400 || error.status === 401 || error.status === 403 || error.status === 422) {
          throw new BillingError(401, 'unauthorized');
        }
        throw new BillingError(503, 'billing_unavailable');
      }
      if (!data.user?.id) throw new BillingError(401, 'unauthorized');
      return data.user.id;
    },
    async byUser(userId: string) {
      const { data, error } = await table().select().eq('user_id', userId).maybeSingle();
      if (error) throw new BillingError(503, 'billing_unavailable');
      return data;
    },
    async byCustomer(customerId: string) {
      const { data, error } = await table().select().eq('customer_id', customerId).maybeSingle();
      if (error) throw new BillingError(503, 'billing_unavailable');
      return data;
    },
    async reserveCustomer(userId: string) {
      const { error } = await table().upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
      if (error) throw new BillingError(503, 'billing_unavailable');
    },
    async setCustomer(userId: string, key: string, customerId: string) {
      const { data, error } = await table().update({ customer_id: customerId })
        .eq('user_id', userId).eq('customer_key', key).is('customer_id', null).select().maybeSingle();
      if (error) throw new BillingError(503, 'billing_unavailable');
      return data;
    },
    async reserveCheckout(userId: string, customerId: string, plan: PaidPlan) {
      const { data, error } = await table().update({
        checkout_id: randomUUID(), checkout_plan: plan, checkout_started_at: new Date().toISOString(),
      }).eq('user_id', userId).eq('customer_id', customerId).is('checkout_id', null).select().maybeSingle();
      if (error) throw new BillingError(503, 'billing_unavailable');
      return data;
    },
    async setSession(userId: string, attempt: string, sessionId: string) {
      const { data, error } = await table().update({ checkout_session_id: sessionId })
        .eq('user_id', userId).eq('checkout_id', attempt).is('checkout_session_id', null).select().maybeSingle();
      if (error) throw new BillingError(503, 'billing_unavailable');
      return data;
    },
    async clearCheckout(userId: string, attempt: string, session: string) {
      const { error } = await table().update({
        checkout_id: null, checkout_plan: null, checkout_started_at: null, checkout_session_id: null,
      }).eq('user_id', userId).eq('checkout_id', attempt).eq('checkout_session_id', session);
      if (error) throw new BillingError(503, 'billing_unavailable');
    },
    async project(userId: string, customerId: string, revision: number, projection: SubscriptionProjection) {
      const { data, error } = await table().update({
        ...projection, projection_revision: revision + 1, projected_at: new Date().toISOString(),
      }).eq('user_id', userId).eq('customer_id', customerId).eq('projection_revision', revision)
        .select('user_id').maybeSingle();
      if (error) throw new BillingError(503, 'billing_unavailable');
      return Boolean(data);
    },
  };
}

export type BillingStore = ReturnType<typeof createBillingStore>;
