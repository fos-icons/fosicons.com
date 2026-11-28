import { createPolar, webhooks, type Polar, type models } from '@polar-sh/sdk/2026-10';
import { isPaidPlan, type PaidPlan } from '../../src/lib/billing-plans.js';
import { isPolarHostedUrl } from '../../src/lib/billing-hosts.js';
import { BillingError, isUuid, type BillingConfig } from './config.js';
import type { BillingStore, SubscriptionProjection } from './store.js';

/** How long one request holds the right to create a checkout. */
const CHECKOUT_LEASE_MS = 60_000;
const TERMINAL_SUBSCRIPTIONS = new Set<string>(['canceled', 'incomplete_expired']);
const RETURN_PATH = '/pricing';

export function createBillingPolar(config: BillingConfig) {
  return createPolar({ accessToken: config.accessToken, environment: config.server, timeout: 8 });
}

export type BillingPolar = {
  products: Pick<Polar['products'], 'get'>;
  discounts: Pick<Polar['discounts'], 'get'>;
  subscriptions: Pick<Polar['subscriptions'], 'list'>;
  checkouts: Pick<Polar['checkouts'], 'list' | 'create'>;
  customerSessions: Pick<Polar['customerSessions'], 'create'>;
};

type Offer = BillingConfig['plans'][PaidPlan];

const unavailable = () => new BillingError(503, 'billing_unavailable');
const inProgress = () => new BillingError(409, 'checkout_in_progress');
const subscriptionExists = () => new BillingError(409, 'subscription_exists');
const misconfigured = () => new BillingError(503, 'billing_misconfigured');

const isUsd = (currency: string | null | undefined) => currency?.toLowerCase() === 'usd';

function hosted(config: BillingConfig, url: string | null | undefined) {
  if (!url) throw unavailable();
  if (!isPolarHostedUrl(config.mode, url)) throw misconfigured();
  return { url };
}

/** The one price a plan's product may have: a fixed USD amount at the renewal rate. */
function renewalPriceMatches(product: Pick<models.Product, 'prices'>, renewal: number) {
  const prices = product.prices.filter(price => !price.is_archived);
  if (prices.length !== 1) return false;
  const [price] = prices;
  return price.amount_type === 'fixed' && 'price_amount' in price && price.price_amount === renewal &&
    isUsd(price.price_currency);
}

function yearly(value: { recurring_interval: string | null; recurring_interval_count?: number | null }) {
  return value.recurring_interval === 'year' && (value.recurring_interval_count ?? 1) === 1;
}

/**
 * The product must renew yearly at the full price with no trial, and the
 * discount must take the first year down to the introductory price, once,
 * for that product only.
 */
export function validateOffer(product: models.Product, discount: models.Discount, offer: Offer, now = Date.now()) {
  const productOk = product.id === offer.product && !product.is_archived && product.is_recurring &&
    yearly(product) && !product.trial_interval && renewalPriceMatches(product, offer.renewal);
  const started = !discount.starts_at || Date.parse(discount.starts_at) <= now;
  const notEnded = !discount.ends_at || Date.parse(discount.ends_at) > now;
  const redeemable = discount.max_redemptions === null || discount.redemptions_count < discount.max_redemptions;
  const discountOk = discount.id === offer.discount && discount.type === 'fixed' && discount.duration === 'once' &&
    'amount' in discount && discount.amount === offer.renewal - offer.initial && isUsd(discount.currency) &&
    discount.code === null && started && notEnded && redeemable &&
    discount.products.length === 1 && discount.products[0].id === offer.product;
  if (!productOk || !discountOk) throw misconfigured();
}

async function confirmOffer(config: BillingConfig, polar: BillingPolar, plan: PaidPlan) {
  const offer = config.plans[plan];
  const [product, discount] = await Promise.all([
    polar.products.get(offer.product),
    polar.discounts.get(offer.discount),
  ]);
  validateOffer(product, discount, offer);
}

async function listSubscriptions(polar: BillingPolar, userId: string) {
  const page = await polar.subscriptions.list({ external_customer_id: userId, limit: 100 });
  if (page.pagination.max_page > 1) throw unavailable();
  // The filter is Polar's; check ownership again rather than trust it.
  if (page.items.some(sub => sub.customer.external_id !== userId)) throw unavailable();
  return page.items;
}

export function projectSubscriptions(config: BillingConfig, subscriptions: models.Subscription[]): SubscriptionProjection {
  const candidates = subscriptions.map(sub => {
    const plan = (sub.status === 'active' || sub.status === 'trialing') && yearly(sub) && !sub.paused_at
      ? (['advanced', 'pro'] as const).find(name => sub.product_id === config.plans[name].product)
      : undefined;
    return {
      sub,
      plan,
      priority: plan === 'advanced' ? 4 : plan === 'pro' ? 3 : TERMINAL_SUBSCRIPTIONS.has(sub.status) ? 1 : 2,
    };
  });
  const first = candidates.sort((a, b) =>
    b.priority - a.priority || b.sub.created_at.localeCompare(a.sub.created_at) || a.sub.id.localeCompare(b.sub.id),
  )[0];
  return first ? { plan: first.plan ?? 'free', status: first.sub.status, subscription_id: first.sub.id }
    : { plan: 'free', status: null, subscription_id: null };
}

