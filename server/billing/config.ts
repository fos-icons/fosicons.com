import { parseBillingMode, type BillingMode } from '../../src/lib/billing-mode.js';
import { PAID_PLANS, type PaidPlan } from '../../src/lib/billing-plans.js';

export type BillingConfig = {
  mode: BillingMode;
  /** Whether this is live billing, which takes real payments. */
  live: boolean;
  site: URL;
  /** Polar API environment. Sandbox and production tokens, products and webhooks are separate. */
  server: 'sandbox' | 'production';
  accessToken: string;
  webhookSecret: string;
  supabaseUrl: string;
  serviceRoleKey: string;
  plans: Record<PaidPlan, { product: string; discount: string; renewal: number; initial: number }>;
};

export class BillingError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code);
  }
}

function rootUrl(value: string | undefined, allowLocal = true) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (local && !allowLocal) return null;
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) return null;
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    return url;
  } catch {
    return null;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

function isLegacyServiceRole(key: string | undefined): key is string {
  if (!key || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(key)) return false;
  try {
    return JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'service_role';
  } catch {
    return false;
  }
}

/**
 * The sandbox never runs on Vercel production, and live billing runs only
 * there, so preview deployments and local servers can't take real payments.
 */
export function readBillingConfig(env: NodeJS.ProcessEnv): BillingConfig {
  const mode = parseBillingMode(env.BILLING_MODE, env.BILLING_SANDBOX_ENABLED);
  const production = env.VERCEL_ENV === 'production';
  if (!mode || production !== (mode === 'live')) {
    throw new BillingError(503, 'billing_disabled');
  }
  const live = mode === 'live';
  const site = rootUrl(env.BILLING_SITE_URL, !live);
  const supabase = rootUrl(env.SUPABASE_URL);
  const accessToken = env.POLAR_ACCESS_TOKEN;
  const webhookSecret = env.POLAR_WEBHOOK_SECRET;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const ids = [env.POLAR_PRO_PRODUCT_ID, env.POLAR_PRO_DISCOUNT_ID, env.POLAR_ADVANCED_PRODUCT_ID, env.POLAR_ADVANCED_DISCOUNT_ID];
  if (!site || !supabase || !isLegacyServiceRole(serviceRoleKey) ||
      !accessToken?.startsWith('polar_oat_') || !webhookSecret || webhookSecret.length < 16 ||
      !ids.every(isUuid) || new Set(ids).size !== ids.length) {
    throw new BillingError(503, 'billing_misconfigured');
  }
  const [proProduct, proDiscount, advancedProduct, advancedDiscount] = ids as string[];
  const offer = (plan: PaidPlan, product: string, discount: string) => ({
    product, discount, renewal: PAID_PLANS[plan].renewal * 100, initial: PAID_PLANS[plan].firstYear * 100,
  });
  return {
    mode, live, site, server: live ? 'production' : 'sandbox', accessToken, webhookSecret,
    supabaseUrl: supabase.origin, serviceRoleKey,
    plans: {
      pro: offer('pro', proProduct, proDiscount),
      advanced: offer('advanced', advancedProduct, advancedDiscount),
    },
  };
}
