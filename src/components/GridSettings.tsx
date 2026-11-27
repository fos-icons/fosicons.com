import { useId } from 'react';
import { useDisclosure } from '../hooks/useDisclosure';
import { useI18n } from '../i18n';
import { IconButton, RangeSlider } from './ui';

interface Props {
  columns?: number;
  autoColumns: number;
  maxColumns: number;
  showNames: boolean;
  setColumns: (count: number | null) => void;
  setShowNames: (show: boolean) => void;
}

export function GridSettings({ columns, autoColumns, maxColumns, showNames, setColumns, setShowNames }: Props) {
  const { t, n } = useI18n();
  const id = useId();
  const disclosure = useDisclosure();
  const value = columns ?? autoColumns;
  const autoLabel = t('icons.columnsAuto', { count: n(value) });

  return (
    <div {...disclosure.container} className="relative ml-auto shrink-0">
      <IconButton
        ref={disclosure.trigger}
        icon="settings"
        label={t('icons.gridSettings')}
        aria-expanded={disclosure.open}
        aria-controls={id}
        onClick={disclosure.toggle}
        className="border border-line-strong bg-surface aria-expanded:bg-sunken"
      />
      <div id={id} hidden={!disclosure.open} className="absolute end-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-surface p-3 shadow-md">
        <div className="mb-2 flex items-center gap-2">
          {maxColumns > 1 ? (
            <div className="min-w-0 flex-1">
              <RangeSlider id={`${id}-columns`} label={t('icons.columns')} min={1} max={maxColumns} step={1} value={value}
                defaultValue={autoColumns} valueText={columns === undefined ? autoLabel : undefined} onChange={setColumns} />
            </div>
          ) : <span className="flex-1 text-sm font-medium">{autoLabel}</span>}
          <button type="button" aria-pressed={columns === undefined} onClick={() => setColumns(null)}
            className="rounded-md px-1.5 py-0.5 text-xs text-muted hover:bg-sunken aria-pressed:bg-brand-soft aria-pressed:text-brand">
            {t('icons.columnsReset')}
          </button>
        </div>
        <label className="flex min-h-9 cursor-pointer items-center justify-between gap-3 border-t border-line pt-2 text-sm font-medium">
          {t('icons.showNames')}
          <input type="checkbox" role="switch" checked={showNames} onChange={(event) => setShowNames(event.target.checked)}
            className="relative h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full border border-line-strong bg-sunken before:absolute before:start-0.5 before:top-0.5 before:size-3.5 before:rounded-full before:bg-muted checked:border-brand checked:bg-brand checked:before:translate-x-4 checked:before:bg-brand-ink rtl:checked:before:-translate-x-4 forced-colors:appearance-auto forced-colors:before:hidden" />
        </label>
      </div>
    </div>
  );
}
