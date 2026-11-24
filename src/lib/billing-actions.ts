import { useState } from 'react';
import type { MessageKey } from '../i18n';
import type { PaidPlan } from './billing-plans';

type Operation = 'checkout' | 'portal';

const HOSTED_ORIGIN: Record<Operation, string> = {
  checkout: 'https://checkout.stripe.com',
  portal: 'https://billing.stripe.com',
};

/**
 * Starts Stripe Checkout for a plan, or opens the billing portal, and sends
 * the browser there. Only Stripe's own hosted pages are accepted as targets.
 */
export function useHostedBilling(token: string | null | undefined) {
  const [pending, setPending] = useState<Operation | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);

  async function open(operation: Operation, plan?: PaidPlan) {
    if (!token) return;
    setPending(operation);
    setError(null);
    try {
      const response = await fetch(`/api/billing/${operation}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, ...(plan ? { 'Content-Type': 'application/json' } : {}) },
        body: plan ? JSON.stringify({ plan }) : undefined,
      });
      if (operation === 'checkout' && response.status === 409) {
        setError('billing.checkoutConflict');
        return;
      }
      if (!response.ok) throw new Error('Unable to start hosted session');
      const { url } = await response.json();
      const target = new URL(url);
      if (target.origin !== HOSTED_ORIGIN[operation] || target.username || target.password) throw new Error('Unexpected hosted URL');
      window.location.assign(target.href);
    } catch {
      setError(operation === 'checkout' ? 'billing.checkoutError' : 'billing.portalError');
    } finally {
      setPending(null);
    }
  }

  return { pending, error, open, clearError: () => setError(null) };
}
