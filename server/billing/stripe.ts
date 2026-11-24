import Stripe from 'stripe';
import { isPaidPlan, PAID_PLANS, type PaidPlan } from '../../src/lib/billing-plans.js';
import { BillingError, type BillingConfig } from './config.js';
import { getAttempt, type BillingStore, type CheckoutAttempt, type SubscriptionProjection } from './store.js';

const RETRY_WINDOW_MS = 12 * 60 * 60 * 1000; // Stripe can prune idempotency keys after 24 hours.
const TERMINAL_SUBSCRIPTIONS = new Set(['canceled', 'incomplete_expired']);
const RETURN_PATH = '/pricing';

export function createBillingStripe(config: BillingConfig) {
  return new Stripe(config.stripeKey, { timeout: 8000, maxNetworkRetries: 1 });
}

export type BillingStripe = Pick<Stripe, 'customers' | 'prices' | 'coupons' | 'subscriptions' | 'checkout' | 'billingPortal' | 'webhooks'>;

const unavailable = () => new BillingError(503, 'billing_unavailable');
const inProgress = () => new BillingError(409, 'checkout_in_progress');
const subscriptionExists = () => new BillingError(409, 'subscription_exists');
const misconfigured = () => new BillingError(503, 'billing_misconfigured');

function stripeId(object: string | { id: string } | null) {
  return typeof object === 'string' ? object : object?.id;
}

/** Every Stripe object must come from the configured mode: test objects in the sandbox, live objects in live billing. */
function assertMode(config: BillingConfig, object: { livemode: boolean }) {
  if (object.livemode !== config.live) throw misconfigured();
}

function canRetry(since: string) {
  const age = Date.now() - Date.parse(since);
  return Number.isFinite(age) && age >= -60_000 && age < RETRY_WINDOW_MS;
}

function hostedUrl(value: string | null, hostname: string) {
  if (!value) throw unavailable();
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.host !== hostname || url.username || url.password) throw misconfigured();
  return { url: value };
}

function annualPriceMatches(price: Stripe.Price, renewal: number, live: boolean) {
  return price.livemode === live && price.billing_scheme === 'per_unit' && price.currency === 'usd' &&
    price.type === 'recurring' && price.unit_amount === renewal && !price.custom_unit_amount &&
    !price.transform_quantity && price.recurring?.interval === 'year' &&
    price.recurring.interval_count === 1 && price.recurring.usage_type === 'licensed';
}

export function validateOffer(
  price: Stripe.Price, coupon: Stripe.Coupon | Stripe.DeletedCoupon, offer: BillingConfig['plans'][PaidPlan], live: boolean,
) {
  const product = price.product;
  if (price.id !== offer.price || !price.active || !annualPriceMatches(price, offer.renewal, live) ||
      typeof product === 'string' || product.deleted || !product.active || product.livemode !== live ||
      coupon.deleted || coupon.id !== offer.coupon || coupon.livemode !== live || !coupon.valid ||
      coupon.duration !== 'once' || coupon.currency !== 'usd' || coupon.percent_off !== null ||
      coupon.amount_off !== offer.renewal - offer.initial || coupon.applies_to?.products.length !== 1 ||
      coupon.applies_to.products[0] !== product.id) {
    throw misconfigured();
  }
}

async function listSubscriptions(config: BillingConfig, stripe: BillingStripe, customer: string) {
  const page = await stripe.subscriptions.list({ customer, status: 'all', limit: 100 });
  if (page.has_more) throw unavailable();
  for (const sub of page.data) assertOwnedSubscription(config, sub, customer);
  return page.data;
}

function assertOwnedSubscription(config: BillingConfig, sub: Stripe.Subscription, customer: string) {
  assertMode(config, sub);
  if (stripeId(sub.customer) !== customer) throw unavailable();
}

export function projectSubscriptions(config: BillingConfig, subscriptions: Stripe.Subscription[]): SubscriptionProjection {
  const candidates = subscriptions.map(sub => {
    assertMode(config, sub);
    const item = !sub.items.has_more && sub.items.data.length === 1 ? sub.items.data[0] : undefined;
    const plan = item?.quantity === 1 && !sub.pause_collection &&
      (sub.status === 'active' || sub.status === 'trialing')
      ? (['advanced', 'pro'] as const).find(
        name => config.plans[name].price === item.price.id && annualPriceMatches(item.price, config.plans[name].renewal, config.live),
      )
      : undefined;
    return {
      sub,
      plan,
      priority: plan === 'advanced' ? 4 : plan === 'pro' ? 3 : TERMINAL_SUBSCRIPTIONS.has(sub.status) ? 1 : 2,
    };
  });
  const first = candidates.sort((a, b) =>
    b.priority - a.priority || b.sub.created - a.sub.created || a.sub.id.localeCompare(b.sub.id),
  )[0];
  return first ? { plan: first.plan ?? 'free', status: first.sub.status, subscription_id: first.sub.id }
    : { plan: 'free', status: null, subscription_id: null };
}

