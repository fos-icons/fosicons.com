import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '../components/ui';
import { useI18n, type MessageKey } from '../i18n';
import { useHostedBilling } from '../lib/billing-actions';
import { getBillingClient } from '../lib/billing-client';
import type { BillingMode } from '../lib/billing-mode';
import type { PaidPlan } from '../lib/billing-plans';
import { hasOpenSubscription, usePlan } from '../lib/plan';

/** After Checkout, re-read the status a few times: the webhook usually lands within seconds. */
const RETURN_REFRESH_MS = [2000, 5000, 10_000];

function Account({ mode, chosen, returned }: { mode: BillingMode; chosen: PaidPlan | null; returned: boolean }) {
  const { t } = useI18n();
  const { session, subscription, loading, statusError, refresh } = usePlan();
  const billing = useHostedBilling(session?.token);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const open = hasOpenSubscription(subscription);
  const busy = loading || billing.pending !== null || signingOut;

  useEffect(() => {
    if (!returned) return;
    const timers = RETURN_REFRESH_MS.map((delay) => setTimeout(refresh, delay));
    return () => timers.forEach(clearTimeout);
  }, [returned, refresh]);

  async function signOut() {
    setSigningOut(true);
    setSignOutError(false);
    billing.clearError();
    try {
      const result = await getBillingClient().auth.signOut({ scope: 'local' });
      if (result.error) setSignOutError(true);
    } catch {
      setSignOutError(true);
    } finally {
      setSigningOut(false);
    }
  }

  const error: MessageKey | null = signOutError ? 'billing.signOutError' : billing.error ?? (statusError ? 'billing.statusError' : null);
  return (
    <>
      {session?.email && <p>{t('billing.signedInAs', { email: session.email })}</p>}
      <p role="status">
        {loading ? t('billing.reading')
          : subscription ? t(`billing.subscription.${mode}`, { plan: t(`pricing.plan.${subscription.plan}`) }) : ''}
      </p>
      <div className="pricing-account-actions">
        {chosen && subscription && !open && (
          <Button variant="primary" disabled={busy} onClick={() => void billing.open('checkout', chosen)}>
            {t('billing.continue', { plan: t(`pricing.plan.${chosen}`) })}
          </Button>
        )}
        {subscription?.status && (
          <Button disabled={busy} onClick={() => void billing.open('portal')}>{t('billing.manage')}</Button>
        )}
        <Button disabled={busy} onClick={refresh}>{t('billing.refresh')}</Button>
        <Button variant="quiet" disabled={billing.pending !== null || signingOut} onClick={() => void signOut()}>{t('billing.signOut')}</Button>
      </div>
      {error && <p role="alert">{t(error)}</p>}
    </>
  );
}

function SignIn({ mode, chosen }: { mode: BillingMode; chosen: PaidPlan | null }) {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  // Choosing a plan while signed out brings the form into view, ready to type.
  useEffect(() => {
    if (!chosen) return;
    emailRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    emailRef.current?.focus({ preventScroll: true });
  }, [chosen]);

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
        // Live billing signs new customers up; the sandbox only lets in testers who already exist.
        : await auth.signInWithOtp({ email: address, options: { shouldCreateUser: mode === 'live' } });
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
      {chosen && !sent && <p>{t('billing.chosen', { plan: t(`pricing.plan.${chosen}`) })}</p>}
      {sent && <p role="status">{t('billing.codeSent', { email })}</p>}
      <form onSubmit={submit}>
        {sent ? (
          <>
            <label htmlFor="billing-code">{t('billing.code')}</label>
            <input id="billing-code" inputMode="numeric" autoComplete="one-time-code" required maxLength={10} value={code} onChange={(event) => setCode(event.target.value)} />
          </>
        ) : (
          <>
            <label htmlFor="billing-email">{t('billing.email')}</label>
            <input ref={emailRef} id="billing-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} />
          </>
        )}
        <div className="pricing-account-actions">
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

/**
 * Sign-in and the account's billing actions on the Pricing page. Loaded only
 * where billing is on, so Supabase stays out of the main bundle elsewhere.
 */
export default function BillingAccount({ mode, chosen = null }: { mode: BillingMode; chosen?: PaidPlan | null }) {
  const { t } = useI18n();
  const [search] = useSearchParams();
  const checkoutResult = search.get('billing');
  const { session } = usePlan();
  const [unavailable, setUnavailable] = useState(false);
  const [known, setKnown] = useState(false);

  // The plan context tracks the session; this only confirms the client can start.
  useEffect(() => {
    try {
      const { data } = getBillingClient().auth.onAuthStateChange(() => setKnown(true));
      return () => data.subscription.unsubscribe();
    } catch {
      setUnavailable(true);
    }
  }, []);

  return (
    <section id="account" className="pricing-account" aria-labelledby="account-title">
      <h2 id="account-title">{t(`billing.title.${mode}`)}</h2>
      {/* The sandbox always says no money moves; live only explains sign-in. */}
      {(mode === 'sandbox' || !session) && <p>{t(`billing.intro.${mode}`)}</p>}
      {checkoutResult === 'success' && <p>{t(`billing.returned.${mode}`)}</p>}
      {checkoutResult === 'cancel' && <p>{t('billing.checkoutCanceled')}</p>}
      {unavailable ? <p role="alert">{t('billing.unavailable')}</p>
        : session ? <Account mode={mode} chosen={chosen} returned={checkoutResult === 'success'} />
          : known ? <SignIn mode={mode} chosen={chosen} /> : <p role="status">{t('billing.loading')}</p>}
    </section>
  );
}
