import { useI18n } from '../i18n';
import { useId, useState } from 'react';
import { copyPng, copyText, downloadBlob, svgBlob, svgToJpg, svgToPng } from '../lib/export';
import { buildZip, type ZipEntry } from '../lib/zip';
import { Section } from './Customize';
import { Button, IconButton, Select, UiIcon } from './ui';

export const EXPORT_SCALES = [0.5, 1, 1.5, 2, 3, 4] as const;
type Scale = (typeof EXPORT_SCALES)[number];
type Format = 'png' | 'jpg' | 'svg';
const MIME: Record<Format, string> = { svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg' };

export interface ExportRow {
  id: number;
  scale: Scale;
  format: Format;
  /** Appended to the file name. Empty means the default for the row. */
  suffix: string;
}

let nextId = 1;
const row = (format: Format, scale: Scale): ExportRow => ({ id: nextId++, format, scale, suffix: '' });

/** Export rows outlive the inspector, so switching icons keeps the setup (like Figma's export settings). */
let remembered: ExportRow[] = [row('svg', 1)];
export const resetExportRows = () => { remembered = [row('svg', 1)]; };

const scaleLabel = (s: number) => `${s}x`;
/** SVG is vector: it always exports at the chosen size, so its scale is fixed (as in Figma). */
const effectiveScale = (r: Pick<ExportRow, 'format' | 'scale'>) => (r.format === 'svg' ? 1 : r.scale);
const pxOf = (size: number, scale: number) => Math.round(size * scale);
export const defaultSuffix = (r: Pick<ExportRow, 'format' | 'scale'>, size: number) =>
  (r.format === 'svg' ? '' : `-${pxOf(size, r.scale)}px`);

const field = 'h-8 rounded-md border border-transparent bg-sunken px-2 text-sm text-ink transition-colors hover:border-line-strong disabled:text-faint disabled:hover:border-transparent';

type CopyKind = 'svg' | 'png' | 'name';
const COPY_KINDS = [
  { value: 'svg', label: 'export.copySvg' },
  { value: 'png', label: 'export.copyPng' },
  { value: 'name', label: 'export.copyName' },
] as const satisfies readonly { value: CopyKind; label: string }[];
let rememberedCopy: { kind: CopyKind; scale: Scale } = { kind: 'svg', scale: 2 };

/**
 * Figma-style export: a list of scale × format rows, each with an optional
 * suffix, exported in one go (one file, or a ZIP for several). Copy follows
 * the same shape: pick what to copy, and the scale for images.
 */
export function ExportPanel({
  name, baseName, size, build, disabled, premium = false, run,
}: {
  /** Icon name, for the button label and Copy name. */
  name: string;
  /** File name stem (icon, modifier, style). */
  baseName: string;
  size: number;
  /** Build the export SVG at a pixel size. */
  build: (px: number) => string;
  disabled: boolean;
  premium?: boolean;
  run: (action: () => Promise<void> | void, success: string) => Promise<void>;
}) {
  const uid = useId();
  const { t } = useI18n();
  const [rows, setRowsState] = useState<ExportRow[]>(remembered);
  const [openRow, setOpenRow] = useState<number | null>(null);
  const [copy, setCopyState] = useState(rememberedCopy);
  const setRows = (next: ExportRow[]) => { remembered = next; setRowsState(next); };
  const setCopy = (next: typeof copy) => { rememberedCopy = next; setCopyState(next); };
  const patch = (id: number, change: Partial<ExportRow>) => setRows(rows.map((r) => (r.id === id ? { ...r, ...change } : r)));

  const add = () => {
    // A new row adds the next format not in the list yet (PNG, then JPG); after
    // that, another PNG one scale up from the largest PNG, like Figma.
    const used = new Set(rows.map((r) => r.format));
    const format: Format = (['png', 'jpg'] as const).find((f) => !used.has(f)) ?? 'png';
    const same = rows.filter((r) => r.format === format).map((r) => r.scale);
    const scale = same.length ? (EXPORT_SCALES.find((s) => s > Math.max(...same)) ?? EXPORT_SCALES[EXPORT_SCALES.length - 1]) : 1;
    setRows([...rows, row(format, scale)]);
  };

  const fileName = (r: ExportRow) => `${baseName}${r.suffix || defaultSuffix(r, size)}.${r.format}`;

  const exportAll = () => run(async () => {
    const files: ZipEntry[] = [];
    const names = new Set<string>();
    for (const r of rows) {
      let fname = fileName(r);
      for (let n = 2; names.has(fname); n += 1) fname = fileName(r).replace(/(\.\w+)$/, `-${n}$1`);
      names.add(fname);
      const px = pxOf(size, effectiveScale(r));
      const svg = build(px);
      const image = r.format === 'png' ? svgToPng(svg, px) : r.format === 'jpg' ? svgToJpg(svg, px) : null;
      files.push({ name: fname, data: image ? new Uint8Array(await (await image).arrayBuffer()) : svg });
    }
    if (files.length === 1) {
      const [only] = files;
      const format = rows[0].format;
      downloadBlob(typeof only.data === 'string' ? svgBlob(only.data) : new Blob([only.data as Uint8Array<ArrayBuffer>], { type: MIME[format] }), only.name);
    } else {
      downloadBlob(await buildZip(files), `${baseName}.zip`);
    }
  }, rows.length === 1 ? t('export.downloaded', { file: fileName(rows[0]) }) : t('export.downloadedZip', { count: rows.length, file: `${baseName}.zip` }));

  const doCopy = () => {
    if (copy.kind === 'name') return run(() => copyText(name), t('export.copiedName', { name }));
    if (copy.kind === 'svg') return run(() => copyText(build(size)), t('export.copiedSvg'));
    const px = pxOf(size, copy.scale);
    return run(() => copyPng(Promise.resolve().then(() => svgToPng(build(px), px))), t('export.copiedPng', { px }));
  };

  const downloadNote = [
    rows.length > 1 && t('export.zipNote'),
    rows.some((r) => r.format === 'jpg') && t('export.jpgNote'),
  ].filter(Boolean).join(' ');

  return (
    <Section
      title={t('export.title')}
      aside={<IconButton icon="plus" label={t('export.add')} onClick={add} className="-mr-1.5 size-8" />}
    >
    <div className="space-y-3">
      <ul aria-label={t('export.settings')} className="space-y-2">
        {rows.map((r, i) => {
          const svg = r.format === 'svg';
          const open = openRow === r.id;
          return (
            <li key={r.id}>
              <div className="flex items-center gap-1.5">
                <label className="sr-only" htmlFor={`${uid}-s${r.id}`}>{t('export.scaleRow', { row: i + 1 })}</label>
                <Select
                  id={`${uid}-s${r.id}`}
                  value={effectiveScale(r)}
                  disabled={svg}
                  title={svg ? t('export.svgFixed') : t('customize.pxValue', { value: pxOf(size, effectiveScale(r)) })}
                  onChange={(e) => patch(r.id, { scale: Number(e.target.value) as Scale })}
                  className="w-[76px] shrink-0"
                >
                  {EXPORT_SCALES.map((s) => <option key={s} value={s}>{scaleLabel(s)}</option>)}
                </Select>
                <label className="sr-only" htmlFor={`${uid}-f${r.id}`}>{t('export.formatRow', { row: i + 1 })}</label>
                <Select
                  id={`${uid}-f${r.id}`}
                  value={r.format}
                  onChange={(e) => patch(r.id, { format: e.target.value as Format })}
                  className="min-w-0 flex-1"
                >
                  <option value="png">PNG</option>
                  <option value="jpg">JPG</option>
                  <option value="svg">SVG</option>
                </Select>
                <button
                  type="button"
                  aria-label={t('export.options', { row: i + 1 })}
                  title={t('export.suffix')}
                  aria-expanded={open}
                  aria-controls={`${uid}-o${r.id}`}
                  onClick={() => setOpenRow(open ? null : r.id)}
                  className={`inline-flex size-8 items-center justify-center rounded-md transition-colors hover:bg-sunken ${open ? 'bg-sunken' : ''}`}
                >
                  <UiIcon name="dots-horizontal" className="size-[18px]" />
                </button>
                <button
                  type="button"
                  aria-label={t('export.remove', { row: i + 1 })}
                  title={t('export.removeTitle')}
                  disabled={rows.length === 1}
                  onClick={() => setRows(rows.filter((x) => x.id !== r.id))}
                  className="inline-flex size-8 items-center justify-center rounded-md transition-colors hover:bg-sunken disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <UiIcon name="minus" className="size-[18px]" />
                </button>
              </div>
              {open && (
                <div id={`${uid}-o${r.id}`} className="mt-1.5 flex items-center gap-2 pl-0.5">
                  <label htmlFor={`${uid}-x${r.id}`} className="text-xs text-muted">{t('export.suffix')}</label>
                  <input
                    id={`${uid}-x${r.id}`}
                    value={r.suffix}
                    placeholder={defaultSuffix(r, size) || t('export.suffixNone')}
                    onChange={(e) => patch(r.id, { suffix: e.target.value.replace(/[\\/:*?"<>|]/g, '') })}
                    className={`${field} min-w-0 flex-1 font-mono text-xs`}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <Button variant="primary" icon="download" className="h-10 w-full" disabled={disabled} onClick={exportAll}>
        {rows.length > 1 ? t('export.buttonMany', { name, count: rows.length }) : t('export.button', { name })}
      </Button>
      {premium ? <p className="text-xs text-muted">{t('export.premiumSoon')}</p>
        : downloadNote && <p className="text-xs text-faint">{downloadNote}</p>}

      <div className="border-t border-line pt-3">
        <h4 className="mb-2 text-xs text-muted">{t('export.copy')}</h4>
        <div className="flex items-center gap-1.5">
          <label className="sr-only" htmlFor={`${uid}-cs`}>{t('export.copyScale')}</label>
          <Select
            id={`${uid}-cs`}
            value={copy.kind === 'png' ? copy.scale : 1}
            disabled={copy.kind !== 'png'}
            onChange={(e) => setCopy({ ...copy, scale: Number(e.target.value) as Scale })}
            className="w-[76px] shrink-0"
          >
            {EXPORT_SCALES.map((s) => <option key={s} value={s}>{scaleLabel(s)}</option>)}
          </Select>
          <label className="sr-only" htmlFor={`${uid}-ck`}>{t('export.copyAs')}</label>
          <Select
            id={`${uid}-ck`}
            value={copy.kind}
            onChange={(e) => setCopy({ ...copy, kind: e.target.value as CopyKind })}
            className="min-w-0 flex-1"
          >
            {COPY_KINDS.map((k) => <option key={k.value} value={k.value}>{t(k.label)}</option>)}
          </Select>
          <Button icon="copy" className="h-8 px-2.5" disabled={disabled && copy.kind !== 'name'} onClick={doCopy}>
            {t('export.copy')}
          </Button>
        </div>
      </div>
      <p className="text-xs text-faint">{t('export.multiHint')}</p>
    </div>
    </Section>
  );
}
