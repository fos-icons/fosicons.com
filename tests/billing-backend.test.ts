import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { once } from 'node:events';
import { PassThrough, Readable } from 'node:stream';
import Stripe from 'stripe';
import { describe, expect, it, vi } from 'vitest';
import { createBillingHandler } from '../api/billing/[action]';
import { readBillingConfig } from '../server/billing/config';
import type { BillingStore } from '../server/billing/store';
import { checkout, projectSubscriptions, validateOffer, webhook, type BillingStripe } from '../server/billing/stripe';

const env = {
  BILLING_SANDBOX_ENABLED: 'true',
  BILLING_SITE_URL: 'http://localhost:5173',
  STRIPE_SECRET_KEY: 'sk_test_fixture',
  STRIPE_WEBHOOK_SECRET: 'whsec_fixture',
  STRIPE_PRO_PRICE_ID: 'price_pro',
  STRIPE_ADVANCED_PRICE_ID: 'price_advanced',
  STRIPE_PRO_COUPON_ID: 'coupon_pro',
  STRIPE_ADVANCED_COUPON_ID: 'coupon_advanced',
  SUPABASE_URL: 'https://test.example',
  SUPABASE_SERVICE_ROLE_KEY: `fixture.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.fixture`,
};
const runtime = readBillingConfig(env);
const owner = 'a-user';
const customer = 'cus_fixture';
const auth = 'Bearer header.payload.signature';
const origin = runtime.site.origin;
const asStripe = (service: Partial<Record<keyof BillingStripe, unknown>>) => service as BillingStripe;
const rowFixture = (customerId: string | null = customer): NonNullable<Awaited<ReturnType<BillingStore['byUser']>>> => ({
  user_id: owner, customer_id: customerId, customer_key: 'customer-key', customer_started_at: new Date().toISOString(),
  checkout_id: null, checkout_plan: null, checkout_started_at: null, checkout_session_id: null,
  plan: 'free', status: null, subscription_id: null, projection_revision: 0, projected_at: null,
});
const price = (id = 'price_pro', amount = 6900) => ({
  id, livemode: false, active: true, product: { id: 'prod_pro', active: true, livemode: false },
  type: 'recurring', unit_amount: amount, currency: 'usd', billing_scheme: 'per_unit',
  recurring: { interval: 'year', interval_count: 1, usage_type: 'licensed' },
}) as Stripe.Price;
const coupon = () => ({
  id: 'coupon_pro', livemode: false, valid: true, duration: 'once', currency: 'usd',
  percent_off: null, amount_off: 2000, applies_to: { products: ['prod_pro'] },
}) as Stripe.Coupon;
const sub = (status: Stripe.Subscription['status'], itemPrice = price(), quantity = 1) => ({
  id: `sub_${status}`, status, customer, livemode: false, created: 1,
  items: { has_more: false, data: [{ price: itemPrice, quantity }] },
}) as Stripe.Subscription;

function replyThrough(
  handler: ReturnType<typeof createBillingHandler>, action: string, method: string,
  headers: IncomingMessage['headers'] = {}, raw: Buffer | Buffer[] = Buffer.alloc(0), settings = env,
) {
  const req = Object.assign(Readable.from(Array.isArray(raw) ? raw : [raw]), {
    method, url: `/api/billing/${action}`, headers,
  }) as unknown as IncomingMessage;
  let code: number;
  let responseHeaders: Record<string, string>;
  let payload: unknown;
  const res = {
    writeHead(status: number, values: Record<string, string>) {
      code = status;
      responseHeaders = values;
      return this;
    },
    end(text: string) { payload = JSON.parse(text); },
  } as unknown as ServerResponse;
  return handler(req, res, settings).then(() => ({ code, headers: responseHeaders, body: payload }));
}

