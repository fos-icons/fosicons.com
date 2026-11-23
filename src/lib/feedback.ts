export const FEEDBACK_TYPES = {
  'new-icon': 'New icon request',
  site: 'Site issue',
  package: 'Package issue',
  icon: 'Icon issue',
} as const;

export type FeedbackType = keyof typeof FEEDBACK_TYPES;
export const FEEDBACK_PATH = '/api/feedback';
export const FEEDBACK_MAX_LENGTH = 2000;

export function isFeedbackType(value: unknown): value is FeedbackType {
  return typeof value === 'string' && Object.hasOwn(FEEDBACK_TYPES, value);
}
