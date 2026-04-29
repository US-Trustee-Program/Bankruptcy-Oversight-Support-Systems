import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { GoHome } from './GoHome';
import useFeatureFlags, { CASE_SEARCH_LANDING_PAGE } from '@/lib/hooks/UseFeatureFlags';
import useCamsNavigator from '../hooks/UseCamsNavigator';
import { LOGIN_SUCCESS_PATH, CASE_SEARCH_PATH } from '@/login/login-library';
import * as LaunchDarkly from 'launchdarkly-react-client-sdk';
import * as featureFlagConfig from '@/configuration/featureFlagConfiguration';

vi.mock('@/lib/hooks/UseFeatureFlags');
vi.mock('../hooks/UseCamsNavigator');
vi.mock('launchdarkly-react-client-sdk');
vi.mock('@/configuration/featureFlagConfiguration');

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
      allFlags: vi.fn().mockReturnValue({}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    // Default: LaunchDarkly is configured
    vi.mocked(featureFlagConfig.getFeatureFlagConfiguration).mockReturnValue({
      clientId: 'test-client-id',
      useExternalProvider: true,
      useCamelCaseFlagKeys: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should navigate to CASE_SEARCH_PATH when feature flag is enabled and no custom path provided', async () => {
    // RED: This test will fail because GoHome doesn't check the feature flag yet
    vi.mocked(useFeatureFlags).mockReturnValue({
      [CASE_SEARCH_LANDING_PAGE]: true,
    });

    render(<GoHome />);

    await waitFor(() => {
      expect(mockNavigateTo).toHaveBeenCalledWith(CASE_SEARCH_PATH);
    });
  });

  test('should navigate to LOGIN_SUCCESS_PATH when feature flag is disabled and no custom path provided', async () => {
    vi.mocked(useFeatureFlags).mockReturnValue({
      [CASE_SEARCH_LANDING_PAGE]: false,
    });

    render(<GoHome />);

    await waitFor(() => {
      expect(mockNavigateTo).toHaveBeenCalledWith(LOGIN_SUCCESS_PATH);
    });
  });

  test('should navigate to LOGIN_SUCCESS_PATH when feature flag is undefined and no custom path provided', async () => {
    vi.mocked(useFeatureFlags).mockReturnValue({});

    render(<GoHome />);

    await waitFor(() => {
      expect(mockNavigateTo).toHaveBeenCalledWith(LOGIN_SUCCESS_PATH);
    });
  });

  test('should navigate to custom path when provided, regardless of feature flag', async () => {
    const customPath = '/custom-route';
    vi.mocked(useFeatureFlags).mockReturnValue({
      [CASE_SEARCH_LANDING_PAGE]: true,
    });

    render(<GoHome path={customPath} />);

    await waitFor(() => {
      expect(mockNavigateTo).toHaveBeenCalledWith(customPath);
    });
  });

  test('should navigate when LaunchDarkly initialization fails', async () => {
    const mockWaitForInitialization = vi.fn().mockRejectedValue(new Error('LD init failed'));

    vi.mocked(LaunchDarkly.useLDClient).mockReturnValue({
      waitForInitialization: mockWaitForInitialization,
    } as unknown as ReturnType<typeof LaunchDarkly.useLDClient>);

    vi.mocked(useFeatureFlags).mockReturnValue({
      [CASE_SEARCH_LANDING_PAGE]: false,
    });

    render(<GoHome />);

    await waitFor(() => {
      expect(mockNavigateTo).toHaveBeenCalledWith(LOGIN_SUCCESS_PATH);
    });
  });

  test('should navigate immediately when LaunchDarkly is not configured', async () => {
    // Mock config to indicate LD is not configured
    vi.mocked(featureFlagConfig.getFeatureFlagConfiguration).mockReturnValue({
      clientId: '',
      useExternalProvider: false,
      useCamelCaseFlagKeys: false,
    });

    vi.mocked(LaunchDarkly.useLDClient).mockReturnValue(undefined);

    vi.mocked(useFeatureFlags).mockReturnValue({
      [CASE_SEARCH_LANDING_PAGE]: false,
    });

    render(<GoHome />);

    await waitFor(() => {
      expect(mockNavigateTo).toHaveBeenCalledWith(LOGIN_SUCCESS_PATH);
    });
  });
});
