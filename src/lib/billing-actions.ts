import { useState } from 'react';
import type { MessageKey } from '../i18n';
import { isPolarHostedUrl } from './billing-hosts';
import type { PaidPlan } from './billing-plans';
import { billingMode } from './plan';

type Operation = 'checkout' | 'portal';

/**
 * Starts Polar checkout for a plan, or opens Polar's customer portal, and
 * sends the browser there. Only Polar's own hosted pages are accepted.
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
      if (!billingMode || typeof url !== 'string' || !isPolarHostedUrl(billingMode, url)) throw new Error('Unexpected hosted URL');
      window.location.assign(new URL(url).href);
    } catch {
      setError(operation === 'checkout' ? 'billing.checkoutError' : 'billing.portalError');
    } finally {
      setPending(null);
    }
  }

  return { pending, error, open, clearError: () => setError(null) };
}
