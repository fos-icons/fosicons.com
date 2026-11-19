import { describe, expect, it } from 'vitest';
import { prepareAnalyticsEvent } from '../src/lib/analytics';

describe('analytics privacy', () => {
  it('removes search, inspector settings, and fragments from reported URLs', () => {
    expect(prepareAnalyticsEvent({
      type: 'pageview',
      url: 'https://www.fosicons.com/?q=private+search&icon=clock&modifier=check#grid',
    })).toEqual({ type: 'pageview', url: 'https://www.fosicons.com/' });
    expect(prepareAnalyticsEvent({
      type: 'pageview',
      url: 'https://www.fosicons.com/icons/clock?style=solid',
    })).toEqual({ type: 'pageview', url: 'https://www.fosicons.com/icons/clock' });
  });

  it('drops custom events', () => {
    expect(prepareAnalyticsEvent({ type: 'event', url: 'https://www.fosicons.com/' })).toBeNull();
  });
});
