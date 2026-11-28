import type { IncomingMessage, ServerResponse } from 'node:http';
import { BillingError, readBillingConfig, type BillingConfig } from '../../server/billing/config.js';
import { createBillingStore, type BillingStore } from '../../server/billing/store.js';
import { checkout, createBillingPolar, portal, readPlan, readWebhookHeaders, webhook, type BillingPolar } from '../../server/billing/polar.js';
import { entitledPlan } from '../../src/lib/entitlements.js';

export const config = { api: { bodyParser: false } };

const MAX_CHECKOUT_BYTES = 1024;
const MAX_WEBHOOK_BYTES = 1024 * 1024;
const ROUTE = /^\/api\/billing\/(checkout|portal|status|webhook)\/?$/;

function reply(res: ServerResponse, status: number, body: object, headers: Record<string, string> = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8', ...headers })
    .end(JSON.stringify(body));
}

async function rawBody(req: IncomingMessage, limit: number) {
  if (Number(req.headers['content-length']) > limit) throw new BillingError(413, 'body_too_large');
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    const fail = (error: BillingError) => {
      if (settled) return;
      settled = true;
      chunks.length = 0;
      reject(error);
    };
    const interrupted = () => fail(new BillingError(400, 'invalid_body'));
    if (req.aborted) return interrupted();
    req.on('error', interrupted);
    req.on('aborted', interrupted);
    // Vercel's Node helpers can replay the body via these events after consuming
    // the original stream. Never access the parsed req.body or use an iterator.
    req.on('end', () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks, size));
    });
    req.on('data', (chunk: unknown) => {
      if (settled) return;
      // Do not re-encode a decoded body for signature verification.
      if (!Buffer.isBuffer(chunk)) return interrupted();
      size += chunk.length;
      if (size > limit) return fail(new BillingError(413, 'body_too_large'));
      chunks.push(chunk);
    });
  });
}

function parseJson(body: Buffer): unknown {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
  } catch {
    throw new BillingError(400, 'invalid_body');
  }
}

function bearer(req: IncomingMessage) {
  const value = req.headers.authorization ?? '';
  const jwt = /^Bearer ([\w-]+\.[\w-]+\.[\w-]+)$/i.exec(value);
  if (!jwt || value.length > 16_384) throw new BillingError(401, 'unauthorized');
  return jwt[1];
}

type BillingDependencies = {
  store: (config: BillingConfig) => BillingStore;
  polar: (config: BillingConfig) => BillingPolar;
};

export function createBillingHandler(deps: BillingDependencies) {
  return async function billing(req: IncomingMessage, res: ServerResponse, env: NodeJS.ProcessEnv = process.env) {
    const action = ROUTE.exec(req.url?.split('?')[0] ?? '')?.[1];
    if (!action) return reply(res, 404, { error: 'not_found' });
    const method = action === 'status' ? 'GET' : 'POST';
    if (req.method !== method) return reply(res, 405, { error: 'method_not_allowed' }, { Allow: method });
    try {
      const runtime = readBillingConfig(env);
      if (action === 'webhook') {
        const headers = readWebhookHeaders(req.headers);
        const body = await rawBody(req, MAX_WEBHOOK_BYTES);
        await webhook(runtime, deps.store(runtime), deps.polar(runtime), body, headers);
        return reply(res, 200, { received: true });
      }

      const origin = req.headers.origin;
      if (origin !== undefined && origin !== runtime.site.origin) throw new BillingError(403, 'invalid_origin');
      const token = bearer(req);
      const store = deps.store(runtime);
      const userId = await store.verifyUser(token);
      if (action === 'status') {
        const row = await store.byUser(userId);
        const status = { plan: row?.plan ?? 'free', status: row?.status ?? null };
        // `entitlement` is the plan whose features this status unlocks.
        return reply(res, 200, { ...status, entitlement: entitledPlan(status) });
      }
      if (action === 'portal') return reply(res, 200, await portal(runtime, store, deps.polar(runtime), userId));
      const mediaType = req.headers['content-type']?.split(';')[0].trim().toLowerCase();
      if (mediaType !== 'application/json') throw new BillingError(415, 'unsupported_media_type');
      const plan = readPlan(parseJson(await rawBody(req, MAX_CHECKOUT_BYTES)));
      return reply(res, 200, await checkout(runtime, store, deps.polar(runtime), userId, plan));
    } catch (error) {
      if (error instanceof BillingError) return reply(res, error.status, { error: error.code });
      // SDK failures may contain credentials, request data or provider URLs.
      if (action === 'portal' && error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
        return reply(res, 404, { error: 'no_billing_customer' });
      }
      console.error('Billing provider request failed', action);
      return reply(res, 502, { error: 'billing_unavailable' });
    }
  };
}

/** Node entry point shared by Vercel and the Vite middleware. */
export const handleBilling = createBillingHandler({ store: createBillingStore, polar: createBillingPolar });
export default handleBilling;
