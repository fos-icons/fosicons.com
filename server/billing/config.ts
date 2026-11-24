import { PAID_PLANS, type PaidPlan } from '../../src/lib/billing-plans.js';

export type BillingConfig = {
  site: URL;
  stripeKey: string;
  webhookSecret: string;
  supabaseUrl: string;
  serviceRoleKey: string;
  portalConfiguration?: string;
  plans: Record<PaidPlan, { price: string; coupon: string; renewal: number; initial: number }>;
};

export class BillingError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code);
  }
}

function rootUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) return null;
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    return url;
  } catch {
    return null;
  }
}

function isLegacyServiceRole(key: string | undefined): key is string {
  if (!key || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(key)) return false;
  try {
    return JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'service_role';
  } catch {
    return false;
  }
}

export function readBillingConfig(env: NodeJS.ProcessEnv): BillingConfig {
  if (env.BILLING_SANDBOX_ENABLED !== 'true' || env.VERCEL_ENV === 'production') {
    throw new BillingError(503, 'billing_disabled');
  }
  const site = rootUrl(env.BILLING_SITE_URL);
  const supabase = rootUrl(env.SUPABASE_URL);
  const stripeKey = env.STRIPE_SECRET_KEY;
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const portalConfiguration = env.STRIPE_PORTAL_CONFIGURATION_ID || undefined;
  const proPrice = env.STRIPE_PRO_PRICE_ID;
  const advancedPrice = env.STRIPE_ADVANCED_PRICE_ID;
  const proCoupon = env.STRIPE_PRO_COUPON_ID;
  const advancedCoupon = env.STRIPE_ADVANCED_COUPON_ID;
  if (!site || !supabase || !isLegacyServiceRole(serviceRoleKey) ||
      !stripeKey?.startsWith('sk_test_') || !webhookSecret?.startsWith('whsec_') ||
      !proPrice?.startsWith('price_') || !advancedPrice?.startsWith('price_') || proPrice === advancedPrice ||
      !proCoupon || !advancedCoupon || proCoupon === advancedCoupon ||
      (portalConfiguration && !portalConfiguration.startsWith('bpc_'))) {
    throw new BillingError(503, 'billing_misconfigured');
  }
  const offer = (plan: PaidPlan, price: string, coupon: string) => ({
    price, coupon, renewal: PAID_PLANS[plan].renewal * 100, initial: PAID_PLANS[plan].firstYear * 100,
  });
  return {
    site, stripeKey, webhookSecret, supabaseUrl: supabase.origin, serviceRoleKey, portalConfiguration,
    plans: {
      pro: offer('pro', proPrice, proCoupon),
      advanced: offer('advanced', advancedPrice, advancedCoupon),
    },
  };
}
