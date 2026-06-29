import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import AdminScreenNavigation, { AdminNavState, setCurrentAdminNav } from './AdminScreenNavigation';
import * as FeatureFlags from '@/lib/hooks/UseFeatureFlags';
import {
  PRIVILEGED_IDENTITY_MANAGEMENT,
  TRUSTEE_SOFTWARE_BANK_DISPLAY,
} from '@/lib/hooks/UseFeatureFlags';
import { testFeatureFlags } from '@common/feature-flags';

describe('Admin screen navigation tests', () => {
  beforeEach(async () => {
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
    vi.spyOn(FeatureFlags, 'default').mockReturnValue(testFeatureFlags);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  function renderNav(initialNavState: AdminNavState = AdminNavState.PRIVILEGED_IDENTITY) {
    render(
      <BrowserRouter>
        <AdminScreenNavigation initiallySelectedNavLink={initialNavState} />
      </BrowserRouter>,
    );
  }

  function renderWithoutProps() {
    renderNav(AdminNavState.PRIVILEGED_IDENTITY);
  }

  test('should return the proper class name', async () => {
    expect(
      setCurrentAdminNav(AdminNavState.PRIVILEGED_IDENTITY, AdminNavState.PRIVILEGED_IDENTITY),
    ).toEqual('usa-current current');
    expect(setCurrentAdminNav(AdminNavState.UNKNOWN, AdminNavState.PRIVILEGED_IDENTITY)).toEqual(
      '',
    );
  });

  test('should render Banks nav link', () => {
    renderWithoutProps();
    const navLink = screen.getByTestId('banks-nav-link');
    expect(navLink).toBeInTheDocument();
    expect(navLink).toHaveTextContent('Banks');
    expect(navLink).toHaveAttribute('href', '/admin/banks');
  });

  test('should render Case Reload nav link', () => {
    renderWithoutProps();
    const navLink = screen.getByTestId('case-reload-nav-link');
    expect(navLink).toBeInTheDocument();
    expect(navLink).toHaveTextContent('Reload Case');
    expect(navLink).toHaveAttribute('href', '/admin/case-reload');
  });

  test('should apply active class to initially selected nav link', () => {
    renderNav(AdminNavState.BANKS);
    expect(screen.getByTestId('banks-nav-link')).toHaveClass('usa-current');
    expect(screen.getByTestId('case-reload-nav-link')).not.toHaveClass('usa-current');
  });

  test('should update active nav when Banks link is clicked', async () => {
    renderWithoutProps();
    await userEvent.click(screen.getByTestId('banks-nav-link'));
    expect(screen.getByTestId('banks-nav-link')).toHaveClass('usa-current');
  });

  test('should update active nav when Case Reload link is clicked', async () => {
    renderWithoutProps();
    await userEvent.click(screen.getByTestId('case-reload-nav-link'));
    expect(screen.getByTestId('case-reload-nav-link')).toHaveClass('usa-current');
  });

  describe('Feature flag tests for Bankruptcy Software nav link', () => {
    test('should display Bankruptcy Software nav link when TRUSTEE_SOFTWARE_BANK_DISPLAY flag is true', () => {
      vi.spyOn(FeatureFlags, 'default').mockReturnValue({
        [TRUSTEE_SOFTWARE_BANK_DISPLAY]: true,
      });

      renderWithoutProps();

      const navLink = screen.queryByTestId('bankruptcy-software-nav-link');
      expect(navLink).toBeInTheDocument();
      expect(navLink).toHaveTextContent('Bankruptcy Software');
      expect(navLink).toHaveAttribute('href', '/admin/bankruptcy-software');
    });

    test('should not display Bankruptcy Software nav link when TRUSTEE_SOFTWARE_BANK_DISPLAY flag is false', () => {
      vi.spyOn(FeatureFlags, 'default').mockReturnValue({
        [TRUSTEE_SOFTWARE_BANK_DISPLAY]: false,
      });

      renderWithoutProps();

      expect(screen.queryByTestId('bankruptcy-software-nav-link')).not.toBeInTheDocument();
    });

    test('should update active nav when Bankruptcy Software link is clicked', async () => {
      vi.spyOn(FeatureFlags, 'default').mockReturnValue({
        [TRUSTEE_SOFTWARE_BANK_DISPLAY]: true,
      });

      renderNav(AdminNavState.BANKS);
      await userEvent.click(screen.getByTestId('bankruptcy-software-nav-link'));
      expect(screen.getByTestId('bankruptcy-software-nav-link')).toHaveClass('usa-current');
    });
  });

  describe('Feature flag tests for Banks nav link', () => {
    test('should display Banks nav link when TRUSTEE_SOFTWARE_BANK_DISPLAY flag is true', () => {
      vi.spyOn(FeatureFlags, 'default').mockReturnValue({
        [TRUSTEE_SOFTWARE_BANK_DISPLAY]: true,
      });
      renderWithoutProps();
      const navLink = screen.queryByTestId('banks-nav-link');
      expect(navLink).toBeInTheDocument();
      expect(navLink).toHaveTextContent('Banks');
      expect(navLink).toHaveAttribute('href', '/admin/banks');
    });

    test('should not display Banks nav link when TRUSTEE_SOFTWARE_BANK_DISPLAY flag is false', () => {
      vi.spyOn(FeatureFlags, 'default').mockReturnValue({
        [TRUSTEE_SOFTWARE_BANK_DISPLAY]: false,
      });
      renderWithoutProps();
      expect(screen.queryByTestId('banks-nav-link')).not.toBeInTheDocument();
    });
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

    test('should update active nav when Privileged Identity link is clicked', async () => {
      vi.spyOn(FeatureFlags, 'default').mockReturnValue({
        [PRIVILEGED_IDENTITY_MANAGEMENT]: true,
        [TRUSTEE_SOFTWARE_BANK_DISPLAY]: true,
      });

      renderNav(AdminNavState.BANKS);
      await userEvent.click(screen.getByTestId('privileged-identity-nav-link'));
      expect(screen.getByTestId('privileged-identity-nav-link')).toHaveClass('usa-current');
      expect(screen.getByTestId('banks-nav-link')).not.toHaveClass('usa-current');
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
