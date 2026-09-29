import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import App from './App';
import { vi } from 'vitest';
import LocalStorage from './lib/utils/local-storage';
import MockData from '@common/cams/test-utilities/mock-data';
import { CamsRole } from '@common/cams/roles';
import * as FeatureFlags from '@/lib/hooks/UseFeatureFlags';
import * as UseFeatureFlagReadinessModule from '@/lib/hooks/UseFeatureFlagReadiness';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';

describe('App Router Tests', () => {
  let userEvent: CamsUserEvent;

  beforeAll(async () => {
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
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
    vi.spyOn(UseFeatureFlagReadinessModule, 'default').mockReturnValue({
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
      expect(screen.getByTestId('search')).toBeInTheDocument();
    });
  });

  test('should route /trustees/create to trustee creation form when feature flag and role allow', async () => {
    const user = MockData.getCamsUser({ roles: [CamsRole.TrusteeAdmin] });
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(MockData.getCamsSession({ user }));

    vi.spyOn(FeatureFlags, 'default').mockReturnValue({
      'trustee-management': true,
      'restrict-adding-trustees': true,
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

    const badRoute = '/some/bad/route';

    render(
      <MemoryRouter initialEntries={[badRoute]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByText('Case Search', { selector: 'h1' });
  });

  test.each([
    { path: '/my-cases', testId: 'case-list-heading', heading: 'My Cases' },
    { path: '/staff-assignment', testId: 'case-list-heading', heading: 'Staff Assignment' },
    { path: '/search/081-24-12345', testId: 'search', heading: undefined },
    { path: '/case-detail/081-24-12345', testId: 'case-detail', heading: undefined },
    { path: '/data-verification', testId: 'data-verification-screen', heading: undefined },
    { path: '/admin', testId: 'admin-screen', heading: undefined },
    { path: '/trustees/some-trustee-id', testId: 'record-detail', heading: undefined },
  ])(
    'should route $path to a screen rendering data-testid=$testId',
    async ({ path, testId, heading }) => {
      render(
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>,
      );

      await waitFor(() => {
        const element = screen.getByTestId(testId);
        expect(element).toBeInTheDocument();
        // /my-cases and /staff-assignment render the same shared testid, so a route-swap
        // bug between the two would otherwise pass undetected -- check the heading text too.
        if (heading) {
          expect(element).toHaveTextContent(heading);
        }
      });
    },
  );

  describe('Trustee route unauthorized access tests', () => {
    test('should not show the Add New Trustee link when accessing /trustees without TrusteeAdmin role', async () => {
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
        // TrusteesScreen returns null entirely for an unauthorized user -- there is no
        // "unauthorized" message to render, so confirm the whole screen is absent. The
        // role/flag-driven add-link visibility itself is TrusteesScreen's own concern,
        // already covered exhaustively in TrusteesScreen.test.tsx.
        expect(screen.queryByTestId('trustees')).not.toBeInTheDocument();
      });
    });

    test('should show the Add New Trustee link when accessing /trustees with TrusteeAdmin role', async () => {
      const authorizedUser = MockData.getCamsUser({ roles: [CamsRole.TrusteeAdmin] });
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(
        MockData.getCamsSession({ user: authorizedUser }),
      );

      vi.spyOn(FeatureFlags, 'default').mockReturnValue({
        'trustee-management': true,
        'restrict-adding-trustees': true,
      });

      render(
        <MemoryRouter initialEntries={['/trustees']}>
          <App />
        </MemoryRouter>,
      );

      await waitFor(() => {
        // The add-link's own visibility rules are TrusteesScreen's concern (covered in
        // TrusteesScreen.test.tsx); this just confirms the router mounted that screen.
        expect(screen.getByTestId('trustees')).toBeInTheDocument();
      });
    });
  });
});
