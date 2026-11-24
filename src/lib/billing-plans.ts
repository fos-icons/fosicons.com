export const PAID_PLANS = {
  pro: { firstYear: 49, renewal: 69 },
  advanced: { firstYear: 99, renewal: 129 },
} as const;

export type PaidPlan = keyof typeof PAID_PLANS;

export function isPaidPlan(value: unknown): value is PaidPlan {
  return value === 'pro' || value === 'advanced';
}
