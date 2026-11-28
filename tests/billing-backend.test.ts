import { createHmac } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { once } from 'node:events';
import { PassThrough, Readable } from 'node:stream';
import type { models } from '@polar-sh/sdk/2026-10';
import { describe, expect, it, vi } from 'vitest';
import { createBillingHandler } from '../api/billing/[action]';
import { readBillingConfig } from '../server/billing/config';
import { checkout, checkoutParams, portal, projectSubscriptions, validateOffer, webhook, type BillingPolar } from '../server/billing/polar';
import type { BillingRow, BillingStore } from '../server/billing/store';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const PRO = uuid(1);
const PRO_DISCOUNT = uuid(2);
const ADVANCED = uuid(3);
const ADVANCED_DISCOUNT = uuid(4);
const owner = uuid(10);
const customerId = uuid(11);
const secret = `whsec_${Buffer.from('a-test-webhook-signing-secret').toString('base64')}`;

const env = {
  BILLING_MODE: 'sandbox',
  BILLING_SITE_URL: 'http://localhost:5173',
  POLAR_ACCESS_TOKEN: 'polar_oat_fixture',
  POLAR_WEBHOOK_SECRET: secret,
  POLAR_PRO_PRODUCT_ID: PRO,
  POLAR_PRO_DISCOUNT_ID: PRO_DISCOUNT,
  POLAR_ADVANCED_PRODUCT_ID: ADVANCED,
  POLAR_ADVANCED_DISCOUNT_ID: ADVANCED_DISCOUNT,
  SUPABASE_URL: 'https://test.example',
  SUPABASE_SERVICE_ROLE_KEY: `fixture.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.fixture`,
};
const runtime = readBillingConfig(env);
const auth = 'Bearer header.payload.signature';
const origin = runtime.site.origin;
const asPolar = (service: Partial<Record<keyof BillingPolar, unknown>>) => service as BillingPolar;
const rowFixture = (customer: string | null = customerId): BillingRow => ({
  user_id: owner, customer_id: customer, checkout_plan: null, checkout_started_at: null, checkout_id: null,
  plan: 'free', status: null, subscription_id: null, projection_revision: 0, projected_at: null,
});

const product = (id = PRO, amount = 6900) => ({
  id, is_archived: false, is_recurring: true, recurring_interval: 'year', recurring_interval_count: 1, trial_interval: null,
  prices: [{ id: uuid(20), amount_type: 'fixed', price_amount: amount, price_currency: 'usd', is_archived: false }],
}) as unknown as models.Product;
const discount = (id = PRO_DISCOUNT, productId = PRO, amount = 2000) => ({
  id, type: 'fixed', duration: 'once', amount, currency: 'usd', code: null, starts_at: null, ends_at: null,
  max_redemptions: null, redemptions_count: 0, products: [{ id: productId }],
}) as unknown as models.Discount;
const sub = (status: string, productId = PRO, extra: Partial<models.Subscription> = {}) => ({
  id: uuid(30 + status.length), status, product_id: productId, customer_id: customerId,
  recurring_interval: 'year', recurring_interval_count: 1, paused_at: null, created_at: '2026-11-01T00:00:00Z',
  customer: { id: customerId, external_id: owner }, ...extra,
}) as unknown as models.Subscription;
const page = <T>(items: T[]) => ({ items, pagination: { total_count: items.length, max_page: 1 } });
const openCheckout = (plan: 'pro' | 'advanced' = 'pro', extra: Partial<models.Checkout> = {}) => ({
  id: uuid(40), status: 'open', expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  url: 'https://sandbox.polar.sh/checkout/polar_c_fixture', external_customer_id: owner, metadata: { fos_plan: plan },
  product_id: plan === 'pro' ? PRO : ADVANCED, discount_id: plan === 'pro' ? PRO_DISCOUNT : ADVANCED_DISCOUNT,
  allow_discount_codes: false, currency: 'usd',
  amount: plan === 'pro' ? 6900 : 12900, discount_amount: plan === 'pro' ? 2000 : 3000, net_amount: plan === 'pro' ? 4900 : 9900,
  ...extra,
}) as unknown as models.Checkout;

