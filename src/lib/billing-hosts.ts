import type { BillingMode } from './billing-mode';

/**
 * Hosts that Polar's hosted checkout and customer portal pages are served
 * from. The server and the browser both refuse to send anyone elsewhere.
 */
export const POLAR_HOSTS: Record<BillingMode, readonly string[]> = {
  sandbox: ['sandbox.polar.sh'],
  live: ['polar.sh', 'buy.polar.sh'],
};

export function isPolarHostedUrl(mode: BillingMode, value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      POLAR_HOSTS[mode].includes(url.hostname);
  } catch {
    return false;
  }
}
