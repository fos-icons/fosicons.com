import { useI18n } from '../i18n';
import { errorText } from '../i18n/errors';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  CORNERS, initialCorner, loadModifiers, modifierTileSvg,
  type Corner, type ModifierAsset,
} from '../lib/modifiers';

export interface ModifierChoice {
  modifier: ModifierAsset;
  corner: Corner;
}

/** Load the library's modifiers once the picker is shown. */
export function useModifiers(enabled: boolean) {
  const i18n = useI18n();
  const [state, setState] = useState<{ list: ModifierAsset[] | null; error: string | null }>({ list: null, error: null });
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    loadModifiers().then(
      (list) => { if (live) setState({ list, error: null }); },
      (e: unknown) => { if (live) setState({ list: null, error: errorText(e, i18n, 'error.loadModifiers') }); },
    );
    return () => { live = false; };
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps -- the message language is fixed per page load
  return state;
}

const tile = 'relative flex h-9 w-full items-center justify-center rounded-lg border text-ink transition-colors';
/*
 * Each tab runs from heaviest to lightest: modifiers drawn on a square plate,
 * then the bold standalone shapes, then the light outlines. Within each band,
 * related modifiers sit side by side. A modifier the library adds later and
 * these lists don't name yet goes at the end of its tab.
 */
const ACTIONS_ORDER = [
  // On a square: create and remove, documents and references, arrows, conversation, recording.
  'add', 'remove', 'delete', 'block',
  'copy', 'note', 'list', 'hash', 'link', 'question',
  'arrow-up', 'arrow-down', 'arrow-left', 'arrow-right',
  'reply', 'forward', 'record',
  // Bold shapes.
  'edit', 'refresh', 'settings', 'chat', 'sparkle',
  // Light outlines, download beside upload.
  'download', 'upload',
];
const GENERAL_ORDER = [
  // On a square.
  'check', 'warning', 'code',
  // Bold shapes: development, security and identity, places and tools, commerce, status dot.
  'bug',
  'lock', 'key', 'shield', 'user',
  'home', 'phone', 'search', 'clip',
  'money', 'coins', 'tag',
  'dot',
  // Numerals, quality, and layout.
  '12', '24',
  'hd', '4k',
  'indent-left', 'indent-right',
];
/** Documents, images and design files, audio and video, code and data, then archives and messages. */
const FILE_ORDER = [
  'doc', 'pdf', 'txt', 'md', 'ppt', 'xls', 'csv',
  'jpg', 'png', 'gif', 'svg', 'psd', 'ai', 'eps', 'fig',
  'mp3', 'wav', 'mp4', 'mov',
  'html', 'css', 'js', 'ts', 'json', 'xml', 'sql',
  'zip', 'sms',
];
const GENERAL_NAMES = new Set(GENERAL_ORDER);
const isFileType = (modifier: ModifierAsset) => modifier.group === 'file-types';
/** Library actions stay in Actions unless General names them (bug, code, home, phone, search, shield). */
const inActions = (modifier: ModifierAsset) => modifier.group === 'actions' && !GENERAL_NAMES.has(modifier.name);
const inGeneral = (modifier: ModifierAsset) => !inActions(modifier) && !isFileType(modifier);
/** Sort by `order`; names it doesn't list keep their library order after it (the sort is stable). */
const byOrder = (order: readonly string[]) => {
  const rank = (m: ModifierAsset) => {
    const i = order.indexOf(m.name);
    return i < 0 ? order.length : i;
  };
  return (a: ModifierAsset, b: ModifierAsset) => rank(a) - rank(b);
};

