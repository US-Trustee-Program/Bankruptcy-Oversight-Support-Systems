import { render, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import * as reactRouter from 'react-router';
import { CamsSession } from '@common/cams/session';
import LocalStorage from '@/lib/utils/local-storage';
import { LOGIN_PATHS, LOGIN_SUCCESS_PATH } from './login-library';
import { Session, SessionProps } from './Session';
import { MockData } from '@common/cams/test-utilities/mock-data';
import Api2 from '@/lib/models/api2';
import { MOCKED_USTP_OFFICE_DATA_MAP } from '@common/cams/offices';

describe('Session', () => {
  const testSession: CamsSession = {
    user: {
      id: 'mockId',
      name: 'Mock User',
      offices: [MOCKED_USTP_OFFICE_DATA_MAP.get('USTP_CAMS_Region_2_Office_Manhattan')!],
    },
    provider: 'mock',
    accessToken: MockData.getJwt(),
    expires: Number.MAX_SAFE_INTEGER,
    issuer: 'http://issuer/',
  };

  const navigate = vi.fn();
  const useNavigate = vi.spyOn(reactRouter, 'useNavigate').mockImplementation(() => {
    return navigate;
  });

  function renderWithProps(props: Partial<SessionProps> = {}) {
    const defaultProps: SessionProps = testSession;

    render(
      <BrowserRouter>
        <Session {...defaultProps} {...props}></Session>
      </BrowserRouter>,
    );
  }

  test('should prefetch office staff for each division the user is assigned to', () => {
    const getOfficeAttorneys = vi.spyOn(Api2, 'getOfficeAttorneys');
    renderWithProps();
    waitFor(() => {
      expect(getOfficeAttorneys).toHaveBeenCalledTimes(testSession.user.offices!.length);
    });
  });

  test('should write the session to local storage', () => {
    const setSession = vi.spyOn(LocalStorage, 'setSession');
    renderWithProps();
    expect(setSession).toHaveBeenCalledWith(testSession);
  });

  test.each(LOGIN_PATHS)('should redirect to "/" if path is "%s"', (path: string) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <Session {...testSession}></Session>
      </MemoryRouter>,
    );
    expect(useNavigate).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(LOGIN_SUCCESS_PATH);
  });
});
