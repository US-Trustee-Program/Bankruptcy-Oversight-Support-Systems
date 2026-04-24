import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { GoHome } from './GoHome';
import useFeatureFlags, { CASE_SEARCH_LANDING_PAGE } from '@/lib/hooks/UseFeatureFlags';
import useCamsNavigator from '../hooks/UseCamsNavigator';
import { LOGIN_SUCCESS_PATH, CASE_SEARCH_PATH } from '@/login/login-library';
import * as LaunchDarkly from 'launchdarkly-react-client-sdk';
import { LandingPageProvider } from '@/lib/contexts/LandingPageContext';

vi.mock('@/lib/hooks/UseFeatureFlags');
vi.mock('../hooks/UseCamsNavigator');
vi.mock('launchdarkly-react-client-sdk');

describe('GoHome Component', () => {
  const mockNavigateTo = vi.fn();
  const mockWaitForInitialization = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.mocked(useCamsNavigator).mockReturnValue({
      navigateTo: mockNavigateTo,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    vi.mocked(LaunchDarkly.useLDClient).mockReturnValue({
      waitForInitialization: mockWaitForInitialization,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should navigate to CASE_SEARCH_PATH when feature flag is enabled and no custom path provided', async () => {
    // RED: This test will fail because GoHome doesn't check the feature flag yet
    vi.mocked(useFeatureFlags).mockReturnValue({
      [CASE_SEARCH_LANDING_PAGE]: true,
    });

    render(
      <LandingPageProvider>
        <GoHome />
      </LandingPageProvider>,
    );

    await waitFor(() => {
      expect(mockNavigateTo).toHaveBeenCalledWith(CASE_SEARCH_PATH);
    });
  });

  test('should navigate to LOGIN_SUCCESS_PATH when feature flag is disabled and no custom path provided', async () => {
    vi.mocked(useFeatureFlags).mockReturnValue({
      [CASE_SEARCH_LANDING_PAGE]: false,
    });

    render(
      <LandingPageProvider>
        <GoHome />
      </LandingPageProvider>,
    );

    await waitFor(() => {
      expect(mockNavigateTo).toHaveBeenCalledWith(LOGIN_SUCCESS_PATH);
    });
  });

  test('should navigate to LOGIN_SUCCESS_PATH when feature flag is undefined and no custom path provided', async () => {
    vi.mocked(useFeatureFlags).mockReturnValue({});

    render(
      <LandingPageProvider>
        <GoHome />
      </LandingPageProvider>,
    );

    await waitFor(() => {
      expect(mockNavigateTo).toHaveBeenCalledWith(LOGIN_SUCCESS_PATH);
    });
  });

  test('should navigate to custom path when provided, regardless of feature flag', async () => {
    const customPath = '/custom-route';
    vi.mocked(useFeatureFlags).mockReturnValue({
      [CASE_SEARCH_LANDING_PAGE]: true,
    });

    render(
      <LandingPageProvider>
        <GoHome path={customPath} />
      </LandingPageProvider>,
    );

    await waitFor(() => {
      expect(mockNavigateTo).toHaveBeenCalledWith(customPath);
    });
  });
});

describe('GoHome Component - Integration Tests', () => {
  const mockNavigateTo = vi.fn();
  const mockWaitForInitialization = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.resetModules();
    vi.mocked(useCamsNavigator).mockReturnValue({
      navigateTo: mockNavigateTo,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    vi.mocked(LaunchDarkly.useLDClient).mockReturnValue({
      waitForInitialization: mockWaitForInitialization,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should route to Case Search when LaunchDarkly returns flag as enabled', async () => {
    vi.mocked(LaunchDarkly.useFlags).mockReturnValue({
      [CASE_SEARCH_LANDING_PAGE]: true,
    });

    vi.mocked(useFeatureFlags).mockReturnValue({
      [CASE_SEARCH_LANDING_PAGE]: true,
    });

    render(
      <LandingPageProvider>
        <GoHome />
      </LandingPageProvider>,
    );

    await waitFor(() => {
      expect(mockNavigateTo).toHaveBeenCalledWith(CASE_SEARCH_PATH);
    });
  });

  test('should route to My Cases when LaunchDarkly returns flag as disabled', async () => {
    vi.mocked(LaunchDarkly.useFlags).mockReturnValue({
      [CASE_SEARCH_LANDING_PAGE]: false,
    });

    vi.mocked(useFeatureFlags).mockReturnValue({
      [CASE_SEARCH_LANDING_PAGE]: false,
    });

    render(
      <LandingPageProvider>
        <GoHome />
      </LandingPageProvider>,
    );

    await waitFor(() => {
      expect(mockNavigateTo).toHaveBeenCalledWith(LOGIN_SUCCESS_PATH);
    });
  });

  test('should route to My Cases when LaunchDarkly is unavailable', async () => {
    vi.mocked(LaunchDarkly.useFlags).mockReturnValue({});

    vi.mocked(useFeatureFlags).mockReturnValue({});

    render(
      <LandingPageProvider>
        <GoHome />
      </LandingPageProvider>,
    );

    await waitFor(() => {
      expect(mockNavigateTo).toHaveBeenCalledWith(LOGIN_SUCCESS_PATH);
    });
  });
});
