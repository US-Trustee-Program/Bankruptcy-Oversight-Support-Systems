import { render, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import * as reactRouter from 'react-router';
import { CamsSession } from '@common/cams/session';
import LocalStorage from '@/lib/utils/local-storage';
import { LOGIN_BASE_PATH, LOGIN_PATHS } from './login-library';
import { Session, SessionProps } from './Session';
import { MockData } from '@common/cams/test-utilities/mock-data';
import Api2 from '@/lib/models/api2';
import { MOCKED_USTP_OFFICE_DATA_MAP } from '@common/cams/offices';
import { MockInstance } from 'vitest';

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
  let useNavigateSpy: MockInstance;

  const navigate = vi.fn();

  function renderWithProps(props: Partial<SessionProps> = {}) {
    const defaultProps: SessionProps = testSession;

    render(
      <BrowserRouter>
        <Session {...defaultProps} {...props}></Session>
      </BrowserRouter>,
    );
  }

  beforeEach(() => {
    useNavigateSpy = vi.spyOn(reactRouter, 'useNavigate').mockImplementation(() => {
      return navigate;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should prefetch office staff for each division the user is assigned to', async () => {
    const mockSession = MockData.getNonPaginatedResponseBody(MockData.getCamsSession());
    vi.spyOn(Api2, 'getMe').mockResolvedValue(mockSession);
    const getOfficeAttorneys = vi.spyOn(Api2, 'getOfficeAttorneys');
    renderWithProps();
    await waitFor(() => {
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
    expect(useNavigateSpy).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(LOGIN_BASE_PATH);
  });

  test('should display Access Denied if getMe returns an error', async () => {
    const errorMessage = 'user does not exist';
    vi.spyOn(LocalStorage, 'setSession');
    vi.spyOn(Api2, 'getMe').mockRejectedValue(new Error(errorMessage));
    renderWithProps();
    await waitFor(() => {
      const alertHeading = document.querySelector('.usa-alert__heading');
      expect(alertHeading).toHaveTextContent('Access Denied');
    });
    const alertText = document.querySelector('.usa-alert__text');
    expect(alertText).toHaveTextContent(errorMessage);
  });
});
