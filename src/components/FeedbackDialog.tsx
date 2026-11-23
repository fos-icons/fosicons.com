import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useI18n } from '../i18n';
import { FEEDBACK_MAX_LENGTH, FEEDBACK_PATH, FEEDBACK_TYPES, isFeedbackType } from '../lib/feedback';
import { getFeedbackToken } from '../lib/feedback-verification';
import { Button, buttonClass, IconButton, Select, UiIcon } from './ui';

const DRAFT_KEY = 'fos-feedback-draft';
const EMPTY_DRAFT = { type: '', description: '' };
let draftInMemory = EMPTY_DRAFT;

function readDraft() {
  try {
    const stored = sessionStorage.getItem(DRAFT_KEY);
    if (!stored) return draftInMemory;
    const draft = JSON.parse(stored);
    return {
      type: isFeedbackType(draft?.type) ? draft.type : '',
      description: typeof draft?.description === 'string' ? draft.description.slice(0, FEEDBACK_MAX_LENGTH) : '',
    };
  } catch {
    return draftInMemory;
  }
}

function saveDraft(draft: typeof EMPTY_DRAFT) {
  draftInMemory = draft;
  try {
    if (draft.type || draft.description) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // The in-memory draft still survives reopening the dialog on this page.
  }
}

export default function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const turnstileSiteKey = import.meta.env.VITE_FEEDBACK_TURNSTILE_SITE_KEY;
  const dialog = useRef<HTMLDialogElement>(null);
  const doneButton = useRef<HTMLButtonElement>(null);
  const verificationContainer = useRef<HTMLDivElement>(null);
  const attempt = useRef<AbortController | null>(null);
  const headingId = useId();
  const noticeId = useId();
  const [draft, setDraft] = useState(readDraft);
  const { type, description } = draft;
  const [status, setStatus] = useState<'idle' | 'verifying' | 'sending' | 'sent' | 'failed' | 'verification-failed' | 'rate-limited'>('idle');
  const sending = status === 'sending';
  const busy = sending || status === 'verifying';
  const error = {
    failed: 'feedback.failed',
    'verification-failed': 'feedback.verificationFailed',
    'rate-limited': 'feedback.rateLimited',
  } as const;
  const errorTitle = status in error ? error[status as keyof typeof error] : undefined;
  const updateDraft = (next: typeof draft) => {
    setDraft(next);
    saveDraft(next);
  };
  const close = async () => {
    const element = dialog.current;
    if (!element?.open || sending || element.hasAttribute('data-closing')) return;
    attempt.current?.abort();
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      element.setAttribute('data-closing', '');
      await Promise.allSettled(element.getAnimations().map((animation) => animation.finished));
    }
    element.close();
  };

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
    return () => attempt.current?.abort();
  }, []);

  useEffect(() => {
    if (status === 'sent') doneButton.current?.focus();
  }, [status]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (attempt.current || dialog.current?.hasAttribute('data-closing') || !isFeedbackType(type) || !description.trim()) return;
    const website = new FormData(event.currentTarget).get('website');
    const controller = new AbortController();
    attempt.current = controller;
    let turnstileToken: string | undefined;
    try {
      if (turnstileSiteKey && verificationContainer.current) {
        setStatus('verifying');
        try {
          turnstileToken = await getFeedbackToken(verificationContainer.current, turnstileSiteKey,
            AbortSignal.any([controller.signal, AbortSignal.timeout(90000)]));
        } catch {
          if (!controller.signal.aborted) setStatus('verification-failed');
          return;
        }
      }
      controller.signal.throwIfAborted();
      setStatus('sending');
      const response = await fetch(FEEDBACK_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, description, website, turnstileToken }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
      });
      if (response.ok && (await response.json()).ok === true) {
        saveDraft(EMPTY_DRAFT);
        setStatus('sent');
      } else {
        setStatus(response.status === 422 ? 'verification-failed' : response.status === 429 ? 'rate-limited' : 'failed');
      }
    } catch {
      if (!controller.signal.aborted) setStatus('failed');
    } finally {
      attempt.current = null;
    }
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby={headingId}
      onClose={onClose}
      onCancel={(event) => { event.preventDefault(); void close(); }}
      className="feedback-dialog fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[30rem] overflow-y-auto rounded-2xl bg-surface p-0 text-ink shadow-xl backdrop:bg-black/50"
    >
      <header className="flex items-center justify-between gap-4 border-b border-line py-3 ps-5 pe-3 sm:ps-6 sm:pe-4">
        <h2 id={headingId} className="text-2xl font-semibold">{t('header.feedback')}</h2>
        <IconButton icon="x" label={t('feedback.close')} disabled={sending} onClick={close} className="size-11 shrink-0 text-muted enabled:hover:text-ink disabled:opacity-50" />
      </header>
      {status === 'sent' ? (
        <div>
          <div className="px-5 py-5 sm:px-6">
            <p role="status" className="flex items-start gap-2.5 rounded-xl border border-success/25 bg-success/10 px-3.5 py-3 text-sm leading-relaxed font-medium">
              <UiIcon name="check" className="size-5 text-success" />
              {t(type === 'new-icon' ? 'feedback.issueCreated' : 'feedback.sent')}
            </p>
          </div>
          <div className="flex justify-end border-t border-line px-5 py-4 sm:px-6">
            <button type="button" ref={doneButton} className={buttonClass({ variant: 'primary', size: 'lg' })} onClick={close}>{t('feedback.done')}</button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} aria-busy={sending}>
          <div className="space-y-5 px-5 py-5 sm:px-6">
            <label className="block text-sm font-semibold">
              {t('feedback.type')} <span aria-hidden="true" className="text-danger">*</span>
              <Select className="mt-1.5" required disabled={busy} value={type} onChange={(event) => updateDraft({ ...draft, type: event.target.value })}>
                <option value="" disabled>{t('feedback.selectType')}</option>
                {Object.keys(FEEDBACK_TYPES).map((value) => (
                  <option key={value} value={value}>{t(`feedback.type.${value as keyof typeof FEEDBACK_TYPES}`)}</option>
                ))}
              </Select>
            </label>
            <label className="block text-sm font-semibold">
              {t('feedback.description')} <span aria-hidden="true" className="text-danger">*</span>
              <textarea
                required
                rows={5}
                maxLength={FEEDBACK_MAX_LENGTH}
                disabled={busy}
                value={description}
                onChange={(event) => updateDraft({ ...draft, description: event.target.value })}
                aria-describedby={type === 'new-icon' ? noticeId : undefined}
                className="mt-1.5 block w-full resize-y rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-base leading-relaxed font-normal"
              />
            </label>
            <div hidden><input name="website" tabIndex={-1} autoComplete="off" /></div>
            {type === 'new-icon' && <p id={noticeId} className="rounded-lg bg-sunken px-3 py-2.5 text-sm leading-relaxed text-muted">{t('feedback.publicNotice')}</p>}
            {turnstileSiteKey && <div ref={verificationContainer} className="empty:hidden" />}
            {errorTitle && (
              <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger/10 px-3.5 py-3 text-sm leading-relaxed">
                <UiIcon name="info-circle" className="size-5 text-danger" />
                <div>
                  <p className="font-semibold">{t(errorTitle)}</p>
                  <p className="text-muted">{t(status === 'rate-limited' ? 'feedback.rateLimitedRetry' : 'feedback.retry')}</p>
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4 sm:px-6">
            <Button variant="ghost" size="lg" disabled={sending} onClick={close}>{t('feedback.cancel')}</Button>
            <Button type="submit" variant="primary" size="lg" disabled={busy || !type || !description.trim()}>{t(sending ? 'feedback.sending' : status === 'verifying' ? 'feedback.verifying' : 'feedback.submit')}</Button>
          </div>
        </form>
      )}
    </dialog>
  );
}
