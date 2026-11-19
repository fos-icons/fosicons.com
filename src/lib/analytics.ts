import type { BeforeSend } from '@vercel/analytics/react';

/** Share page paths with analytics while keeping the catalog's URL state local. */
export const prepareAnalyticsEvent: BeforeSend = (event) => {
  if (event.type !== 'pageview') return null;
  const url = new URL(event.url);
  url.search = '';
  url.hash = '';
  return { ...event, url: url.href };
};
