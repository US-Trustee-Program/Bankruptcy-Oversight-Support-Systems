import { describe } from 'vitest';
import { OktaSession } from './OktaSession';
import { render, screen, waitFor } from '@testing-library/react';
import { CamsUser } from '@/login/login-helpers';
import { BrowserRouter } from 'react-router-dom';
import * as sessionModule from '../../Session';
import * as oktaReactModule from '@okta/okta-react';

describe('OktaSession', () => {
  const authState = {
    isAuthenticated: false,
  };
  const getUser = vi.fn();
  const handleLoginRedirect = vi.fn();
  const useOktaAuth = vi.fn().mockImplementation(() => {
    return {
      oktaAuth: {
        handleLoginRedirect,
        getUser,
      },
      authState,
    };
  });
  vi.spyOn(oktaReactModule, 'useOktaAuth').mockImplementation(useOktaAuth);

  test('should pass a mapped CamsUser, provider, and children to the Session component', async () => {
    const oktaUser = {
      name: 'First Last',
    };
    const user: CamsUser = { name: oktaUser.name };
    const testId = 'child-div';
    const childText = 'TEST';

    getUser.mockResolvedValue(oktaUser);
    handleLoginRedirect.mockImplementation(() => {
      authState.isAuthenticated = true;
      return Promise.resolve();
    });

    const sessionSpy = vi.spyOn(sessionModule, 'Session');
    const children = <div data-testid={testId}>{childText}</div>;
    render(
      <BrowserRouter>
        <OktaSession>{children}</OktaSession>
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByTestId('interstital-continue')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.queryByTestId('interstital-getuser')).toBeInTheDocument();
    });

    await waitFor(() => {
      const childDiv = screen.queryByTestId(testId);
      expect(childDiv).toBeInTheDocument();
      expect(childDiv).toHaveTextContent(childText);
    });

    expect(sessionSpy).toHaveBeenCalledWith({ children: children, provider: 'okta', user }, {});
  });

  test('should show an error message if the user cannot be retrieved from Okta', async () => {
    const errorMessage = 'error message';
    getUser.mockRejectedValue(new Error(errorMessage));
    handleLoginRedirect.mockImplementation(() => {
      authState.isAuthenticated = true;
      return Promise.resolve();
    });

    render(
      <BrowserRouter>
        <OktaSession></OktaSession>
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByTestId('interstital-continue')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.queryByTestId('interstital-getuser')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.queryByTestId('alert-message')).toHaveTextContent(errorMessage);
    });
  });

  test('should show an error message if the redirect from Okta cannot be handled', async () => {
    const errorMessage = 'error message';
    handleLoginRedirect.mockRejectedValue(new Error(errorMessage));

    render(
      <BrowserRouter>
        <OktaSession></OktaSession>
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByTestId('interstital-continue')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.queryByTestId('alert-message')).toHaveTextContent(errorMessage);
    });
  });
});
