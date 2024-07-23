import { render } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import * as reactRouter from 'react-router';
import { CamsSession } from '@common/cams/session';
import LocalStorage from '@/lib/utils/local-storage';
import { LOGIN_PATHS, LOGIN_SUCCESS_PATH } from './login-library';
import { Session, SessionProps } from './Session';
import { MockData } from '@common/cams/test-utilities/mock-data';

describe('Session', () => {
  const testSession: CamsSession = {
    user: {
      name: 'Mock User',
    },
    provider: 'mock',
    accessToken: MockData.getJwt(),
    expires: Number.MAX_SAFE_INTEGER,
    issuer: 'http://issuer',
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