async function ensureCustomer(config: BillingConfig, store: BillingStore, stripe: BillingStripe, userId: string) {
  let row = await store.byUser(userId);
  if (!row) {
    await store.reserveCustomer(userId);
    row = await store.byUser(userId);
  }
  if (!row) throw unavailable();
  if (row.customer_id) return row.customer_id;
  if (!canRetry(row.customer_started_at)) throw unavailable();
  // No mutable fields (e.g. email) may change between idempotent retries.
  const customer = await stripe.customers.create(
    { metadata: { fos_customer_key: row.customer_key } },
    { idempotencyKey: `fos-${config.mode}-customer-${row.customer_key}` },
  );
  assertMode(config, customer);
  if (customer.metadata.fos_customer_key !== row.customer_key) throw unavailable();
  const saved = await store.setCustomer(userId, row.customer_key, customer.id) ?? await store.byUser(userId);
  if (saved?.customer_id !== customer.id) throw unavailable();
  return customer.id;
}

function assertOwnedSession(config: BillingConfig, session: Stripe.Checkout.Session, customer: string) {
  assertMode(config, session);
  if (!session.id.startsWith(config.live ? 'cs_live_' : 'cs_test_') || stripeId(session.customer) !== customer || session.mode !== 'subscription') {
    throw unavailable();
  }
}

function checkoutUrl(config: BillingConfig, session: Stripe.Checkout.Session, attempt: CheckoutAttempt) {
  const offer = config.plans[attempt.plan];
  if (session.metadata?.fos_attempt !== attempt.id || session.metadata.fos_price !== offer.price ||
      session.metadata.fos_coupon !== offer.coupon || session.currency !== 'usd' ||
      session.amount_subtotal !== offer.renewal || session.amount_total !== offer.initial ||
      session.adaptive_pricing?.enabled !== false ||
      session.payment_method_types.length !== 1 || session.payment_method_types[0] !== 'card') {
    throw misconfigured();
  }
  return hostedUrl(session.url, 'checkout.stripe.com');
}

export function checkoutParams(config: BillingConfig, customer: string, attempt: CheckoutAttempt): Stripe.Checkout.SessionCreateParams {
  const offer = config.plans[attempt.plan];
  const { firstYear, renewal } = PAID_PLANS[attempt.plan];
  const returnUrl = new URL(RETURN_PATH, config.site).href;
  return {
    mode: 'subscription',
    customer,
    currency: 'usd',
    line_items: [{ price: offer.price, quantity: 1 }],
    discounts: [{ coupon: offer.coupon }],
    adaptive_pricing: { enabled: false },
    automatic_tax: { enabled: false },
    allowed_payment_method_types: ['card'],
    custom_text: { submit: { message: `US$${firstYear} for the first year, then US$${renewal} per year. Renews annually unless canceled.` } },
    metadata: { fos_attempt: attempt.id, fos_price: offer.price, fos_coupon: offer.coupon },
    success_url: `${returnUrl}?billing=success`,
    cancel_url: `${returnUrl}?billing=cancel`,
  };
}

async function confirmOffer(config: BillingConfig, stripe: BillingStripe, plan: PaidPlan) {
  const offer = config.plans[plan];
  const [price, coupon] = await Promise.all([
    stripe.prices.retrieve(offer.price, { expand: ['product'] }),
    stripe.coupons.retrieve(offer.coupon, { expand: ['applies_to'] }),
  ]);
  validateOffer(price, coupon, offer, config.live);
}

async function rememberSession(store: BillingStore, userId: string, attempt: CheckoutAttempt, session: string) {
  const row = await store.setSession(userId, attempt.id, session) ?? await store.byUser(userId);
  if (row?.checkout_id !== attempt.id || row.checkout_session_id !== session) throw inProgress();
}

