/**
 * Where billing runs. `sandbox` uses Stripe test mode and never runs on Vercel
 * production; `live` takes real payments and runs only there.
 */
export type BillingMode = 'sandbox' | 'live';

/**
 * Reads `BILLING_MODE` (or `VITE_BILLING_MODE`). Anything else, including a
 * typo or different casing, leaves billing off. The older sandbox flag still
 * turns on the sandbox when no mode is set.
 */
export function parseBillingMode(mode: string | undefined, legacySandbox?: string): BillingMode | null {
  if (mode === 'sandbox' || mode === 'live') return mode;
  if (!mode && legacySandbox === 'true') return 'sandbox';
  return null;
}
