import { useCallback, useEffect, useRef } from 'react';
import { getAppInsights } from './UseApplicationInsights';
import { IEventTelemetry } from '@microsoft/applicationinsights-web';
import useFeatureFlags, { CASE_SEARCH_LANDING_PAGE } from './UseFeatureFlags';

type LandingPage = 'case-search' | 'my-cases';
type SearchType = 'case-number' | 'debtor-name' | 'ssn' | 'other';

interface LandingPageAnalyticsResult {
  trackNavigation: (toPage: string) => void;
  trackFirstSearch: (searchType: SearchType) => void;
}

/**
 * Hook to track analytics for landing page behavior.
 * Tracks navigation timing and time to first search action.
 *
 * @param landingPage - Which page the user landed on ('case-search' or 'my-cases')
 * @returns Object with tracking functions
 */
export function useLandingPageAnalytics(landingPage: LandingPage): LandingPageAnalyticsResult {
  const flags = useFeatureFlags();
  const featureFlagEnabled = !!flags[CASE_SEARCH_LANDING_PAGE];
  const landingTimestamp = useRef<number>(Date.now());
  const hasTrackedSearch = useRef<boolean>(false);
  const { appInsights } = getAppInsights();

  // Reset tracking state on mount
  useEffect(() => {
    landingTimestamp.current = Date.now();
    hasTrackedSearch.current = false;
  }, []);

  const trackNavigation = useCallback(
    (toPage: string) => {
      const timeOnLandingPage = Date.now() - landingTimestamp.current;

      const event: IEventTelemetry = {
        name: 'Landing Page Navigation',
        properties: {
          fromPage: landingPage,
          toPage,
          timeOnLandingPage,
          featureFlagEnabled,
          timestamp: Date.now(),
        },
      };

      appInsights.trackEvent(event);
    },
    [landingPage, featureFlagEnabled, appInsights],
  );

  const trackFirstSearch = useCallback(
    (searchType: SearchType) => {
      // Only track the first search action
      if (hasTrackedSearch.current) {
        return;
      }

      hasTrackedSearch.current = true;
      const timeToFirstSearch = Date.now() - landingTimestamp.current;

      const event: IEventTelemetry = {
        name: 'First Search Action',
        properties: {
          landingPage,
          timeToFirstSearch,
          searchType,
          featureFlagEnabled,
          timestamp: Date.now(),
        },
      };

      appInsights.trackEvent(event);
    },
    [landingPage, featureFlagEnabled, appInsights],
  );

  return {
    trackNavigation,
    trackFirstSearch,
  };
}
