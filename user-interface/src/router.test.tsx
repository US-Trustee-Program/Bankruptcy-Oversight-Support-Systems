import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import * as ReactRouterDOM from 'react-router-dom';
import App from './App';
import { vi } from 'vitest';
import LocalStorage from './lib/utils/local-storage';
import MockData from '@common/cams/test-utilities/mock-data';
import { CamsRole } from '@common/cams/roles';
import * as FeatureFlags from '@/lib/hooks/UseFeatureFlags';

describe('App Router Tests', () => {
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
    });
  };

  beforeAll(async () => {
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
  });

  beforeEach(() => {
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
    const user = MockData.getCamsUser({ roles: [CamsRole.TrusteeAdmin] });
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(MockData.getCamsSession({ user }));

    vi.spyOn(FeatureFlags, 'default').mockReturnValue({
      'trustee-management': true,
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
      expect(document.querySelector('[data-testid="trustee-form"]')).toBeInTheDocument();
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
  });
});
