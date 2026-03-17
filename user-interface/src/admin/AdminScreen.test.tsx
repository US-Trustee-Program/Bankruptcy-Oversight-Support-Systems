import { render, screen } from '@testing-library/react';
import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom';
import { AdminScreen } from './AdminScreen';
import LocalStorage from '@/lib/utils/local-storage';
import MockData from '@common/cams/test-utilities/mock-data';
import { CamsRole } from '@common/cams/roles';

vi.mock('./privileged-identity/PrivilegedIdentity', () => ({
  PrivilegedIdentity: () => <div data-testid="mocked-privileged-identity" />,
}));
vi.mock('./bankruptcy-software/BankruptcySoftware', () => ({
  BankruptcySoftware: () => <div data-testid="mocked-bankruptcy-software" />,
}));
vi.mock('./case-reload/CaseReload', () => ({
  CaseReload: () => <div data-testid="mocked-case-reload" />,
}));

describe('Admin screen tests', () => {
  beforeEach(async () => {
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
    const session = MockData.getCamsSession();
    session.user.roles = [CamsRole.SuperUser];
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  function renderWithoutProps() {
    render(
      <BrowserRouter>
        <AdminScreen />
      </BrowserRouter>,
    );
  }

  test('should show prohibited alert for non-SuperUsers', async () => {
    const session = MockData.getCamsSession();
    session.user.roles = [CamsRole.TrialAttorney];
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);

    renderWithoutProps();
    expect(screen.getByTestId('alert-container-forbidden-alert')).toBeInTheDocument();
  });

  test('should show navigation', async () => {
    renderWithoutProps();
    expect(document.querySelector('.admin-screen-navigation')).toBeInTheDocument();
  });

  test('should show no admin by default', async () => {
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
    expect(screen.getByTestId('admin-screen')).toBeInTheDocument();
  });

  test('should select case-reload nav when path matches', () => {
    renderAtPath('/admin/case-reload');
    const navLink = screen.getByTestId('case-reload-nav-link');
    expect(navLink).toHaveClass('usa-current');
  });
});
