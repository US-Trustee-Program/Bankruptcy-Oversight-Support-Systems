import { describe } from 'vitest';
import { render } from '@testing-library/react';
import * as loginModule from './Login';
import * as loginContinueModule from './LoginContinue';
import * as logoutModule from './Logout';
import * as sessionEndModule from './SessionEnd';
import { MemoryRouter } from 'react-router-dom';
import { AuthenticationRoutes } from './AuthenticationRoutes';

describe('AuthenticationRoutes', () => {
  const noOp = () => {
    return <></>;
  };
  let loginComponent: ReturnType<typeof vi.spyOn>;
  let loginContinueComponent: ReturnType<typeof vi.spyOn>;
  let logoutComponent: ReturnType<typeof vi.spyOn>;
  let sessionEndComponent: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    loginComponent = vi.spyOn(loginModule, 'Login').mockImplementation(noOp);
    loginContinueComponent = vi
      .spyOn(loginContinueModule, 'LoginContinue')
      .mockImplementation(noOp);
    logoutComponent = vi.spyOn(logoutModule, 'Logout').mockImplementation(noOp);
    sessionEndComponent = vi.spyOn(sessionEndModule, 'SessionEnd').mockImplementation(noOp);
  });

  function renderWithPath(path: string) {
    render(
      <MemoryRouter initialEntries={[path]}>
        <AuthenticationRoutes></AuthenticationRoutes>
      </MemoryRouter>,
    );
  }

  test('should render /logout route', async () => {
    renderWithPath('/logout');
    expect(logoutComponent).toHaveBeenCalled();
  });

  test('should render /login-continue route', async () => {
    renderWithPath('/login-continue');
    expect(loginContinueComponent).toHaveBeenCalled();
  });

  test('should render /session-end route', async () => {
    renderWithPath('/session-end');
    expect(sessionEndComponent).toHaveBeenCalled();
  });

  test('should render /login default route', async () => {
    renderWithPath('/');
    expect(loginComponent).toHaveBeenCalled();
  });
});
