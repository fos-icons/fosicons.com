import { isPaidPlan, type PaidPlan } from './billing-plans.js';

/** A plan someone can use features from. */
export type Plan = 'free' | PaidPlan;

export const PLAN_LEVEL: Record<Plan, number> = { free: 0, pro: 1, advanced: 2 };

/**
 * The lowest plan for each gated feature, matching the pricing page's
 * `featureGroups`. Anything not listed here is free.
 * - styles: copy and download Solid, Duocolor, and Duotone artwork (previews stay free)
 * - duoColors: separate primary and accent colors for the duo styles
 * - zip: bulk SVG and PNG ZIPs (all icons, a category, or a selection)
 * - modifiers: the modifier picker, placement, badge color, and exports with modifiers
 * - animated: copy and download animated icons (hover previews stay free)
 */
export const FEATURE_PLAN = {
  styles: 'pro',
  duoColors: 'pro',
  zip: 'pro',
  modifiers: 'advanced',
  animated: 'advanced',
} as const satisfies Record<string, PaidPlan>;

export type Feature = keyof typeof FEATURE_PLAN;

/** Stripe subscription statuses that grant a paid plan. */
const ENTITLED_STATUSES = new Set(['active', 'trialing']);

/**
 * The plan a stored billing status grants. The webhook already records `free`
 * for subscriptions that don't qualify; this also checks the status, so a stale
 * or partial row never unlocks paid features.
 */
export function entitledPlan(status: { plan: unknown; status: unknown } | null | undefined): Plan {
  if (!status || !isPaidPlan(status.plan)) return 'free';
  return typeof status.status === 'string' && ENTITLED_STATUSES.has(status.status) ? status.plan : 'free';
}

export function planAllows(plan: Plan, feature: Feature) {
  return PLAN_LEVEL[plan] >= PLAN_LEVEL[FEATURE_PLAN[feature]];
}

/**
 * Before paid plans can be bought, only the paid styles are locked, as they
 * were before billing existed. Bulk ZIPs, duo colors, and modifiers stay free
 * until enforcement is on.
 */
export function legacyAllows(feature: Feature) {
  return feature !== 'styles';
}
