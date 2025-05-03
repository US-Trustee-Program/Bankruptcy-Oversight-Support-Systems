import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

import AdminScreenNavigation, { AdminNavState, setCurrentAdminNav } from './AdminScreenNavigation';

describe('Admin screen navigation tests', () => {
  beforeEach(async () => {
    vi.stubEnv('CAMS_PA11Y', 'true');
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
});
