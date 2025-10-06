import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AdminScreenNavigation, { AdminNavState, setCurrentAdminNav } from './AdminScreenNavigation';
import * as FeatureFlags from '@/lib/hooks/UseFeatureFlags';
import { PRIVILEGED_IDENTITY_MANAGEMENT } from '@/lib/hooks/UseFeatureFlags';

describe('Admin screen navigation tests', () => {
  beforeEach(async () => {
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  function renderWithoutProps() {
    render(
      <BrowserRouter>
        <AdminScreenNavigation initiallySelectedNavLink={AdminNavState.PRIVILEGED_IDENTITY} />
      </BrowserRouter>,
    );
  }

  test('should render navigation', async () => {
    renderWithoutProps();
    expect(document.querySelector('.admin-screen-navigation')).toBeInTheDocument();
  });

  test('should return the proper class name', async () => {
    expect(
      setCurrentAdminNav(AdminNavState.PRIVILEGED_IDENTITY, AdminNavState.PRIVILEGED_IDENTITY),
    ).toEqual('usa-current current');
    expect(setCurrentAdminNav(AdminNavState.UNKNOWN, AdminNavState.PRIVILEGED_IDENTITY)).toEqual(
      '',
    );
  });

  describe('Feature flag tests for Privileged Identity nav link', () => {
    test('should display Privileged Identity nav link when PRIVILEGED_IDENTITY_MANAGEMENT flag is true', () => {
      // Mock the feature flags to enable the PRIVILEGED_IDENTITY_MANAGEMENT flag
      vi.spyOn(FeatureFlags, 'default').mockReturnValue({
        [PRIVILEGED_IDENTITY_MANAGEMENT]: true,
      });

      renderWithoutProps();

      const navLink = screen.queryByTestId('privileged-identity-nav-link');
      expect(navLink).toBeInTheDocument();
      expect(navLink).toHaveTextContent('Privileged Identity');
    });

    test('should not display Privileged Identity nav link when PRIVILEGED_IDENTITY_MANAGEMENT flag is false', () => {
      // Mock the feature flags to disable the PRIVILEGED_IDENTITY_MANAGEMENT flag
      vi.spyOn(FeatureFlags, 'default').mockReturnValue({
        [PRIVILEGED_IDENTITY_MANAGEMENT]: false,
      });

      renderWithoutProps();

      const navLink = screen.queryByTestId('privileged-identity-nav-link');
      expect(navLink).not.toBeInTheDocument();
    });
  });
});
