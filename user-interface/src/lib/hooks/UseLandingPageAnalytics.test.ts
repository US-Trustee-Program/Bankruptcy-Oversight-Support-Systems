import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useLandingPageAnalytics } from './UseLandingPageAnalytics';
import * as UseApplicationInsights from './UseApplicationInsights';
import * as UseFeatureFlags from './UseFeatureFlags';

describe('useLandingPageAnalytics', () => {
  const mockTrackEvent = vi.fn();
  const mockAppInsights = {
    trackEvent: mockTrackEvent,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(UseApplicationInsights, 'getAppInsights').mockReturnValue({
      appInsights: mockAppInsights as unknown as ReturnType<
        typeof UseApplicationInsights.getAppInsights
      >['appInsights'],
      reactPlugin: {} as unknown as ReturnType<
        typeof UseApplicationInsights.getAppInsights
      >['reactPlugin'],
    });
    vi.spyOn(UseFeatureFlags, 'default').mockReturnValue({
      'case-search-landing-page': false,
    });
  });

  describe('trackNavigation', () => {
    it('should track navigation event with correct properties', () => {
      const { result } = renderHook(() => useLandingPageAnalytics('case-search'));

      result.current.trackNavigation('/case-detail/123');

      expect(mockTrackEvent).toHaveBeenCalledTimes(1);
      const event = mockTrackEvent.mock.calls[0][0];
      expect(event.name).toBe('Landing Page Navigation');
      expect(event.properties.fromPage).toBe('case-search');
      expect(event.properties.toPage).toBe('/case-detail/123');
      expect(event.properties.featureFlagEnabled).toBe(false);
      expect(event.properties.timeOnLandingPage).toBeGreaterThanOrEqual(0);
      expect(event.properties.timestamp).toBeGreaterThan(0);
    });

    it('should track navigation from my-cases landing page', () => {
      const { result } = renderHook(() => useLandingPageAnalytics('my-cases'));

      result.current.trackNavigation('/search');

      expect(mockTrackEvent).toHaveBeenCalledTimes(1);
      const event = mockTrackEvent.mock.calls[0][0];
      expect(event.properties.fromPage).toBe('my-cases');
      expect(event.properties.toPage).toBe('/search');
    });

    it('should include feature flag state when enabled', () => {
      vi.spyOn(UseFeatureFlags, 'default').mockReturnValue({
        'case-search-landing-page': true,
      });

      const { result } = renderHook(() => useLandingPageAnalytics('case-search'));

      result.current.trackNavigation('/my-cases');

      const event = mockTrackEvent.mock.calls[0][0];
      expect(event.properties.featureFlagEnabled).toBe(true);
    });

    it('should calculate time on landing page', async () => {
      const { result } = renderHook(() => useLandingPageAnalytics('case-search'));

      // Wait a bit before navigating
      await new Promise((resolve) => setTimeout(resolve, 10));

      result.current.trackNavigation('/my-cases');

      const event = mockTrackEvent.mock.calls[0][0];
      expect(event.properties.timeOnLandingPage).toBeGreaterThan(0);
    });
  });

  describe('trackFirstSearch', () => {
    it('should track first search event with correct properties', () => {
      const { result } = renderHook(() => useLandingPageAnalytics('case-search'));

      result.current.trackFirstSearch('case-number');

      expect(mockTrackEvent).toHaveBeenCalledTimes(1);
      const event = mockTrackEvent.mock.calls[0][0];
      expect(event.name).toBe('First Search Action');
      expect(event.properties.landingPage).toBe('case-search');
      expect(event.properties.searchType).toBe('case-number');
      expect(event.properties.featureFlagEnabled).toBe(false);
      expect(event.properties.timeToFirstSearch).toBeGreaterThanOrEqual(0);
      expect(event.properties.timestamp).toBeGreaterThan(0);
    });

    it('should only track first search once', () => {
      const { result } = renderHook(() => useLandingPageAnalytics('case-search'));

      result.current.trackFirstSearch('case-number');
      result.current.trackFirstSearch('debtor-name');
      result.current.trackFirstSearch('ssn');

      expect(mockTrackEvent).toHaveBeenCalledTimes(1);
      const event = mockTrackEvent.mock.calls[0][0];
      expect(event.properties.searchType).toBe('case-number');
    });

    it('should track different search types', () => {
      const searchTypes = ['case-number', 'debtor-name', 'ssn', 'other'] as const;

      searchTypes.forEach((searchType) => {
        vi.clearAllMocks();
        const { result } = renderHook(() => useLandingPageAnalytics('case-search'));

        result.current.trackFirstSearch(searchType);

        const event = mockTrackEvent.mock.calls[0][0];
        expect(event.properties.searchType).toBe(searchType);
      });
    });

    it('should calculate time to first search', async () => {
      const { result } = renderHook(() => useLandingPageAnalytics('case-search'));

      // Wait a bit before searching
      await new Promise((resolve) => setTimeout(resolve, 10));

      result.current.trackFirstSearch('debtor-name');

      const event = mockTrackEvent.mock.calls[0][0];
      expect(event.properties.timeToFirstSearch).toBeGreaterThan(0);
    });

    it('should work from my-cases landing page', () => {
      const { result } = renderHook(() => useLandingPageAnalytics('my-cases'));

      result.current.trackFirstSearch('case-number');

      const event = mockTrackEvent.mock.calls[0][0];
      expect(event.properties.landingPage).toBe('my-cases');
    });
  });

  describe('tracking state', () => {
    it('should reset tracking state on remount', () => {
      const { result, unmount } = renderHook(() => useLandingPageAnalytics('case-search'));

      result.current.trackFirstSearch('case-number');
      expect(mockTrackEvent).toHaveBeenCalledTimes(1);

      unmount();

      // Create a new hook instance (simulating remount)
      const { result: result2 } = renderHook(() => useLandingPageAnalytics('case-search'));

      // After remount, should be able to track first search again
      result2.current.trackFirstSearch('debtor-name');
      expect(mockTrackEvent).toHaveBeenCalledTimes(2);
    });
  });
});