describe('sandbox HTTP boundary', () => {
  it('rejects disabled/production mode and non-test secrets before accessing providers', async () => {
    const store = vi.fn();
    const stripe = vi.fn();
    const handle = createBillingHandler({ store, stripe });
    const production = { ...env, VERCEL_ENV: 'production' };
    expect(await replyThrough(handle, 'status', 'GET', {}, undefined, production))
      .toMatchObject({ code: 503, body: { error: 'billing_disabled' } });
    expect(await replyThrough(handle, 'status', 'GET', {}, undefined, { ...env, STRIPE_SECRET_KEY: 'sk_live_fixture' }))
      .toMatchObject({ code: 503, body: { error: 'billing_misconfigured' } });
    expect(await replyThrough(handle, 'status', 'GET', {}, undefined, { ...env, BILLING_SANDBOX_ENABLED: 'TRUE' }))
      .toMatchObject({ code: 503, body: { error: 'billing_disabled' } });
    expect(store).not.toHaveBeenCalled();
    expect(stripe).not.toHaveBeenCalled();
  });

  it('looks up only the verified user and treats a return URL as informational', async () => {
    const verifyUser = vi.fn().mockResolvedValue(owner);
    const byUser = vi.fn().mockResolvedValue(null);
    const handle = createBillingHandler({ store: () => ({ verifyUser, byUser }) as unknown as BillingStore, stripe: vi.fn() });
    expect(await replyThrough(handle, 'status?billing=success&user_id=other', 'GET', { authorization: auth }))
      .toEqual({ code: 200, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' },
        body: { plan: 'free', status: null } });
    expect(verifyUser).toHaveBeenCalledWith('header.payload.signature');
    expect(byUser).toHaveBeenCalledExactlyOnceWith(owner);
    expect(await replyThrough(handle, 'status', 'GET')).toMatchObject({ code: 401, body: { error: 'unauthorized' } });
    expect(await replyThrough(handle, 'status', 'POST')).toMatchObject({ code: 405, headers: { Allow: 'GET' } });
    expect(await replyThrough(handle, 'unknown', 'GET')).toMatchObject({ code: 404 });
  });

  it('rejects foreign origins and a body that tries to select a Stripe object', async () => {
    const verifyUser = vi.fn().mockResolvedValue(owner);
    const stripe = vi.fn();
    const handle = createBillingHandler({ store: () => ({ verifyUser }) as unknown as BillingStore, stripe });
    const headers = { authorization: auth, 'content-type': 'application/json', origin };
    expect(await replyThrough(handle, 'checkout', 'POST', { ...headers, origin: 'https://example.org' }))
      .toMatchObject({ code: 403, body: { error: 'invalid_origin' } });
    expect(verifyUser).not.toHaveBeenCalled();
    expect(await replyThrough(handle, 'checkout', 'POST', headers, Buffer.from('{"plan":"pro","price":"price_bad"}')))
      .toMatchObject({ code: 400, body: { error: 'invalid_plan' } });
    expect(await replyThrough(handle, 'checkout', 'POST', headers, [Buffer.alloc(800), Buffer.alloc(300)]))
      .toMatchObject({ code: 413, body: { error: 'body_too_large' } });
    expect(stripe).not.toHaveBeenCalled();
  });

  it('uses only the mapped user customer for the portal and checks the returned session', async () => {
    const create = vi.fn().mockResolvedValue({ livemode: false, customer, url: 'https://billing.stripe.com/p/test' });
    const stripe = asStripe({ billingPortal: { sessions: { create } } });
    const byUser = vi.fn().mockResolvedValue(rowFixture());
    const handle = createBillingHandler({ store: () => ({ verifyUser: async () => owner, byUser }) as unknown as BillingStore, stripe: () => stripe });
    const req = () => replyThrough(handle, 'portal?customer=cus_other', 'POST', { authorization: auth }, Buffer.from('{"customer":"cus_other"}'));
    expect(await req()).toMatchObject({ code: 200, body: { url: 'https://billing.stripe.com/p/test' } });
    expect(create).toHaveBeenCalledExactlyOnceWith({ customer, return_url: `${origin}/pricing` });
    create.mockResolvedValue({ livemode: true, customer, url: 'https://billing.stripe.com/p/test' });
    expect(await req()).toMatchObject({ code: 503, body: { error: 'billing_misconfigured' } });
    byUser.mockResolvedValue(null);
    expect(await req()).toMatchObject({ code: 404, body: { error: 'no_billing_customer' } });
  });
});