/** Signs a body the way Polar does (Standard Webhooks). */
function signed(body: string, key = secret) {
  const id = 'msg_fixture';
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', Buffer.from(key.slice('whsec_'.length), 'base64'))
    .update(`${id}.${timestamp}.${body}`).digest('base64');
  return { 'webhook-id': id, 'webhook-timestamp': timestamp, 'webhook-signature': `v1,${signature}` };
}
const event = (externalId: string | null = owner, type = 'subscription.updated') => JSON.stringify({
  type, timestamp: new Date().toISOString(),
  data: { ...sub('active'), customer: { id: customerId, external_id: externalId } },
});

function replyThrough(
  handler: ReturnType<typeof createBillingHandler>, action: string, method: string,
  headers: IncomingMessage['headers'] = {}, raw: Buffer | Buffer[] = Buffer.alloc(0), settings: NodeJS.ProcessEnv = env,
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
  it('rejects disabled/production mode and bad settings before accessing providers', async () => {
    const store = vi.fn();
    const polar = vi.fn();
    const handle = createBillingHandler({ store, polar });
    expect(await replyThrough(handle, 'status', 'GET', {}, undefined, { ...env, VERCEL_ENV: 'production' }))
      .toMatchObject({ code: 503, body: { error: 'billing_disabled' } });
    expect(await replyThrough(handle, 'status', 'GET', {}, undefined, { ...env, POLAR_ACCESS_TOKEN: 'sk_test_fixture' }))
      .toMatchObject({ code: 503, body: { error: 'billing_misconfigured' } });
    expect(await replyThrough(handle, 'status', 'GET', {}, undefined, { ...env, POLAR_PRO_DISCOUNT_ID: PRO }))
      .toMatchObject({ code: 503, body: { error: 'billing_misconfigured' } });
    expect(await replyThrough(handle, 'status', 'GET', {}, undefined, { ...env, BILLING_MODE: 'SANDBOX' }))
      .toMatchObject({ code: 503, body: { error: 'billing_disabled' } });
    expect(store).not.toHaveBeenCalled();
    expect(polar).not.toHaveBeenCalled();
  });

  it('looks up only the verified user and treats a return URL as informational', async () => {
    const verifyUser = vi.fn().mockResolvedValue(owner);
    const byUser = vi.fn().mockResolvedValue(null);
    const handle = createBillingHandler({ store: () => ({ verifyUser, byUser }) as unknown as BillingStore, polar: vi.fn() });
    expect(await replyThrough(handle, 'status?billing=success&user_id=other', 'GET', { authorization: auth }))
      .toEqual({ code: 200, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' },
        body: { plan: 'free', status: null, entitlement: 'free' } });
    expect(verifyUser).toHaveBeenCalledWith('header.payload.signature');
    expect(byUser).toHaveBeenCalledExactlyOnceWith(owner);
    expect(await replyThrough(handle, 'status', 'GET')).toMatchObject({ code: 401, body: { error: 'unauthorized' } });
    expect(await replyThrough(handle, 'status', 'POST')).toMatchObject({ code: 405, headers: { Allow: 'GET' } });
    expect(await replyThrough(handle, 'unknown', 'GET')).toMatchObject({ code: 404 });
  });

  it('reports the plan a stored status unlocks, and nothing for a lapsed subscription', async () => {
    const verifyUser = vi.fn().mockResolvedValue(owner);
    const byUser = vi.fn().mockResolvedValueOnce({ ...rowFixture(), plan: 'advanced', status: 'active' })
      .mockResolvedValueOnce({ ...rowFixture(), plan: 'pro', status: 'past_due' });
    const handle = createBillingHandler({ store: () => ({ verifyUser, byUser }) as unknown as BillingStore, polar: vi.fn() });
    expect(await replyThrough(handle, 'status', 'GET', { authorization: auth }))
      .toMatchObject({ code: 200, body: { plan: 'advanced', status: 'active', entitlement: 'advanced' } });
    expect(await replyThrough(handle, 'status', 'GET', { authorization: auth }))
      .toMatchObject({ code: 200, body: { plan: 'pro', status: 'past_due', entitlement: 'free' } });
  });

  it('rejects foreign origins and a body that tries to select a Polar object', async () => {
    const verifyUser = vi.fn().mockResolvedValue(owner);
    const polar = vi.fn();
    const handle = createBillingHandler({ store: () => ({ verifyUser }) as unknown as BillingStore, polar });
    const headers = { authorization: auth, 'content-type': 'application/json', origin };
    expect(await replyThrough(handle, 'checkout', 'POST', { ...headers, origin: 'https://example.org' }))
      .toMatchObject({ code: 403, body: { error: 'invalid_origin' } });
    expect(verifyUser).not.toHaveBeenCalled();
    expect(await replyThrough(handle, 'checkout', 'POST', headers, Buffer.from(`{"plan":"pro","product":"${ADVANCED}"}`)))
      .toMatchObject({ code: 400, body: { error: 'invalid_plan' } });
    expect(await replyThrough(handle, 'checkout', 'POST', headers, [Buffer.alloc(800), Buffer.alloc(300)]))
      .toMatchObject({ code: 413, body: { error: 'body_too_large' } });
    expect(polar).not.toHaveBeenCalled();
  });

  it('opens the portal only for the signed-in user and checks the returned session', async () => {
    const session = { customer_id: customerId, customer: { external_id: owner }, customer_portal_url: 'https://sandbox.polar.sh/fos/portal?customer_session_token=x' };
    const create = vi.fn().mockResolvedValue(session);
    const polar = asPolar({ customerSessions: { create } });
    const byUser = vi.fn().mockResolvedValue(rowFixture());
    const handle = createBillingHandler({ store: () => ({ verifyUser: async () => owner, byUser }) as unknown as BillingStore, polar: () => polar });
    const req = () => replyThrough(handle, 'portal?customer=other', 'POST', { authorization: auth }, Buffer.from('{"customer":"other"}'));
    expect(await req()).toMatchObject({ code: 200, body: { url: session.customer_portal_url } });
    expect(create).toHaveBeenCalledExactlyOnceWith({ external_customer_id: owner, return_url: `${origin}/pricing` });
    create.mockResolvedValue({ ...session, customer_portal_url: 'https://polar.sh/fos/portal' });
    expect(await req()).toMatchObject({ code: 503, body: { error: 'billing_misconfigured' } });
    create.mockRejectedValue(Object.assign(new Error('not found'), { statusCode: 404 }));
    expect(await req()).toMatchObject({ code: 404, body: { error: 'no_billing_customer' } });
    byUser.mockResolvedValue(rowFixture(null));
    expect(await req()).toMatchObject({ code: 404, body: { error: 'no_billing_customer' } });
  });
});

