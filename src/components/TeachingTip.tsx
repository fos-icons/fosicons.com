import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { Button, UiIcon } from './ui';

const STORAGE_KEY = 'fos-learned-tips';
const sessionSeen = new Set<string>();
type Tip = 'modifier' | 'color';

function learnedTips(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (Array.isArray(stored)) return stored.filter((id): id is string => typeof id === 'string');
  } catch { /* Storage is optional. */ }
  return [];
}

/** Contextual guidance shown once when its anchor first enters view. */
export function TeachingTip({ tip }: { tip: Tip }) {
  const { t } = useI18n();
  const anchor = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = anchor.current;
    if (!target || sessionSeen.has(tip) || learnedTips().includes(tip) || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || sessionSeen.has(tip) || learnedTips().includes(tip)) return;
      sessionSeen.add(tip);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...learnedTips(), tip])); } catch { /* Remember for this session. */ }
      setVisible(true);
      observer.disconnect();
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [tip]);

  return (
    <div ref={anchor} className={visible ? undefined : 'pointer-events-none absolute size-px'}>
      {visible && (
        <aside aria-label={t('learning.label')} className="mt-2 flex items-start gap-2 rounded-lg border border-line bg-brand-soft px-3 py-2 text-xs leading-relaxed text-ink">
          <UiIcon name="lightbulb" className="size-4 shrink-0 text-brand" />
          <p className="flex-1">{t(`learning.${tip}`)}</p>
          <Button size="sm" variant="secondary" onClick={() => setVisible(false)}>{t('learning.dismiss')}</Button>
        </aside>
      )}
    </div>
  );
}
