import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LandingPageProvider, useLandingPageContext } from './LandingPageContext';
import React from 'react';

describe('LandingPageContext', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <LandingPageProvider>{children}</LandingPageProvider>
  );

  describe('useLandingPageContext', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = () => {};

      expect(() => {
        renderHook(() => useLandingPageContext());
      }).toThrow('useLandingPageContext must be used within a LandingPageProvider');

      console.error = originalError;
    });

    it('should provide initial state', () => {
      const { result } = renderHook(() => useLandingPageContext(), { wrapper });

      expect(result.current.landingPage).toBeNull();
      expect(result.current.landingTimestamp).toBeNull();
      expect(typeof result.current.setLandingPage).toBe('function');
    });

    it('should set landing page on first call', () => {
      const { result } = renderHook(() => useLandingPageContext(), { wrapper });

      act(() => {
        result.current.setLandingPage('case-search');
      });

      expect(result.current.landingPage).toBe('case-search');
      expect(result.current.landingTimestamp).toBeGreaterThan(0);
    });

    it('should not change landing page on subsequent calls', () => {
      const { result } = renderHook(() => useLandingPageContext(), { wrapper });

      act(() => {
        result.current.setLandingPage('case-search');
      });

      const firstTimestamp = result.current.landingTimestamp;

      act(() => {
        result.current.setLandingPage('my-cases');
      });

      // Should still be case-search, not my-cases
      expect(result.current.landingPage).toBe('case-search');
      expect(result.current.landingTimestamp).toBe(firstTimestamp);
    });

    it('should handle my-cases as landing page', () => {
      const { result } = renderHook(() => useLandingPageContext(), { wrapper });

      act(() => {
        result.current.setLandingPage('my-cases');
      });

      expect(result.current.landingPage).toBe('my-cases');
      expect(result.current.landingTimestamp).toBeGreaterThan(0);
    });

    it('should set timestamp when landing page is set', () => {
      const { result } = renderHook(() => useLandingPageContext(), { wrapper });

      const beforeTimestamp = Date.now();

      act(() => {
        result.current.setLandingPage('case-search');
      });

      const afterTimestamp = Date.now();

      expect(result.current.landingTimestamp).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(result.current.landingTimestamp).toBeLessThanOrEqual(afterTimestamp);
    });

    it('should reset on remount', () => {
      const { result, unmount } = renderHook(() => useLandingPageContext(), { wrapper });

      act(() => {
        result.current.setLandingPage('case-search');
      });

      expect(result.current.landingPage).toBe('case-search');

      unmount();

      const { result: result2 } = renderHook(() => useLandingPageContext(), { wrapper });

      expect(result2.current.landingPage).toBeNull();
      expect(result2.current.landingTimestamp).toBeNull();
    });
  });

  describe('LandingPageProvider', () => {
    it('should allow multiple consumers', () => {
      // Create a custom hook that returns two consumers
      const useMultipleConsumers = () => {
        const context1 = useLandingPageContext();
        const context2 = useLandingPageContext();
        return { context1, context2 };
      };

      const { result } = renderHook(() => useMultipleConsumers(), { wrapper });

      act(() => {
        result.current.context1.setLandingPage('case-search');
      });

      // Both consumers should see the same landing page since they share the same provider
      expect(result.current.context1.landingPage).toBe('case-search');
      expect(result.current.context2.landingPage).toBe('case-search');
    });
  });
});
