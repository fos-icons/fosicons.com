import { createClient } from '@supabase/supabase-js';

let client: ReturnType<typeof createClient> | undefined;

/** The sandbox's Supabase client, shared by the billing page and the plan provider so they see one session. */
export function getBillingClient() {
  return client ??= createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { detectSessionInUrl: false },
  });
}
