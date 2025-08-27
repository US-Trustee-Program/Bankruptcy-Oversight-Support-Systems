import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import App from './App';
import { vi } from 'vitest';
import LocalStorage from './lib/utils/local-storage';
import MockData from '@common/cams/test-utilities/mock-data';
import { CamsRole } from '@common/cams/roles';
import * as FeatureFlags from '@/lib/hooks/UseFeatureFlags';

describe('App Router Tests', () => {
  beforeAll(async () => {
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
  });

  beforeEach(() => {
    // Default user setup - can be overridden in individual tests
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(
      MockData.getCamsSession({
        user: MockData.getCamsUser({
          roles: [CamsRole.CaseAssignmentManager],
        }),
      }),
    );
  });

  test('should route /search to SearchScreen', async () => {
    render(<App />, { wrapper: BrowserRouter });

    expect(screen.getByTestId('header-search-link')).toBeVisible();

    await userEvent.click(screen.getByTestId('header-search-link'));

    await waitFor(() => {
      expect(document.querySelector('main.search-screen')).toBeInTheDocument();
    });
  });

  test('should route /trustees/create to TrusteeCreateForm when feature flag and role allow', async () => {
    // Override default mock with authorized user
    const user = MockData.getCamsUser({ roles: [CamsRole.TrusteeAdmin] });
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(MockData.getCamsSession({ user }));

    vi.spyOn(FeatureFlags, 'default').mockReturnValue({
      'trustee-management': true,
    });

    render(
      <MemoryRouter initialEntries={['/trustees/create']}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(document.querySelector('[data-testid="trustee-create-form"]')).toBeInTheDocument();
    });
  });

  test('should render My Cases page when an invalid URL is supplied', async () => {
    const badRoute = '/some/bad/route';

    // use <MemoryRouter> when you want to manually control the history
    render(
      <MemoryRouter initialEntries={[badRoute]}>
        <App />
      </MemoryRouter>,
    );

    // verify navigation to "no match" route
    await waitFor(() => {
      expect(document.querySelector('h1')).toHaveTextContent('My Cases');
    });
  });

  describe('Trustee route unauthorized access tests', () => {
    test('should show unauthorized message when accessing /trustees without TrusteeAdmin role', async () => {
      // Override default mock with user without TrusteeAdmin role
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

      // Should not render the trustees page content, but should handle gracefully
      await waitFor(() => {
        expect(document.querySelector('[data-testid="trustees-add-link"]')).not.toBeInTheDocument();
      });
    });

    test('should show unauthorized message when accessing /trustees/create without TrusteeAdmin role', async () => {
      // Override default mock with user without TrusteeAdmin role
      const unauthorizedUser = MockData.getCamsUser({ roles: [CamsRole.DataVerifier] });
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(
        MockData.getCamsSession({ user: unauthorizedUser }),
      );

      vi.spyOn(FeatureFlags, 'default').mockReturnValue({
        'trustee-management': true, // Feature flag enabled
      });

      render(
        <MemoryRouter initialEntries={['/trustees/create']}>
          <App />
        </MemoryRouter>,
      );

      // Should show unauthorized message from TrusteeCreateForm component
      await waitFor(() => {
        expect(
          screen.getByTestId('alert-forbidden-alert'),
          // document.querySelector('[data-testid="trustee-create-unauthorized"]'),
        ).toBeInTheDocument();
      });
    });

    test('should show disabled message when accessing /trustees/create with feature flag disabled', async () => {
      // Override default mock with user with TrusteeAdmin role but feature disabled
      const authorizedUser = MockData.getCamsUser({ roles: [CamsRole.TrusteeAdmin] });
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(
        MockData.getCamsSession({ user: authorizedUser }),
      );

      vi.spyOn(FeatureFlags, 'default').mockReturnValue({
        'trustee-management': false, // Feature flag disabled
      });

      render(
        <MemoryRouter initialEntries={['/trustees/create']}>
          <App />
        </MemoryRouter>,
      );

      // Should show disabled message from TrusteeCreateForm component
      await waitFor(() => {
        expect(
          document.querySelector('[data-testid="trustee-create-disabled"]'),
        ).toBeInTheDocument();
      });
    });
  });
});
