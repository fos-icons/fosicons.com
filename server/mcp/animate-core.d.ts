/** Types for the generated animate-core.js (the fos-icons motion compiler). */
export interface Motion {
  type: string;
  parts: number[];
  dur?: number;
  delay?: number;
  ease?: string;
  origin?: [number, number];
  [option: string]: unknown;
}
export interface AnimationSpec {
  split?: boolean;
  /** Build from another Regular icon's artwork. */
  source?: string;
  /** Parts borrowed from other icons, appended after the source's parts. */
  add?: { icon: string; parts: number[]; split?: boolean }[];
  /** { part: commandIndex }: split a part's stroke before that command. */
  cuts?: Record<string, number>;
  motions: Motion[];
}
export interface Part {
  attrs: string;
  d: string;
  translate: [number, number];
}
export const MOTION_TYPES: string[];
export function parseParts(svg: string, options?: { split?: boolean }): Part[];
export function animateSvg(name: string, svg: string, spec: AnimationSpec, extras?: Record<string, string>): string;
