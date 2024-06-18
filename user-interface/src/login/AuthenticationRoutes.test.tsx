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
  const loginComponent = vi.spyOn(loginModule, 'Login').mockImplementation(noOp);
  const loginContinueComponent = vi
    .spyOn(loginContinueModule, 'LoginContinue')
    .mockImplementation(noOp);
  const logoutComponent = vi.spyOn(logoutModule, 'Logout').mockImplementation(noOp);
  const sessionEndComponent = vi.spyOn(sessionEndModule, 'SessionEnd').mockImplementation(noOp);

  beforeEach(() => {
    vi.clearAllMocks();
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
