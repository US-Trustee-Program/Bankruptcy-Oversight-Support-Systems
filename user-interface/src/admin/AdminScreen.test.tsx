import { render, screen } from '@testing-library/react';
import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom';
import { AdminScreen } from './AdminScreen';
import LocalStorage from '@/lib/utils/local-storage';
import MockData from '@common/cams/test-utilities/mock-data';
import { CamsRole } from '@common/cams/roles';
import { testFeatureFlags } from '@common/feature-flags';
import * as FeatureFlags from '@/lib/hooks/UseFeatureFlags';
import { CAMS_ROLE_ASSIGNMENTS, PRIVILEGED_IDENTITY_MANAGEMENT } from '@/lib/hooks/UseFeatureFlags';

vi.mock('@/lib/hooks/UseFeatureFlags', () => ({
  default: () => testFeatureFlags,
  isFlagEnabled: (flags: Record<string, boolean>, flag: string) => flags[flag] === true,
  PRIVILEGED_IDENTITY_MANAGEMENT: 'privileged-identity-management',
  CAMS_ROLE_ASSIGNMENTS: 'cams-role-assignments',
}));

vi.mock('./permissions/Permissions', () => ({
  Permissions: () => <div data-testid="mocked-permissions" />,
}));

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

vi.mock('./notification-routing/NotificationRouting', () => ({
  NotificationRouting: () => <div data-testid="mocked-notification-routing" />,
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

  const adminRoutes = [
    ['bankruptcy-software', '/admin/bankruptcy-software', 'mocked-bankruptcy-software'],
    ['privileged-identity', '/admin/privileged-identity', 'mocked-privileged-identity'],
    ['permissions', '/admin/permissions/cams-users', 'mocked-permissions'],
    ['case-reload', '/admin/case-reload', 'mocked-case-reload'],
    ['banks', '/admin/banks', 'mocked-banks'],
    ['notification-routing', '/admin/notification-routing', 'mocked-notification-routing'],
  ];

  test.each(adminRoutes)('should select %s nav when path matches', (name, path) => {
    renderAtPath(path);
    const navLink = screen.getByTestId(`${name}-nav-link`);
    expect(navLink).toHaveClass('usa-current');
  });

  // Nav highlighting comes from the path alone, so this checks each route renders its panel.
  test.each(adminRoutes)('should render the %s panel when path matches', (_name, path, panel) => {
    renderAtPath(path);
    expect(screen.getByTestId(panel)).toBeInTheDocument();
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

  test('should not render PrivilegedIdentity route when privileged-identity-management flag is off', () => {
    vi.spyOn(FeatureFlags, 'default').mockReturnValue({
      ...testFeatureFlags,
      [PRIVILEGED_IDENTITY_MANAGEMENT]: false,
    });
    renderAtPath('/admin/privileged-identity');
    expect(screen.queryByTestId('mocked-privileged-identity')).not.toBeInTheDocument();
    expect(screen.getByTestId('no-admin-panel-selected')).toBeInTheDocument();
  });

  test('should not render Permissions when the cams-role-assignments flag is off', () => {
    vi.spyOn(FeatureFlags, 'default').mockReturnValue({
      ...testFeatureFlags,
      [CAMS_ROLE_ASSIGNMENTS]: false,
    });
    renderAtPath('/admin/permissions/cams-users');
    expect(screen.queryByTestId('mocked-permissions')).not.toBeInTheDocument();
    expect(screen.getByTestId('no-admin-panel-selected')).toBeInTheDocument();
  });
});
