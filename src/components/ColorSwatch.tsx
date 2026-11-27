import { useId } from 'react';
import { HexAlphaColorPicker } from 'react-colorful';
import { useI18n } from '../i18n';

export function ColorSwatch({ value, label, onChange, tooltip }: {
  value: string;
  label: string;
  onChange: (value: string) => void;
  tooltip?: string;
}) {
  const id = useId();
  const { t, locale } = useI18n();
  const hex = value.trim().slice(1);
  const alpha = hex.length === 4 ? parseInt(hex[3], 16) / 15
    : hex.length === 8 ? parseInt(hex.slice(6), 16) / 255
    : 1;
  const opacity = new Intl.NumberFormat(locale, { style: 'percent' }).format(alpha);

  return (
    <>
      <button
        type="button"
        popoverTarget={id}
        aria-label={label}
        data-tooltip={tooltip}
        className="size-8 shrink-0 rounded-lg border border-line-strong bg-surface p-1 hover:border-muted"
      >
        <span aria-hidden="true" className="checkerboard block size-full overflow-hidden rounded-sm">
          <span className="block size-full" style={{ backgroundColor: value }} />
        </span>
      </button>
      <div
        id={id}
        popover="auto"
        role="group"
        aria-label={label}
        className="color-popover w-color-picker max-w-[calc(100vw-1.5rem)] overflow-auto rounded-xl border border-line bg-surface p-3 text-ink shadow-lg"
      >
        <HexAlphaColorPicker color={value} onChange={(color) => onChange(color.toUpperCase())} />
        <p className="mt-2 flex justify-between gap-2 text-xs font-medium text-muted">
          <span>{t('customize.opacity')}</span>
          <span className="tabular-nums">{opacity}</span>
        </p>
      </div>
    </>
  );
}