export function ModifierPicker({
  modifiers, value, onChange, authored, accessory, sizeControl, inlineSize = false,
}: {
  modifiers: ModifierAsset[];
  value: ModifierChoice | null;
  onChange: (value: ModifierChoice | null) => void;
  /** Modifier names the library has authored for this icon, by corner. */
  authored: Map<string, Set<Corner>>;
  /** A compact control beside None (the modifier color). */
  accessory?: ReactNode;
  sizeControl?: ReactNode;
  inlineSize?: boolean;
}) {
  const cornerLabel = useId();
  const { t, label } = useI18n();
  const baseId = useId();
  const tiles = useMemo(() => new Map(modifiers.map((m) => [m.name, modifierTileSvg(m)])), [modifiers]);
  const groups = [
    { id: 'actions', items: modifiers.filter(inActions).sort(byOrder(ACTIONS_ORDER)) },
    { id: 'general', items: modifiers.filter(inGeneral).sort(byOrder(GENERAL_ORDER)) },
    { id: 'file-types', items: modifiers.filter(isFileType).sort(byOrder(FILE_ORDER)) },
  ] as const;
  const [tab, setTab] = useState(() => groups.find((g) => g.items.some((m) => m.name === value?.modifier.name))?.id ?? groups[0]?.id);
  const current = groups.find((g) => g.id === tab) ?? groups[0];
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    const to = e.key === 'Home' ? 0 : e.key === 'End' ? groups.length - 1 : step ? (i + step + groups.length) % groups.length : -1;
    if (to < 0) return;
    e.preventDefault();
    setTab(groups[to].id);
    tabRefs.current[to]?.focus();
  };

  /**
   * The corner the user last chose (or opened with). It outlives None and
   * modifiers that only fit elsewhere, so the next modifier goes back to it.
   */
  const chosenCorner = useRef<Corner | null>(value?.corner ?? null);
  const pick = (m: ModifierAsset) => {
    if (value?.modifier.name === m.name) return onChange(null);
    const preferred = chosenCorner.current;
    onChange({ modifier: m, corner: preferred && m.positions[preferred] ? preferred : initialCorner(m) });
  };
  const place = (corner: Corner) => {
    if (!value) return;
    chosenCorner.current = corner;
    onChange({ ...value, corner });
  };

  return (
    <div className="@container space-y-3">
      <div className={`grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-3 ${inlineSize && sizeControl
        ? '@min-[26rem]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]'
        : ''}`}>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-pressed={!value}
            onClick={() => onChange(null)}
            className={`h-8 rounded-lg border px-3 text-sm font-medium transition-colors ${
              !value ? 'border-ink bg-ink text-canvas' : 'border-line-strong hover:bg-sunken'
            }`}
          >
            {t('modifiers.none')}
          </button>
          {accessory}
        </div>
        {sizeControl && (
          <div className={`order-last col-span-2 min-w-0 ${inlineSize
            ? '@min-[26rem]:order-none @min-[26rem]:col-span-1 @min-[26rem]:w-48'
            : ''}`}>
            {sizeControl}
          </div>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <span id={cornerLabel} className="text-xs text-muted">{t('modifiers.corner')}</span>
          <div role="group" aria-labelledby={cornerLabel} className="grid grid-cols-2 gap-1">
            {CORNERS.map((corner) => {
              const allowed = !!value?.modifier.positions[corner];
              const active = value?.corner === corner;
              const [v, h] = corner.split('-');
              return (
                <button
                  key={corner}
                  type="button"
                  aria-label={t(`corner.${corner}`)}
                  data-tooltip={allowed || !value ? t(`corner.${corner}`) : t('modifiers.onlySits', {
                    modifier: label('modifier', value.modifier.name, value.modifier.label),
                    corners: (Object.keys(value.modifier.positions) as Corner[]).map((c) => t(`corner.${c}.inline`)).join(', '),
                  })}
                  aria-pressed={active}
                  disabled={!allowed}
                  onClick={() => place(corner)}
                  className={`flex size-6 rounded-md border p-1 transition-colors disabled:opacity-35 ${
                    v === 'top' ? 'items-start' : 'items-end'
                  } ${h === 'left' ? 'justify-start' : 'justify-end'} ${
                    active ? 'border-brand bg-brand-soft' : 'border-line-strong enabled:hover:bg-sunken'
                  }`}
                >
                  <span className={`size-2 rounded-[3px] ${active ? 'bg-brand' : 'bg-faint'}`} />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div>
        <div role="tablist" aria-label={t('modifiers.categories')} className="flex gap-1 border-b border-line">
          {groups.map((group, i) => {
            const selected = group.id === current.id;
            const holdsChoice = group.items.some((m) => m.name === value?.modifier.name);
            return (
              <button
                key={group.id}
                ref={(el) => { tabRefs.current[i] = el; }}
                type="button"
                role="tab"
                id={`${baseId}-tab-${group.id}`}
                aria-selected={selected}
                aria-controls={`${baseId}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setTab(group.id)}
                onKeyDown={(e) => onTabKey(e, i)}
                className={`-mb-px inline-flex items-center gap-1 border-b-2 px-2 pb-2 pt-1 text-xs font-medium transition-colors ${
                  selected ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                {t(`modifiers.group.${group.id}`)}
                {holdsChoice && <span aria-hidden="true" className="size-1.5 rounded-full bg-brand" />}
              </button>
            );
          })}
        </div>
        <ul
          id={`${baseId}-panel`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${current.id}`}
          className="mt-2.5 grid grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-1"
        >
          {current.items.map((m) => {
            const active = value?.modifier.name === m.name;
            const hasAuthored = authored.has(m.name);
            return (
              <li key={m.name}>
                <button
                  type="button"
                  aria-pressed={active}
                  aria-label={t(hasAuthored ? 'modifiers.tileAuthored' : 'modifiers.tile', { label: label('modifier', m.name, m.label) })}
                  data-tooltip={label('modifier', m.name, m.label)}
                  onClick={() => pick(m)}
                  className={`${tile} ${active ? 'border-brand bg-brand-soft' : 'border-transparent bg-sunken hover:border-line-strong'}`}
                >
                  <span className="glyph flex h-4 w-5 items-center justify-center [&>svg]:max-h-full [&>svg]:max-w-full" dangerouslySetInnerHTML={{ __html: tiles.get(m.name)! }} />
                  {hasAuthored && <span aria-hidden="true" className="absolute right-1 top-1 size-1.5 rounded-full bg-brand" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
