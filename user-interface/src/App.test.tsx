import { ComponentType } from 'react';
import { act, render, waitFor, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import * as LaunchDarklyReactClientSdk from 'launchdarkly-react-client-sdk';
import App from './App';
import * as HeaderModule from './lib/components/Header';
import * as UseLandingPageAnalyticsModule from './lib/hooks/UseLandingPageAnalytics';
import { getAppInsights } from './lib/hooks/UseApplicationInsights';
import useFeatureFlags from './lib/hooks/UseFeatureFlags';
import LocalStorage from '@/lib/utils/local-storage';
import { buildLaunchDarklyContext } from '@common/feature-flags';
import MockData from '@common/cams/test-utilities/mock-data';

vi.mock('./lib/hooks/UseLandingPageAnalytics');
vi.mock('./lib/hooks/UseFeatureFlags');
vi.mock('./lib/hooks/UseApplicationInsights');
vi.mock('launchdarkly-react-client-sdk', () => {
  return {
    withLDProvider: () => (Component: ComponentType) => Component,
    useLDClient: vi.fn(),
  };
});

type MockLDClient = NonNullable<ReturnType<typeof LaunchDarklyReactClientSdk.useLDClient>>;

describe('App', () => {
  function scrollTo(position: number) {
    Object.defineProperty(window, 'scrollY', { value: position, writable: true });
    act(() => window.dispatchEvent(new Event('scroll')));
  }

  function renderWithoutProps() {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );
    scrollTo(0);
  }

  beforeEach(() => {
    window.scrollTo = vi.fn(({ top }) => {
      if (typeof top === 'number') {
        scrollTo(top);
      }
    });

    // Mock Application Insights
    const mockAppInsights = {
      trackEvent: vi.fn(),
      trackPageView: vi.fn(),
      trackException: vi.fn(),
    };

    const mockReactPlugin = {
      ...mockAppInsights,
      appInsights: mockAppInsights,
    };

    vi.mocked(getAppInsights).mockReturnValue({
      reactPlugin: mockReactPlugin as unknown as ReturnType<typeof getAppInsights>['reactPlugin'],
      appInsights: mockAppInsights as unknown as ReturnType<typeof getAppInsights>['appInsights'],
    });

    // Mock feature flags
    vi.mocked(useFeatureFlags).mockReturnValue({});

    // Mock analytics hook used by NavigationTracker
    vi.mocked(UseLandingPageAnalyticsModule.useLandingPageAnalytics).mockReturnValue({
      trackNavigation: vi.fn(),
      trackFirstSearch: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should show message when error boundary catches an error', async () => {
    vi.spyOn(HeaderModule, 'Header').mockImplementation(() => {
      throw Error('mock error');
    });

    renderWithoutProps();

    const alert = await screen.findByTestId('error-boundary-message');
    expect(alert).toBeInTheDocument();
  });

  test('should add className of header-scrolled-out to App when screen is scrolled down beyond 100px', async () => {
    renderWithoutProps();
    const app = document.querySelector('.App');
    expect(app).not.toHaveClass('header-scrolled-out');

    scrollTo(101);
    await waitFor(() => {
      expect(app).toHaveClass('header-scrolled-out');
    });

    scrollTo(90);
    await waitFor(() => {
      expect(app).not.toHaveClass('header-scrolled-out');
    });
  });

  test('should display scroll button when screen is scrolled beyond 100px', async () => {
    renderWithoutProps();
    const scrollToTopBtn = document.querySelector('.scroll-to-top-button');

    expect(scrollToTopBtn).not.toHaveClass('show');

    scrollTo(101);
    await waitFor(() => {
      expect(scrollToTopBtn).toHaveClass('show');
    });

    scrollTo(90);
    await waitFor(() => {
      expect(scrollToTopBtn).not.toHaveClass('show');
    });
  });

  test('should export App directly when featureFlagClientId is not configured', async () => {
    vi.resetModules();
    vi.doMock('@/configuration/appConfiguration', () => ({
      default: () => ({ featureFlagClientId: undefined }),
    }));

    const { default: AppComponent } = await import('./App');
    expect(AppComponent).toBeDefined();

    vi.doUnmock('@/configuration/appConfiguration');
    vi.resetModules();
  });

  test('should scroll to top when scroll-to-top button is clicked', async () => {
    renderWithoutProps();
    const scrollToTopBtn = document.querySelector('.scroll-to-top-button');

    await waitFor(() => {
      expect(window.scrollY).toEqual(0);
      expect(scrollToTopBtn).not.toHaveClass('show');
    });

    scrollTo(101);
    await waitFor(() => {
      expect(window.scrollY).toEqual(101);
    });

    (scrollToTopBtn as HTMLElement).click();
    await waitFor(() => {
      expect(window.scrollY).toEqual(0);
    });

    await waitFor(() => {
      expect(scrollToTopBtn).not.toHaveClass('show');
    });
  });

  describe('LaunchDarkly identify on mount', () => {
    test('calls identify with the session user when a session and ldClient are present', async () => {
      const session = MockData.getCamsSession();
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
      const identify = vi.fn();
      vi.mocked(LaunchDarklyReactClientSdk.useLDClient).mockReturnValue({
        identify,
        waitForInitialization: vi.fn().mockResolvedValue(undefined),
      } as Partial<MockLDClient> as MockLDClient);

      renderWithoutProps();

      await waitFor(() => {
        expect(identify).toHaveBeenCalledWith(buildLaunchDarklyContext(session.user));
      });
    });

    test('does not call identify or throw when there is no session', async () => {
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);
      const identify = vi.fn();
      vi.mocked(LaunchDarklyReactClientSdk.useLDClient).mockReturnValue({
        identify,
        waitForInitialization: vi.fn().mockResolvedValue(undefined),
      } as Partial<MockLDClient> as MockLDClient);

      expect(() => renderWithoutProps()).not.toThrow();
      expect(identify).not.toHaveBeenCalled();
    });

    test('does not call identify or throw when useLDClient returns undefined', async () => {
      const session = MockData.getCamsSession();
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
      vi.mocked(LaunchDarklyReactClientSdk.useLDClient).mockReturnValue(undefined);

      expect(() => renderWithoutProps()).not.toThrow();
    });
  });
});