describe('billing mode', () => {
  const liveEnv = { ...env, BILLING_MODE: 'live', VERCEL_ENV: 'production', BILLING_SITE_URL: 'https://fosicons.com' };

  it('runs the sandbox only off production and live billing only on production, against matching Polar servers', () => {
    expect(runtime).toMatchObject({ mode: 'sandbox', live: false, server: 'sandbox' });
    expect(readBillingConfig({ ...env, BILLING_MODE: undefined, BILLING_SANDBOX_ENABLED: 'true' })).toMatchObject({ mode: 'sandbox' });
    expect(readBillingConfig(liveEnv)).toMatchObject({ mode: 'live', live: true, server: 'production' });
    for (const [settings, error] of [
      [{ ...liveEnv, VERCEL_ENV: 'preview' }, 'billing_disabled'],
      [{ ...liveEnv, VERCEL_ENV: undefined }, 'billing_disabled'],
      [{ ...env, VERCEL_ENV: 'production' }, 'billing_disabled'],
      [{ ...liveEnv, BILLING_MODE: 'LIVE' }, 'billing_disabled'],
      [{ ...liveEnv, BILLING_SITE_URL: 'http://localhost:5173' }, 'billing_misconfigured'],
      [{ ...liveEnv, BILLING_SITE_URL: 'http://fosicons.com' }, 'billing_misconfigured'],
      [{ ...liveEnv, POLAR_WEBHOOK_SECRET: '' }, 'billing_misconfigured'],
      [{ ...liveEnv, POLAR_ADVANCED_PRODUCT_ID: 'prod_advanced' }, 'billing_misconfigured'],
    ] as const) expect(() => readBillingConfig(settings), JSON.stringify(settings)).toThrow(error);
  });

  it('logs which settings are wrong by name, never their values', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const bad = { ...liveEnv, POLAR_ACCESS_TOKEN: ' polar_oat_secret-value', POLAR_PRO_PRODUCT_ID: `${PRO} ` };
      expect(() => readBillingConfig(bad)).toThrow('billing_misconfigured');
      const message = warn.mock.calls.flat().join(' ');
      expect(message).toContain('POLAR_ACCESS_TOKEN');
      expect(message).toContain('POLAR_PRO_PRODUCT_ID');
      expect(message).not.toContain('POLAR_ADVANCED_PRODUCT_ID');
      expect(message).not.toContain('secret-value');
      expect(message).not.toContain(PRO);
      warn.mockClear();
      expect(() => readBillingConfig({ ...liveEnv, BILLING_MODE: 'live ' })).toThrow('billing_disabled');
      expect(warn.mock.calls.flat().join(' ')).toContain('BILLING_MODE is not exactly');
      warn.mockClear();
      expect(() => readBillingConfig({ ...liveEnv, VERCEL_ENV: undefined })).toThrow('billing_disabled');
      expect(warn.mock.calls.flat().join(' ')).toContain('VERCEL_ENV');
    } finally {
      warn.mockRestore();
    }
  });

  it('hands out only polar.sh pages in live mode', async () => {
    const live = readBillingConfig(liveEnv);
    const store = { ensureRow: vi.fn(), claimCheckout: async () => true, setCheckout: vi.fn() } as unknown as BillingStore;
    const polar = (url: string) => asPolar({
      subscriptions: { list: async () => page([]) },
      checkouts: { list: async () => page([]), create: async () => openCheckout('pro', { url }) },
      products: { get: async () => product() }, discounts: { get: async () => discount() },
    });
    await expect(checkout(live, store, polar('https://sandbox.polar.sh/checkout/x'), owner, 'pro')).rejects.toThrow('billing_misconfigured');
    expect(await checkout(live, store, polar('https://polar.sh/checkout/x'), owner, 'pro')).toEqual({ url: 'https://polar.sh/checkout/x' });
  });
});

