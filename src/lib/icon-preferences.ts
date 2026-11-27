import { useCallback, useMemo, useState } from 'react';
import { styleFromSlug, type StyleId } from './catalog-meta';
import { useClientValue } from './hydration';
import { DEFAULT_LOOK, THEME_NAMES, type ColorChoice, type Look } from './look';
import { usePlan } from './plan';
import { isHexColor } from './svg';

const KEY = 'fos-icon-preferences';
let memory = '';
const listeners = new Set<() => void>();
type Colors = Pick<Look, 'paletteName' | 'custom' | 'mono' | 'modifierColor' | 'duotoneTint'>;
type Preferences = Colors & { style: StyleId };

function read() {
  try { return localStorage.getItem(KEY) ?? ''; } catch { return memory; }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const storage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) listener();
  };
  window.addEventListener('storage', storage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', storage);
  };
}

const hex = (value: unknown) => typeof value === 'string' && isHexColor(value) ? value : null;
function colorChoice(value: unknown): ColorChoice | undefined {
  if (typeof value === 'string') return hex(value) ?? undefined;
  if (!value || typeof value !== 'object' || !('paletteName' in value) || !('role' in value)) return undefined;
  const { paletteName, role } = value;
  if (typeof paletteName !== 'string' || !THEME_NAMES.includes(paletteName)) return undefined;
  if (role === 'main' || role === 'primary' || role === 'secondary') return { paletteName, role };
}

function parse(raw: string): Preferences {
  let saved: Partial<Preferences> | null = null;
  try { saved = JSON.parse(raw); } catch { /* Missing or invalid saved settings. */ }
  const primary = colorChoice(saved?.custom?.primary);
  const secondary = colorChoice(saved?.custom?.secondary);
  const tint = saved?.duotoneTint;
  return {
    style: styleFromSlug(saved?.style ?? null) ?? 'regular',
    paletteName: saved?.paletteName && THEME_NAMES.includes(saved.paletteName) ? saved.paletteName : DEFAULT_LOOK.paletteName,
    custom: primary || secondary ? { primary, secondary } : null,
    mono: colorChoice(saved?.mono) ?? null,
    modifierColor: colorChoice(saved?.modifierColor) ?? null,
    duotoneTint: typeof tint === 'number' && Number.isInteger(tint) && tint >= 0 && tint <= 100 ? tint : null,
  };
}

function save(patch: Partial<Preferences>) {
  memory = JSON.stringify({ ...parse(read()), ...patch });
  try { localStorage.setItem(KEY, memory); } catch { /* Apply the choice in memory when storage is blocked. */ }
  listeners.forEach((listener) => listener());
}

export const rememberIconStyle = (style: StyleId) => save({ style });

export function useIconStyle() {
  return parse(useClientValue(read, '', subscribe)).style;
}

export function useIconLook(initial: Look) {
  const [look, setLook] = useState(initial);
  const { can } = usePlan();
  const raw = useClientValue(read, '', subscribe);
  const { paletteName, custom, mono, modifierColor, duotoneTint } = useMemo(() => parse(raw), [raw]);
  const update = useCallback((patch: Partial<Look>) => {
    const { size, strokeWidth, speed, ...colors } = patch;
    if (Object.keys(colors).length) save(colors);
    setLook((previous) => ({
      ...previous,
      size: size ?? previous.size,
      strokeWidth: strokeWidth === undefined ? previous.strokeWidth : strokeWidth,
      speed: speed ?? previous.speed,
    }));
  }, []);
  const allowedCustom = can('duoColors') ? custom : null;
  const allowedModifier = can('modifiers') ? modifierColor : null;
  const allowedTint = can('duoColors') ? duotoneTint : null;
  const resolved = useMemo(() => ({ ...look, paletteName, custom: allowedCustom, mono, modifierColor: allowedModifier, duotoneTint: allowedTint }),
    [look, paletteName, allowedCustom, mono, allowedModifier, allowedTint]);
  return [resolved, update] as const;
}