describe('sandbox Stripe Checkout', () => {
  it('requires the exact annual price and the matching fixed product coupon', () => {
    const offer = runtime.plans.pro;
    expect(() => validateOffer(price(), coupon(), offer)).not.toThrow();
    for (const bad of [
      { ...price(), active: false }, { ...price(), livemode: true }, { ...price(), billing_scheme: 'tiered' },
      { ...price(), currency: 'eur' }, { ...price(), unit_amount: 4900 },
      { ...price(), recurring: { ...price().recurring!, interval: 'month' } },
      { ...price(), recurring: { ...price().recurring!, usage_type: 'metered' } },
    ]) expect(() => validateOffer(bad, coupon(), offer)).toThrow('billing_misconfigured');
    for (const bad of [
      { ...coupon(), livemode: true }, { ...coupon(), valid: false }, { ...coupon(), amount_off: 3000 },
      { ...coupon(), percent_off: 10 }, { ...coupon(), duration: 'forever' },
      { ...coupon(), applies_to: { products: ['prod_other'] } },
    ]) expect(() => validateOffer(price(), bad, offer)).toThrow('billing_misconfigured');
  });

  it('serializes competing checkout plans and reuses the owned open Session', async () => {
    let row = rowFixture();
    const store = {
      byUser: async () => ({ ...row }),
      reserveCheckout: vi.fn(async (_id, _customer, plan) => {
        if (row.checkout_id) return null;
        row = { ...row, checkout_id: 'one-attempt', checkout_plan: plan, checkout_started_at: new Date().toISOString() };
        return { ...row };
      }),
      setSession: async (_id, _attempt, id) => (row = { ...row, checkout_session_id: id }),
    } satisfies Partial<BillingStore>;
    let session: Partial<Stripe.Checkout.Session> | undefined;
    let release!: () => void;
    let createStarted!: () => void;
    const ready = new Promise<void>(resolve => { createStarted = resolve; });
    const wait = new Promise<void>(resolve => { release = resolve; });
    const create = vi.fn(async (params: Stripe.Checkout.SessionCreateParams) => {
      createStarted();
      await wait;
      session = { id: 'cs_test_fixture', customer, livemode: false, mode: 'subscription', status: 'open',
        amount_subtotal: 6900, amount_total: 4900, currency: 'usd',
        metadata: Object.fromEntries(Object.entries(params.metadata ?? {}).map(([key, value]) => [key, String(value)])),
        adaptive_pricing: { enabled: false }, payment_method_types: ['card'], url: 'https://checkout.stripe.com/c/pay/cs_test_fixture' };
      return session;
    });
    const stripe = asStripe({
      prices: { retrieve: async () => price() },
      coupons: { retrieve: async () => coupon() },
      subscriptions: { list: async () => ({ data: [], has_more: false }) },
      checkout: { sessions: { create, list: async () => ({ data: [], has_more: false }), retrieve: async () => session } },
    });
    const db = store as unknown as BillingStore;
    const pending = checkout(runtime, db, stripe, owner, 'pro');
    await ready;
    await expect(checkout(runtime, db, stripe, owner, 'advanced')).rejects.toThrow('checkout_in_progress');
    release();
    expect(await pending).toEqual({ url: session?.url });
    expect(await checkout(runtime, db, stripe, owner, 'pro')).toEqual({ url: session?.url });
    expect(create).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      customer, mode: 'subscription', line_items: [{ price: 'price_pro', quantity: 1 }], currency: 'usd',
      discounts: [{ coupon: 'coupon_pro' }], allowed_payment_method_types: ['card'],
      adaptive_pricing: { enabled: false }, automatic_tax: { enabled: false },
      custom_text: { submit: { message: expect.stringMatching(/US\$49.*US\$69/) } },
      success_url: `${origin}/pricing?billing=success`, cancel_url: `${origin}/pricing?billing=cancel`,
    }), { idempotencyKey: 'fos-sandbox-checkout-one-attempt' });
  });

  it('blocks an unfinished provider subscription and fails closed on an old unsaved attempt', async () => {
    const row = { ...rowFixture(), checkout_id: 'old-attempt', checkout_plan: 'pro' as const,
      checkout_started_at: new Date(Date.now() - 13 * 3_600_000).toISOString() };
    const create = vi.fn();
    const list = vi.fn().mockResolvedValue({ data: [sub('incomplete')], has_more: false });
    const store = { byUser: async () => row } as unknown as BillingStore;
    const stripe = asStripe({
      prices: { retrieve: async () => price() }, coupons: { retrieve: async () => coupon() },
      subscriptions: { list },
      checkout: { sessions: { create, list: async () => ({ data: [], has_more: false }) } },
    });
    await expect(checkout(runtime, store, stripe, owner, 'pro')).rejects.toThrow('subscription_exists');
    list.mockResolvedValue({ data: [], has_more: false });
    await expect(checkout(runtime, store, stripe, owner, 'pro')).rejects.toThrow('checkout_in_progress');
    expect(create).not.toHaveBeenCalled();
  });
});