describe('sandbox Polar checkout', () => {
  it('requires the yearly renewal price and the matching one-time fixed discount', () => {
    const offer = runtime.plans.pro;
    expect(() => validateOffer(product(), discount(), offer)).not.toThrow();
    const price = product().prices[0];
    for (const bad of [
      { ...product(), is_archived: true }, { ...product(), recurring_interval: 'month' },
      { ...product(), trial_interval: 'day' }, { ...product(), id: ADVANCED },
      { ...product(), prices: [{ ...price, price_amount: 4900 }] },
      { ...product(), prices: [{ ...price, price_currency: 'eur' }] },
      { ...product(), prices: [{ ...price, amount_type: 'custom' }] },
      { ...product(), prices: [price, { ...price, id: uuid(21) }] },
    ]) expect(() => validateOffer(bad as models.Product, discount(), offer)).toThrow('billing_misconfigured');
    for (const bad of [
      { ...discount(), amount: 3000 }, { ...discount(), type: 'percentage' }, { ...discount(), duration: 'forever' },
      { ...discount(), code: 'LAUNCH' }, { ...discount(), currency: 'eur' },
      { ...discount(), products: [{ id: ADVANCED }] }, { ...discount(), products: [{ id: PRO }, { id: ADVANCED }] },
      { ...discount(), ends_at: '2020-01-01T00:00:00Z' }, { ...discount(), max_redemptions: 1, redemptions_count: 1 },
    ]) expect(() => validateOffer(product(), bad as models.Discount, offer)).toThrow('billing_misconfigured');
  });

  it('creates one checkout for the signed-in user with the discount applied, and reuses it', async () => {
    let lease = false;
    const store = {
      ensureRow: vi.fn(),
      claimCheckout: vi.fn(async () => (lease ? false : (lease = true))),
      setCheckout: vi.fn(),
    } as unknown as BillingStore;
    let created: models.Checkout | undefined;
    const create = vi.fn(async (params: models.CheckoutCreate) => (created = openCheckout(params.metadata?.fos_plan as 'pro')));
    const polar = asPolar({
      subscriptions: { list: async () => page([]) },
      checkouts: { list: async () => page(created ? [created] : []), create },
      products: { get: async () => product() }, discounts: { get: async () => discount() },
    });
    expect(await checkout(runtime, store, polar, owner, 'pro')).toEqual({ url: 'https://sandbox.polar.sh/checkout/polar_c_fixture' });
    expect(await checkout(runtime, store, polar, owner, 'pro')).toEqual({ url: 'https://sandbox.polar.sh/checkout/polar_c_fixture' });
    await expect(checkout(runtime, store, polar, owner, 'advanced')).rejects.toThrow('checkout_in_progress');
    expect(create).toHaveBeenCalledExactlyOnceWith({
      products: [PRO], discount_id: PRO_DISCOUNT, allow_discount_codes: false, allow_trial: false, currency: 'usd',
      external_customer_id: owner, metadata: { fos_plan: 'pro' },
      success_url: `${origin}/pricing?billing=success`, return_url: `${origin}/pricing?billing=cancel`,
    });
    expect(store.setCheckout).toHaveBeenCalledExactlyOnceWith(owner, uuid(40));
  });

  it('refuses a second subscription, a held lease, and a checkout that charges the wrong amount', async () => {
    const create = vi.fn().mockResolvedValue(openCheckout('pro', { net_amount: 6900, discount_amount: 0 }));
    const list = vi.fn().mockResolvedValue(page([sub('incomplete')]));
    const claimCheckout = vi.fn().mockResolvedValue(false);
    const store = { ensureRow: vi.fn(), claimCheckout, setCheckout: vi.fn() } as unknown as BillingStore;
    const polar = asPolar({
      subscriptions: { list }, checkouts: { list: async () => page([]), create },
      products: { get: async () => product() }, discounts: { get: async () => discount() },
    });
    await expect(checkout(runtime, store, polar, owner, 'pro')).rejects.toThrow('subscription_exists');
    list.mockResolvedValue(page([sub('canceled')]));
    await expect(checkout(runtime, store, polar, owner, 'pro')).rejects.toThrow('checkout_in_progress');
    expect(create).not.toHaveBeenCalled();
    claimCheckout.mockResolvedValue(true);
    await expect(checkout(runtime, store, polar, owner, 'pro')).rejects.toThrow('billing_misconfigured');
    expect(store.setCheckout).not.toHaveBeenCalled();
  });

  it('sends the advertised prices to Polar', () => {
    expect(checkoutParams(runtime, owner, 'advanced')).toMatchObject({ products: [ADVANCED], discount_id: ADVANCED_DISCOUNT });
  });
});