export function checkoutParams(config: BillingConfig, userId: string, plan: PaidPlan): models.CheckoutCreate {
  const offer = config.plans[plan];
  const returnUrl = new URL(RETURN_PATH, config.site).href;
  return {
    products: [offer.product],
    discount_id: offer.discount,
    allow_discount_codes: false,
    allow_trial: false,
    currency: 'usd',
    external_customer_id: userId,
    metadata: { fos_plan: plan },
    success_url: `${returnUrl}?billing=success`,
    return_url: `${returnUrl}?billing=cancel`,
  };
}

/** A checkout is only handed out if it charges exactly the advertised prices to this user. */
function checkoutUrl(config: BillingConfig, checkout: models.Checkout, userId: string, plan: PaidPlan) {
  const offer = config.plans[plan];
  if (checkout.external_customer_id !== userId || checkout.metadata.fos_plan !== plan ||
      checkout.product_id !== offer.product || checkout.discount_id !== offer.discount ||
      checkout.allow_discount_codes || !isUsd(checkout.currency) || checkout.amount !== offer.renewal ||
      checkout.discount_amount !== offer.renewal - offer.initial || checkout.net_amount !== offer.initial) {
    throw misconfigured();
  }
  return hosted(config, checkout.url);
}

function openCheckouts(checkouts: models.Checkout[], now = Date.now()) {
  return checkouts.filter(checkout => checkout.status === 'open' && Date.parse(checkout.expires_at) > now);
}

export async function checkout(
  config: BillingConfig, store: BillingStore, polar: BillingPolar, userId: string, plan: PaidPlan,
) {
  await store.ensureRow(userId);
  if ((await listSubscriptions(polar, userId)).some(sub => !TERMINAL_SUBSCRIPTIONS.has(sub.status))) {
    throw subscriptionExists();
  }

  // Send the buyer back to a checkout they already opened, rather than start
  // a second one they could also pay.
  const page = await polar.checkouts.list({ external_customer_id: userId, status: 'open', limit: 100 });
  const open = openCheckouts(page.items);
  if (open.length > 1 || page.pagination.max_page > 1) throw inProgress();
  if (open.length === 1) {
    const [existing] = open;
    if (existing.external_customer_id !== userId) throw unavailable();
    if (existing.metadata.fos_plan !== plan) throw inProgress();
    return checkoutUrl(config, existing, userId, plan);
  }

  await confirmOffer(config, polar, plan);
  if (!await store.claimCheckout(userId, plan, new Date(Date.now() - CHECKOUT_LEASE_MS))) throw inProgress();
  const created = await polar.checkouts.create(checkoutParams(config, userId, plan));
  const result = checkoutUrl(config, created, userId, plan);
  await store.setCheckout(userId, created.id);
  return result;
}

export async function portal(config: BillingConfig, store: BillingStore, polar: BillingPolar, userId: string) {
  const row = await store.byUser(userId);
  if (!row?.customer_id) throw new BillingError(404, 'no_billing_customer');
  const session = await polar.customerSessions.create({
    external_customer_id: userId,
    return_url: new URL(RETURN_PATH, config.site).href,
  });
  if (session.customer_id !== row.customer_id || session.customer.external_id !== userId) throw unavailable();
  return hosted(config, session.customer_portal_url);
}

const WEBHOOK_HEADERS = ['webhook-id', 'webhook-timestamp', 'webhook-signature'] as const;
export type WebhookHeaders = Record<(typeof WEBHOOK_HEADERS)[number], string>;

export function readWebhookHeaders(headers: Record<string, string | string[] | undefined>): WebhookHeaders {
  const values = WEBHOOK_HEADERS.map(name => headers[name]);
  if (!values.every(value => typeof value === 'string' && value)) throw new BillingError(400, 'invalid_webhook');
  return Object.fromEntries(WEBHOOK_HEADERS.map((name, i) => [name, values[i]])) as WebhookHeaders;
}

export async function webhook(
  config: BillingConfig, store: BillingStore, polar: BillingPolar, body: Buffer, headers: WebhookHeaders,
) {
  let event: Awaited<ReturnType<typeof webhooks.validateEvent>>;
  try {
    event = await webhooks.validateEvent(body, headers, config.webhookSecret);
  } catch (error) {
    // A correctly signed event this API version doesn't know is not ours to handle.
    if (error instanceof webhooks.PolarWebhookUnknownTypeError) return;
    throw new BillingError(400, 'invalid_webhook');
  }
  if (!event.type.startsWith('subscription.')) return;
  const sub = event.data as models.Subscription;
  const userId = sub.customer?.external_id;
  // This endpoint may also receive events for customers this site didn't create.
  if (!isUuid(userId) || !isUuid(sub.customer_id)) return;

  // A replay or delayed event reads current provider state. Compare-and-swap
  // prevents a concurrent projection based on an older read from overwriting it.
  for (let i = 0; i < 5; i++) {
    const row = await store.byUser(userId);
    if (!row) return;
    const projection = projectSubscriptions(config, await listSubscriptions(polar, userId));
    if (await store.project(userId, row.projection_revision, sub.customer_id, projection)) return;
  }
  throw unavailable(); // Ask Polar to retry, rather than acknowledge an unwritten update.
}

export function readPlan(body: unknown): PaidPlan {
  if (!body || typeof body !== 'object' || Object.keys(body).length !== 1 ||
      !('plan' in body) || !isPaidPlan(body.plan)) {
    throw new BillingError(400, 'invalid_plan');
  }
  return body.plan;
}

