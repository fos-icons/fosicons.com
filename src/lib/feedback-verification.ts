import { FEEDBACK_TURNSTILE_ACTION } from './feedback';

interface Turnstile {
  render(container: HTMLElement, options: {
    sitekey: string;
    action: string;
    appearance: 'interaction-only';
    theme: 'light' | 'dark';
    size: 'flexible' | 'compact';
    retry: 'never';
    'response-field': false;
    callback: (token: string) => void;
    'error-callback': () => boolean;
    'timeout-callback': () => void;
  }): string | undefined;
  remove(widgetId: string): void;
}

let scriptRequest: Promise<Turnstile> | undefined;

function loadTurnstile() {
  const browser = window as Window & { turnstile?: Turnstile };
  if (browser.turnstile) return Promise.resolve(browser.turnstile);
  return scriptRequest ??= new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement('script');
    const fail = () => {
      clearTimeout(timeout);
      script.remove();
      reject(new Error('Feedback verification could not load'));
    };
    const timeout = window.setTimeout(fail, 10000);
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => {
      clearTimeout(timeout);
      if (browser.turnstile) resolve(browser.turnstile);
      else fail();
    };
    script.onerror = fail;
    document.head.append(script);
  }).catch((error: unknown) => {
    scriptRequest = undefined;
    throw error;
  });
}

export async function getFeedbackToken(container: HTMLElement, sitekey: string, signal: AbortSignal) {
  const turnstile = await loadTurnstile();
  signal.throwIfAborted();

  let widgetId: string | undefined;
  let abort: (() => void) | undefined;
  try {
    return await new Promise<string>((resolve, reject) => {
      abort = () => reject(signal.reason);
      signal.addEventListener('abort', abort, { once: true });
      const fail = () => reject(new Error('Feedback verification did not complete'));
      widgetId = turnstile.render(container, {
        sitekey,
        action: FEEDBACK_TURNSTILE_ACTION,
        appearance: 'interaction-only',
        theme: container.closest('.dark') ? 'dark' : 'light',
        size: (container.parentElement?.clientWidth ?? 0) < 348 ? 'compact' : 'flexible',
        retry: 'never',
        'response-field': false,
        callback: resolve,
        'error-callback': () => { fail(); return true; },
        'timeout-callback': fail,
      });
      if (!widgetId) fail();
    });
  } finally {
    if (abort) signal.removeEventListener('abort', abort);
    if (widgetId) turnstile.remove(widgetId);
  }
}