describe('sandbox webhook projection', () => {
  const idle = () => asPolar({ subscriptions: { list: async () => page([]) } });

  it('verifies the raw bytes and ignores customers this site did not create', async () => {
    const byUser = vi.fn().mockResolvedValue(null);
    const handle = createBillingHandler({ store: () => ({ byUser }) as unknown as BillingStore, polar: idle });
    const send = (text: string, headers: IncomingMessage['headers']) => replyThrough(handle, 'webhook', 'POST', headers,
      [Buffer.from(text.slice(0, 12)), Buffer.from(text.slice(12))]);
    const body = event();
    expect(await send(`${body} `, signed(body))).toMatchObject({ code: 400, body: { error: 'invalid_webhook' } });
    expect(await send(body, signed(body, `whsec_${Buffer.from('another-secret-entirely').toString('base64')}`)))
      .toMatchObject({ code: 400, body: { error: 'invalid_webhook' } });
    expect(await send(body, {})).toMatchObject({ code: 400, body: { error: 'invalid_webhook' } });
    expect(byUser).not.toHaveBeenCalled();
    const foreign = event('someone-else');
    expect(await send(foreign, signed(foreign))).toMatchObject({ code: 200, body: { received: true } });
    expect(byUser).not.toHaveBeenCalled();
    expect(await send(body, signed(body))).toMatchObject({ code: 200, body: { received: true } });
    expect(byUser).toHaveBeenCalledExactlyOnceWith(owner);
  });

  it('reads an IncomingMessage even after Vercel-style helpers buffer and replay its body', async () => {
    const handle = createBillingHandler({ store: () => ({ byUser: async () => null }) as unknown as BillingStore, polar: idle });
    const server = createServer(async (req, res) => {
      if (req.url?.includes('?replay')) {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk);
        const replay = new PassThrough();
        const originalOn = req.on.bind(req);
        req.read = replay.read.bind(replay);
        req.on = req.addListener = ((name: string, callback: (...args: unknown[]) => void) =>
          name === 'data' || name === 'end' ? replay.on(name, callback) : originalOn(name, callback)) as typeof req.on;
        Object.defineProperty(req, 'body', { get: () => { throw new Error('Parsed body must not be read'); } });
        replay.end(Buffer.concat(chunks));
      }
      await handle(req, res, env);
    }).listen(0, '127.0.0.1');
    try {
      await once(server, 'listening');
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
      const body = `${event()}\n`;
      for (const query of ['', '?replay']) {
        const response = await fetch(`http://127.0.0.1:${address.port}/api/billing/webhook${query}`, {
          method: 'POST', headers: { 'content-type': 'application/json', ...signed(body) }, body,
        });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ received: true });
      }
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  it('projects only an active yearly subscription to a configured product', () => {
    expect(projectSubscriptions(runtime, [sub('past_due')])).toMatchObject({ plan: 'free', status: 'past_due' });
    expect(projectSubscriptions(runtime, [sub('active', uuid(99))])).toMatchObject({ plan: 'free', status: 'active' });
    expect(projectSubscriptions(runtime, [sub('active', PRO, { recurring_interval: 'month' })])).toMatchObject({ plan: 'free' });
    expect(projectSubscriptions(runtime, [sub('active', PRO, { paused_at: '2026-11-01T00:00:00Z' })])).toMatchObject({ plan: 'free' });
    expect(projectSubscriptions(runtime, [sub('active'), sub('trialing', ADVANCED)])).toMatchObject({ plan: 'advanced', status: 'trialing' });
    expect(projectSubscriptions(runtime, [])).toEqual({ plan: 'free', status: null, subscription_id: null });
  });

  it('makes replays and older notifications reconcile current state rather than overwrite newer data', async () => {
    let row = rowFixture(null);
    const db = {
      byUser: async () => ({ ...row }),
      project: vi.fn<BillingStore['project']>(async (_user, revision, customer, projection) => {
        if (revision !== row.projection_revision) return false;
        row = { ...row, ...projection, customer_id: customer, projection_revision: revision + 1 };
        return true;
      }),
    } as unknown as BillingStore;
    let release!: (value: unknown) => void;
    let firstListStarted!: () => void;
    const firstList = new Promise<void>(resolve => { firstListStarted = resolve; });
    const list = vi.fn().mockImplementationOnce(() => new Promise(resolve => {
      release = resolve;
      firstListStarted();
    })).mockResolvedValue(page([sub('canceled')]));
    const polar = asPolar({ subscriptions: { list } });
    const body = event();
    const notify = () => webhook(runtime, db, polar, Buffer.from(body), signed(body));
    const older = notify();
    await firstList;
    await notify();
    release(page([sub('active')]));
    await older;
    await notify();
    expect(row).toMatchObject({ plan: 'free', status: 'canceled', customer_id: customerId, projection_revision: 3 });
    expect(list).toHaveBeenCalledTimes(4);
    expect(list).toHaveBeenCalledWith({ external_customer_id: owner, limit: 100 });
    expect(db.project).toHaveBeenCalledWith(owner, 0, customerId, expect.objectContaining({ plan: 'pro' }));
  });

  it('ignores signed events that are not about subscriptions', async () => {
    const byUser = vi.fn();
    const body = event(owner, 'checkout.updated');
    await webhook(runtime, { byUser } as unknown as BillingStore, idle(), Buffer.from(body), signed(body));
    expect(byUser).not.toHaveBeenCalled();
  });
});

describe('portal', () => {
  it('requires a Polar customer recorded from a webhook', async () => {
    const store = { byUser: async () => rowFixture(null) } as unknown as BillingStore;
    await expect(portal(runtime, store, asPolar({}), owner)).rejects.toThrow('no_billing_customer');
  });
});
