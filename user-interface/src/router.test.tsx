import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import * as ReactRouterDOM from 'react-router-dom';
import App from './App';
import { vi } from 'vitest';
import LocalStorage from './lib/utils/local-storage';
import MockData from '@common/cams/test-utilities/mock-data';
import { CamsRole } from '@common/cams/roles';
import * as FeatureFlags from '@/lib/hooks/UseFeatureFlags';
import useFeatureFlagReadiness from '@/lib/hooks/UseFeatureFlagReadiness';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';

vi.mock('@/lib/hooks/UseFeatureFlagReadiness');

describe('App Router Tests', () => {
  let userEvent: CamsUserEvent;

  vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
      ...(actual as typeof actual),
      useLocation: vi.fn().mockReturnValue({
        pathname: '/',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      }),
    };
  });

  const setUseLocationMock = (pathname: string = '/', state: object | undefined = undefined) => {
    vi.mocked(ReactRouterDOM.useLocation).mockReturnValue({
      pathname,
      search: '',
      hash: '',
      state,
      key: 'default',
    } as ReturnType<typeof ReactRouterDOM.useLocation>);
  };

  beforeAll(async () => {
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
  });

  beforeEach(() => {
    userEvent = TestingUtilities.setupUserEvent();
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(
      MockData.getCamsSession({
        user: MockData.getCamsUser({
          roles: [CamsRole.CaseAssignmentManager],
        }),
      }),
    );
    // Resolved by default so AddTrusteeRouteGuard decides deterministically from the mocked
    // flags above instead of racing the real LaunchDarkly SDK (waitForInitialization()).
    vi.mocked(useFeatureFlagReadiness).mockReturnValue({
      isReady: true,
      hasTimedOut: true,
      hasIdentified: true,
    });
  });

  test('should route /search to SearchScreen', async () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );

    expect(screen.getByTestId('header-search-link')).toBeVisible();

    await userEvent.click(screen.getByTestId('header-search-link'));

    await waitFor(() => {
      expect(document.querySelector('main.search-screen')).toBeInTheDocument();
    });
  });

  test('should route /trustees/create to trustee creation form when feature flag and role allow', async () => {
    const user = MockData.getCamsUser({ roles: [CamsRole.TrusteeAdmin] });
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(MockData.getCamsSession({ user }));

    vi.spyOn(FeatureFlags, 'default').mockReturnValue({
      'trustee-management': true,
      'restrict-adding-trustees': true,
    });

    setUseLocationMock('/trustees/create', {
      action: 'create',
      cancelTo: '/trustees',
    });

    render(
      <MemoryRouter initialEntries={['/trustees/create']}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(document.querySelector('[data-testid="trustee-public-form"]')).toBeInTheDocument();
    });
  });

  test('should render landing page when an invalid URL is supplied', async () => {
    vi.spyOn(FeatureFlags, 'default').mockReturnValue({
      'case-search-landing-page': true,
    });

    const config = window.CAMS_CONFIGURATION as Record<string, string | undefined>;
    const savedClientId = config.CAMS_FEATURE_FLAG_CLIENT_ID;
    config.CAMS_FEATURE_FLAG_CLIENT_ID = '';

    const badRoute = '/some/bad/route';

    render(
      <MemoryRouter initialEntries={[badRoute]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByText('Case Search', { selector: 'h1' });

    config.CAMS_FEATURE_FLAG_CLIENT_ID = savedClientId;
  });

  describe('Trustee route unauthorized access tests', () => {
    test('should show unauthorized message when accessing /trustees without TrusteeAdmin role', async () => {
      const unauthorizedUser = MockData.getCamsUser({ roles: [CamsRole.CaseAssignmentManager] });
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(
        MockData.getCamsSession({ user: unauthorizedUser }),
      );

      vi.spyOn(FeatureFlags, 'default').mockReturnValue({
        'trustee-management': true, // Feature flag enabled
      });

      render(
        <MemoryRouter initialEntries={['/trustees']}>
          <App />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(document.querySelector('[data-testid="trustees-add-link"]')).not.toBeInTheDocument();
      });
    });

    test('should show unauthorized message when accessing /trustees/create without TrusteeAdmin role', async () => {
      const unauthorizedUser = MockData.getCamsUser({ roles: [CamsRole.DataVerifier] });
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(
        MockData.getCamsSession({ user: unauthorizedUser }),
      );

      vi.spyOn(FeatureFlags, 'default').mockReturnValue({
        'trustee-management': true, // Feature flag enabled
        'restrict-adding-trustees': true,
      });

      setUseLocationMock('/trustees/create', {
        action: 'create',
        cancelTo: '/trustees',
      });

      render(
        <MemoryRouter initialEntries={['/trustees/create']}>
          <App />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('alert-forbidden-alert')).toBeInTheDocument();
      });
    });

    test('should show disabled message when accessing /trustees/create with feature flag disabled', async () => {
      const authorizedUser = MockData.getCamsUser({ roles: [CamsRole.TrusteeAdmin] });
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(
        MockData.getCamsSession({ user: authorizedUser }),
      );

      vi.spyOn(FeatureFlags, 'default').mockReturnValue({
        'trustee-management': false, // Feature flag disabled
        'restrict-adding-trustees': true,
      });

      setUseLocationMock('/trustees/create', {
        action: 'create',
        cancelTo: '/trustees',
      });

      render(
        <MemoryRouter initialEntries={['/trustees/create']}>
          <App />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(
          document.querySelector('[data-testid="trustee-create-disabled"]'),
        ).toBeInTheDocument();
      });
    });

    test('should redirect /trustees/create to /trustees when restrict-adding-trustees is disabled', async () => {
      const authorizedUser = MockData.getCamsUser({ roles: [CamsRole.TrusteeAdmin] });
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(
        MockData.getCamsSession({ user: authorizedUser }),
      );

      vi.spyOn(FeatureFlags, 'default').mockReturnValue({
        'trustee-management': true,
        'restrict-adding-trustees': false,
      });

      setUseLocationMock('/trustees/create', {
        action: 'create',
        cancelTo: '/trustees',
      });

      render(
        <MemoryRouter initialEntries={['/trustees/create']}>
          <App />
        </MemoryRouter>,
      );

      // The MainContent/Outlet wrapper (data-testid="trustees") renders both while the guard is
      // still deciding and after a real redirect, so it can't distinguish the two on its own.
      // Assert the redirect actually completed: the guard's loading spinner is gone and the full
      // trustees screen (only rendered once /trustees/create is no longer the active route) is up.
      // (TrusteesList renders its own unrelated `role="status"` live region, so check the
      // guard's spinner by its caption text rather than by role.)
      await waitFor(() => {
        expect(screen.queryByText('Checking access...')).not.toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Trustees', level: 1 })).toBeInTheDocument();
      });
      expect(document.querySelector('[data-testid="trustee-public-form"]')).not.toBeInTheDocument();
    });
  });
});
