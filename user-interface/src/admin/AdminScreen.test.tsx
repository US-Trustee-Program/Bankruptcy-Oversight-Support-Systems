import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AdminScreen } from './AdminScreen';
import LocalStorage from '@/lib/utils/local-storage';
import MockData from '@common/cams/test-utilities/mock-data';
import { CamsRole } from '@common/cams/roles';

vi.mock('./privileged-identity/PrivilegedIdentity', () => {
  return {
    PrivilegedIdentity: () => {
      return <div data-testid="privileged-identity-component"></div>;
    },
  };
});

describe('Admin screen tests', () => {
  beforeEach(async () => {
    vi.stubEnv('CAMS_PA11Y', 'true');
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

  test('should show privileged identity admin', async () => {
    renderWithoutProps();
    expect(screen.getByTestId('privileged-identity-component')).toBeInTheDocument();
  });
});
