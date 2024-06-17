import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Session, SessionProps } from './Session';
import { CamsUser } from './login-library';

describe('Session', () => {
  const testUser: CamsUser = {
    name: 'Test User',
  };
  const testProvider = 'mock';
  const testApiToken = 'mockApiToken';

  function renderWithProps(props: Partial<SessionProps> = {}) {
    const defaultProps: SessionProps = {
      user: testUser,
      provider: testProvider,
      apiToken: testApiToken,
    };

    render(
      <BrowserRouter>
        <Session {...defaultProps} {...props}></Session>
      </BrowserRouter>,
    );
  }

  // TODO: Complete these tests.
  test('should write the session to local storage', () => {
    renderWithProps();
  });

  // TODO: Complete these tests.
  test('should redirect to "/" if path is "/login", "/logout", or "/logout-continue"', () => {
    renderWithProps();
  });
});
