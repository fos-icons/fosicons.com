import type { Session } from '@supabase/supabase-js';
import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui';
import { useI18n, type MessageKey } from '../i18n';
import { getBillingClient } from '../lib/billing-client';
import { isPaidPlan, PAID_PLANS, type PaidPlan } from '../lib/billing-plans';
import { usePlan } from '../lib/plan';


type Plan = PaidPlan | 'free';
type Operation = 'checkout' | 'portal' | 'signOut';

function Account({ session }: { session: Session }) {
  const { t } = useI18n();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Operation | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  const token = session.access_token;
  const { refresh: refreshPlan } = usePlan();

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch('/api/billing/status', {
          headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
        });
        if (!response.ok) throw new Error('Unable to read subscription');
        const data = await response.json();
        if (data.plan !== 'free' && !isPaidPlan(data.plan)) throw new Error('Unknown plan');
        if (!controller.signal.aborted) {
          setPlan(data.plan);
          setHasSubscription(typeof data.status === 'string');
        }
      } catch {
        if (!controller.signal.aborted) {
          setPlan(null);
          setHasSubscription(false);
          setError('billing.statusError');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [token, refresh]);

  async function openBilling(operation: 'checkout' | 'portal', selected?: PaidPlan) {
    setPending(operation);
    setError(null);
    try {
      const response = await fetch(`/api/billing/${operation}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, ...(selected ? { 'Content-Type': 'application/json' } : {}) },
        body: selected ? JSON.stringify({ plan: selected }) : undefined,
      });
      if (operation === 'checkout' && response.status === 409) {
        setError('billing.checkoutConflict');
        return;
      }
      if (!response.ok) throw new Error('Unable to start hosted session');
      const { url } = await response.json();
      const target = new URL(url);
      const expectedOrigin = operation === 'checkout' ? 'https://checkout.stripe.com' : 'https://billing.stripe.com';
      if (target.origin !== expectedOrigin || target.username || target.password) throw new Error('Unexpected hosted URL');
      window.location.assign(target.href);
    } catch {
      setError(operation === 'checkout' ? 'billing.checkoutError' : 'billing.portalError');
    } finally {
      setPending(null);
    }
  }

  async function signOut() {
    setPending('signOut');
    setError(null);
    try {
      const result = await getBillingClient().auth.signOut({ scope: 'local' });
      if (result.error) setError('billing.signOutError');
    } catch {
      setError('billing.signOutError');
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      <p role="status">
        {loading ? t('billing.reading') : plan ? t('billing.subscription', { plan: t(`pricing.plan.${plan}`) }) : ''}
      </p>
      <div className="pricing-sandbox-actions">
        {plan === 'free' && Object.keys(PAID_PLANS).filter(isPaidPlan).map((id) => (
          <Button key={id} disabled={loading || pending !== null} onClick={() => void openBilling('checkout', id)}>
            {t('billing.checkout', { plan: t(`pricing.plan.${id}`) })}
          </Button>
        ))}
        {(hasSubscription || (plan && plan !== 'free')) && (
          <Button disabled={loading || pending !== null} onClick={() => void openBilling('portal')}>{t('billing.portal')}</Button>
        )}
        <Button disabled={loading || pending !== null} onClick={() => { setLoading(true); setError(null); setRefresh(refresh + 1); refreshPlan(); }}>
          {t('billing.refresh')}
        </Button>
        <Button variant="quiet" disabled={pending !== null} onClick={() => void signOut()}>{t('billing.signOut')}</Button>
      </div>
      {error && <p role="alert">{t(error)}</p>}
    </>
  );
}

function TestSignIn() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const errorKey = sent ? 'billing.verifyError' : 'billing.sendError';
    try {
      const { auth } = getBillingClient();
      const address = email.trim();
      const result = sent
        ? await auth.verifyOtp({ type: 'email', email: address, token: code.trim() })
        : await auth.signInWithOtp({ email: address, options: { shouldCreateUser: false } });
      if (result.error) setError(errorKey);
      else if (!sent) setSent(true);
    } catch {
      setError(errorKey);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {sent && <p role="status">{t('billing.codeSent', { email })}</p>}
      <form onSubmit={submit}>
        {sent ? (
          <>
            <label htmlFor="sandbox-code">{t('billing.code')}</label>
            <input id="sandbox-code" inputMode="numeric" autoComplete="one-time-code" required maxLength={10} value={code} onChange={(event) => setCode(event.target.value)} />
          </>
        ) : (
          <>
            <label htmlFor="sandbox-email">{t('billing.email')}</label>
            <input id="sandbox-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} />
          </>
        )}
        <div className="pricing-sandbox-actions">
          <Button variant="primary" type="submit" disabled={busy}>
            {t(busy ? 'billing.loading' : sent ? 'billing.verify' : 'billing.sendCode')}
          </Button>
          {sent && (
            <Button disabled={busy} onClick={() => { setSent(false); setCode(''); setError(null); }}>
              {t('billing.changeEmail')}
            </Button>
          )}
        </div>
      </form>
      {error && <p role="alert">{t(error)}</p>}
    </>
  );
}

export default function BillingSandbox() {
  const { t } = useI18n();
  const [search] = useSearchParams();
  const checkoutResult = search.get('billing');
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    try {
      const { data } = getBillingClient().auth.onAuthStateChange((_event, current) => setSession(current));
      return () => data.subscription.unsubscribe();
    } catch {
      setUnavailable(true);
    }
  }, []);

  return (
    <section className="pricing-sandbox" aria-labelledby="sandbox-title">
      <h2 id="sandbox-title">{t('billing.title')}</h2>
      <p>{t('billing.intro')}</p>
      {checkoutResult === 'success' && <p>{t('billing.returned')}</p>}
      {checkoutResult === 'cancel' && <p>{t('billing.checkoutCanceled')}</p>}
      {unavailable ? <p role="alert">{t('billing.unavailable')}</p>
        : session ? <Account key={session.user.id} session={session} />
          : session === null ? <TestSignIn /> : <p role="status">{t('billing.loading')}</p>}
    </section>
  );
}