describe('sandbox webhook projection', () => {
  const instance = new Stripe(env.STRIPE_SECRET_KEY);
  const payload = (livemode = false, eventCustomer = customer) =>
    JSON.stringify({ id: 'evt_fixture', livemode, type: 'customer.subscription.updated',
      data: { object: { object: 'subscription', livemode, customer: eventCustomer, status: 'active' } } }, null, 2);
  const sign = (text: string) => instance.webhooks.generateTestHeaderString({ payload: text, secret: env.STRIPE_WEBHOOK_SECRET });

  it('verifies the raw bytes, rejects live events, and ignores unowned customer IDs', async () => {
    const byCustomer = vi.fn().mockResolvedValue(null);
    const handle = createBillingHandler({
      store: () => ({ byCustomer }) as unknown as BillingStore,
      stripe: () => asStripe({ webhooks: instance.webhooks }),
    });
    const send = (text: string, signature: string) => replyThrough(handle, 'webhook', 'POST', { 'stripe-signature': signature },
      [Buffer.from(text.slice(0, 12)), Buffer.from(text.slice(12))]);
    const testBody = payload(false, 'cus_unmapped');
    expect(await send(`${testBody} `, sign(testBody))).toMatchObject({ code: 400, body: { error: 'invalid_webhook' } });
    const liveBody = payload(true);
    expect(await send(liveBody, sign(liveBody))).toMatchObject({ code: 400, body: { error: 'invalid_webhook' } });
    expect(byCustomer).not.toHaveBeenCalled();
    expect(await send(testBody, sign(testBody))).toMatchObject({ code: 200, body: { received: true } });
    expect(byCustomer).toHaveBeenCalledExactlyOnceWith('cus_unmapped');
  });

  it('reads an IncomingMessage even after Vercel-style helpers buffer and replay its body', async () => {
    const handle = createBillingHandler({
      store: () => ({ byCustomer: async () => null }) as unknown as BillingStore,
      stripe: () => asStripe({ webhooks: instance.webhooks }),
    });
    const server = createServer(async (req, res) => {
      if (req.url?.includes('?replay')) {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk);
        const replay = new PassThrough();
        const originalOn = req.on.bind(req);
        req.read = replay.read.bind(replay);
        req.on = req.addListener = ((event: string, callback: (...args: unknown[]) => void) =>
          event === 'data' || event === 'end' ? replay.on(event, callback) : originalOn(event, callback)) as typeof req.on;
        Object.defineProperty(req, 'body', { get: () => { throw new Error('Parsed body must not be read'); } });
        replay.end(Buffer.concat(chunks));
      }
      await handle(req, res, env);
    }).listen(0, '127.0.0.1');
    try {
      await once(server, 'listening');
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
      const body = `${payload(false, 'cus_unmapped')}\n`;
      for (const query of ['', '?replay']) {
        const response = await fetch(`http://127.0.0.1:${address.port}/api/billing/webhook${query}`, {
          method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': sign(body) }, body,
        });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ received: true });
      }
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  it('projects only an eligible quantity-one paid plan', () => {
    expect(projectSubscriptions(runtime, [sub('past_due')])).toMatchObject({ plan: 'free', status: 'past_due' });
    expect(projectSubscriptions(runtime, [sub('active', price(), 2)])).toMatchObject({ plan: 'free', status: 'active' });
    expect(projectSubscriptions(runtime, [sub('active', price('price_unmapped'))])).toMatchObject({ plan: 'free', status: 'active' });
    expect(projectSubscriptions(runtime, [sub('active'), sub('trialing', price('price_advanced', 12900))]))
      .toMatchObject({ plan: 'advanced', status: 'trialing' });
  });

  it('makes replays and older notifications reconcile current state rather than overwrite newer data', async () => {
    let row = rowFixture();
    const db = {
      byCustomer: async () => ({ ...row }),
      project: vi.fn<BillingStore['project']>(async (_user, _customer, revision, projection) => {
        if (revision !== row.projection_revision) return false;
        row = { ...row, ...projection, projection_revision: revision + 1 };
        return true;
      }),
    } as unknown as BillingStore;
    let release!: (value: unknown) => void;
    let firstListStarted!: () => void;
    const firstList = new Promise<void>(resolve => { firstListStarted = resolve; });
    const list = vi.fn().mockImplementationOnce(() => new Promise(resolve => {
      release = resolve;
      firstListStarted();
    })).mockResolvedValue({ data: [sub('canceled')], has_more: false });
    const stripe = asStripe({ webhooks: instance.webhooks, subscriptions: { list } });
    const signed = payload();
    const signature = sign(signed);
    const notify = () => webhook(runtime, db, stripe, Buffer.from(signed), signature);
    const older = notify();
    await firstList;
    await notify();
    release({ data: [sub('active')], has_more: false });
    await older;
    await notify();
    expect(row).toMatchObject({ plan: 'free', status: 'canceled', projection_revision: 3 });
    expect(list).toHaveBeenCalledTimes(4);
    expect(db.project).toHaveBeenCalledWith(owner, customer, 0, expect.objectContaining({ plan: 'pro' }));
  });
});