export async function checkout(
  config: BillingConfig, store: BillingStore, stripe: BillingStripe, userId: string, plan: PaidPlan,
) {
  const customer = await ensureCustomer(config, store, stripe, userId);
  let offerVerified = false;
  for (let i = 0; i < 5; i++) {
    const row = await store.byUser(userId);
    if (row?.customer_id !== customer) throw unavailable();
    const attempt = getAttempt(row);
    if ((await listSubscriptions(config, stripe, customer)).some(sub => !TERMINAL_SUBSCRIPTIONS.has(sub.status))) {
      throw subscriptionExists();
    }
    if (attempt?.session_id) {
      const session = await stripe.checkout.sessions.retrieve(attempt.session_id);
      assertOwnedSession(config, session, customer);
      if (session.id !== attempt.session_id) throw unavailable();
      if (session.status === 'open') {
        if (attempt.plan !== plan) throw inProgress();
        return checkoutUrl(config, session, attempt);
      }
      if (session.status === 'complete') {
        const subId = stripeId(session.subscription);
        if (!subId) throw subscriptionExists();
        const sub = await stripe.subscriptions.retrieve(subId);
        assertOwnedSubscription(config, sub, customer);
        if (sub.id !== subId || !TERMINAL_SUBSCRIPTIONS.has(sub.status)) throw subscriptionExists();
      } else if (session.status !== 'expired') {
        throw unavailable();
      }
      // Only release an attempt whose provider session is definitively terminal.
      await store.clearCheckout(userId, attempt.id, session.id);
      continue;
    }

    const open = await stripe.checkout.sessions.list({ customer, status: 'open', limit: 100 });
    if (open.has_more) throw inProgress();
    const openSubscriptions = open.data.filter(session => session.mode === 'subscription');
    if (openSubscriptions.length > 0) {
      if (!attempt || openSubscriptions.length !== 1) throw inProgress();
      const [session] = openSubscriptions;
      assertOwnedSession(config, session, customer);
      if (session.status !== 'open' || session.metadata?.fos_attempt !== attempt.id) throw inProgress();
      await rememberSession(store, userId, attempt, session.id);
      if (attempt.plan !== plan) throw inProgress();
      return checkoutUrl(config, session, attempt);
    }

    if (attempt && attempt.plan !== plan) throw inProgress();
    if (!offerVerified) {
      await confirmOffer(config, stripe, plan);
      offerVerified = true;
    }
    if (!attempt) {
      await store.reserveCheckout(userId, customer, plan);
      // Re-read the winning attempt before communicating with Stripe.
      continue;
    }
    // Never use a fresh key after an ambiguous submission. An orphaned open session
    // can be recovered above; otherwise old attempts require operator reconciliation.
    if (!canRetry(attempt.started_at)) throw inProgress();
    const session = await stripe.checkout.sessions.create(checkoutParams(config, customer, attempt), {
      idempotencyKey: `fos-${config.mode}-checkout-${attempt.id}`,
    });
    assertOwnedSession(config, session, customer);
    await rememberSession(store, userId, attempt, session.id);
    // An idempotent response may be a snapshot from the original create call.
    const current = await stripe.checkout.sessions.retrieve(session.id);
    assertOwnedSession(config, current, customer);
    if (current.id !== session.id || current.status !== 'open') throw inProgress();
    return checkoutUrl(config, current, attempt);
  }
  throw inProgress();
}

export async function portal(config: BillingConfig, store: BillingStore, stripe: BillingStripe, userId: string) {
  const row = await store.byUser(userId);
  if (!row?.customer_id) throw new BillingError(404, 'no_billing_customer');
  const session = await stripe.billingPortal.sessions.create({
    customer: row.customer_id,
    return_url: new URL(RETURN_PATH, config.site).href,
    ...(config.portalConfiguration ? { configuration: config.portalConfiguration } : {}),
  });
  assertMode(config, session);
  if (session.customer !== row.customer_id) throw unavailable();
  return hostedUrl(session.url, 'billing.stripe.com');
}

export async function webhook(
  config: BillingConfig, store: BillingStore, stripe: BillingStripe, body: Buffer, signature: string,
) {
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, config.webhookSecret);
  } catch {
    throw new BillingError(400, 'invalid_webhook');
  }
  if (event.livemode !== config.live || event.account || event.context) throw new BillingError(400, 'invalid_webhook');
  const object = event.data?.object;
  if (!event.type?.startsWith('customer.subscription.')) return;
  if (object?.object !== 'subscription' || object.livemode !== config.live) throw new BillingError(400, 'invalid_webhook');
  const customer = stripeId(object.customer);
  if (!customer?.startsWith('cus_')) throw new BillingError(400, 'invalid_webhook');

  // A replay or delayed event reads current provider state. Compare-and-swap
  // prevents a concurrent projection based on an older read from overwriting it.
  for (let i = 0; i < 5; i++) {
    const row = await store.byCustomer(customer);
    if (!row) return; // This endpoint may also receive events for customers this site didn't create.
    const projection = projectSubscriptions(config, await listSubscriptions(config, stripe, customer));
    if (await store.project(row.user_id, customer, row.projection_revision, projection)) return;
  }
  throw unavailable(); // Ask Stripe to retry, rather than acknowledge an unwritten update.
}

export function readPlan(body: unknown): PaidPlan {
  if (!body || typeof body !== 'object' || Object.keys(body).length !== 1 ||
      !('plan' in body) || !isPaidPlan(body.plan)) {
    throw new BillingError(400, 'invalid_plan');
  }
  return body.plan;
}
