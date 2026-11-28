import { createClient } from '@supabase/supabase-js';
import type { PaidPlan } from '../../src/lib/billing-plans.js';
import { BillingError, type BillingConfig } from './config.js';

export type BillingStatus = { plan: 'free' | PaidPlan; status: string | null };
export type SubscriptionProjection = BillingStatus & { subscription_id: string | null };

export type BillingRow = {
  user_id: string;
  customer_id: string | null;
  checkout_plan: PaidPlan | null;
  checkout_started_at: string | null;
  checkout_id: string | null;
  plan: BillingStatus['plan'];
  status: BillingStatus['status'];
  subscription_id: string | null;
  projection_revision: number;
  projected_at: string | null;
};

type Database = {
  public: {
    Tables: {
      billing_customers: {
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

const unavailable = () => new BillingError(503, 'billing_unavailable');

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
  const table = () => db.from('billing_customers');

  return {
    async verifyUser(token: string) {
      const { data, error } = await db.auth.getUser(token);
      if (error) {
        if (error.status === 400 || error.status === 401 || error.status === 403 || error.status === 422) {
          throw new BillingError(401, 'unauthorized');
        }
        throw unavailable();
      }
      if (!data.user?.id) throw new BillingError(401, 'unauthorized');
      return data.user.id;
    },
    async byUser(userId: string) {
      const { data, error } = await table().select().eq('user_id', userId).maybeSingle();
      if (error) throw unavailable();
      return data;
    },
    async ensureRow(userId: string) {
      const { error } = await table().upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
      if (error) throw unavailable();
    },
    /** Takes the checkout lease unless another request took it after `staleBefore`. */
    async claimCheckout(userId: string, plan: PaidPlan, staleBefore: Date) {
      const { data, error } = await table().update({
        checkout_plan: plan, checkout_started_at: new Date().toISOString(), checkout_id: null,
      }).eq('user_id', userId)
        .or(`checkout_started_at.is.null,checkout_started_at.lt.${staleBefore.toISOString()}`)
        .select('user_id').maybeSingle();
      if (error) throw unavailable();
      return Boolean(data);
    },
    async setCheckout(userId: string, checkoutId: string) {
      const { error } = await table().update({ checkout_id: checkoutId }).eq('user_id', userId);
      if (error) throw unavailable();
    },
    async project(userId: string, revision: number, customerId: string, projection: SubscriptionProjection) {
      const { data, error } = await table().update({
        ...projection, customer_id: customerId, projection_revision: revision + 1, projected_at: new Date().toISOString(),
      }).eq('user_id', userId).eq('projection_revision', revision).select('user_id').maybeSingle();
      if (error) throw unavailable();
      return Boolean(data);
    },
  };
}

export type BillingStore = ReturnType<typeof createBillingStore>;
