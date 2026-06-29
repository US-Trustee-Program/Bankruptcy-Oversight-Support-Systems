import { render, screen } from '@testing-library/react';
import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom';
import { AdminScreen } from './AdminScreen';
import LocalStorage from '@/lib/utils/local-storage';
import MockData from '@common/cams/test-utilities/mock-data';
import { CamsRole } from '@common/cams/roles';
import { testFeatureFlags } from '@common/feature-flags';
import * as FeatureFlags from '@/lib/hooks/UseFeatureFlags';
import {
  PRIVILEGED_IDENTITY_MANAGEMENT,
  TRUSTEE_SOFTWARE_BANK_DISPLAY,
} from '@/lib/hooks/UseFeatureFlags';

vi.mock('@/lib/hooks/UseFeatureFlags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/hooks/UseFeatureFlags')>();
  return { ...actual, default: () => testFeatureFlags };
});

vi.mock('./privileged-identity/PrivilegedIdentity', () => ({
  PrivilegedIdentity: () => <div data-testid="mocked-privileged-identity" />,
}));
vi.mock('./bankruptcy-software/BankruptcySoftware', () => ({
  BankruptcySoftware: () => <div data-testid="mocked-bankruptcy-software" />,
}));
vi.mock('./case-reload/CaseReload', () => ({
  CaseReload: () => <div data-testid="mocked-case-reload" />,
}));
vi.mock('./banks/Banks', () => ({
  Banks: () => <div data-testid="mocked-banks" />,
}));
vi.mock('./banks/BankDetail', () => ({
  BankDetail: () => <div data-testid="mocked-bank-detail" />,
}));
vi.mock('./bankruptcy-software/BankruptcySoftwareDetail', () => ({
  BankruptcySoftwareDetail: () => <div data-testid="mocked-bankruptcy-software-detail" />,
}));

describe('Admin screen tests', () => {
  beforeEach(() => {
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
    const session = MockData.getCamsSession();
    session.user.roles = [CamsRole.SuperUser];
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderWithoutProps() {
    render(
      <BrowserRouter>
        <AdminScreen />
      </BrowserRouter>,
    );
  }

  test('should show prohibited alert for non-SuperUsers', () => {
    const session = MockData.getCamsSession();
    session.user.roles = [CamsRole.TrialAttorney];
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);

    renderWithoutProps();
    expect(screen.getByTestId('alert-container-forbidden-alert')).toBeInTheDocument();
  });

  test('should show navigation', () => {
    renderWithoutProps();
    expect(document.querySelector('.admin-screen-navigation')).toBeInTheDocument();
  });

  test('should show no admin by default', () => {
    renderWithoutProps();
    expect(screen.getByTestId('no-admin-panel-selected')).toBeInTheDocument();
  });

  function renderAtPath(path: string) {
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/*" element={<AdminScreen />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  test('should select bankruptcy-software nav when path matches', () => {
    renderAtPath('/admin/bankruptcy-software');
    const navLink = screen.getByTestId('bankruptcy-software-nav-link');
    expect(navLink).toHaveClass('usa-current');
  });

  test('should select privileged-identity nav when path matches', () => {
    renderAtPath('/admin/privileged-identity');
    const navLink = screen.getByTestId('privileged-identity-nav-link');
    expect(navLink).toHaveClass('usa-current');
  });

  test('should select case-reload nav when path matches', () => {
    renderAtPath('/admin/case-reload');
    const navLink = screen.getByTestId('case-reload-nav-link');
    expect(navLink).toHaveClass('usa-current');
  });

  test('should render Banks component when navigating to /admin/banks', () => {
    renderAtPath('/admin/banks');
    expect(screen.getByTestId('mocked-banks')).toBeInTheDocument();
  });

  test('should select banks nav when path matches', () => {
    renderAtPath('/admin/banks');
    const navLink = screen.getByTestId('banks-nav-link');
    expect(navLink).toHaveClass('usa-current');
  });

  test('should render BankDetail component when navigating to /admin/banks/:bankId', () => {
    renderAtPath('/admin/banks/bank-1');
    expect(screen.getByTestId('mocked-bank-detail')).toBeInTheDocument();
  });

  test('should not show admin nav when viewing bank detail', () => {
    renderAtPath('/admin/banks/bank-1');
    expect(screen.queryByTestId('banks-nav-link')).not.toBeInTheDocument();
  });

  test('should render BankruptcySoftwareDetail component when navigating to /admin/bankruptcy-software/:softwareId', () => {
    renderAtPath('/admin/bankruptcy-software/software-1');
    expect(screen.getByTestId('mocked-bankruptcy-software-detail')).toBeInTheDocument();
  });

  test('should not show admin nav when viewing bankruptcy software detail', () => {
    renderAtPath('/admin/bankruptcy-software/software-1');
    expect(screen.queryByTestId('bankruptcy-software-nav-link')).not.toBeInTheDocument();
  });

  test('should hide privileged-identity nav link when privileged-identity-management flag is off', () => {
    vi.spyOn(FeatureFlags, 'default').mockReturnValue({
      ...testFeatureFlags,
      [PRIVILEGED_IDENTITY_MANAGEMENT]: false,
    });
    renderWithoutProps();
    expect(screen.queryByTestId('privileged-identity-nav-link')).not.toBeInTheDocument();
  });

  test('should not render BankDetail when trustee-software-bank-display flag is off', () => {
    vi.spyOn(FeatureFlags, 'default').mockReturnValue({
      ...testFeatureFlags,
      [TRUSTEE_SOFTWARE_BANK_DISPLAY]: false,
    });
    renderAtPath('/admin/banks/bank-1');
    expect(screen.queryByTestId('mocked-bank-detail')).not.toBeInTheDocument();
    expect(screen.getByTestId('no-admin-panel-selected')).toBeInTheDocument();
  });

  test('should not render Banks listing when trustee-software-bank-display flag is off', () => {
    vi.spyOn(FeatureFlags, 'default').mockReturnValue({
      ...testFeatureFlags,
      [TRUSTEE_SOFTWARE_BANK_DISPLAY]: false,
    });
    renderAtPath('/admin/banks');
    expect(screen.queryByTestId('mocked-banks')).not.toBeInTheDocument();
    expect(screen.getByTestId('no-admin-panel-selected')).toBeInTheDocument();
  });
});
