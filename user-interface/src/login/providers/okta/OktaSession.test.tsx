import { MockData } from '@common/cams/test-utilities/mock-data';
import { urlRegex } from '@common/cams/test-utilities/regex';
import * as oktaReactModule from '@okta/okta-react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe } from 'vitest';

import * as accessDeniedModule from '../../AccessDenied';
import * as sessionModule from '../../Session';
import { OktaSession } from './OktaSession';

const accessToken = MockData.getJwt();

describe('OktaSession', () => {
  const authState = {
    isAuthenticated: false,
  };
  const getAccessToken = vi.fn().mockReturnValue(accessToken);
  const handleLoginRedirect = vi.fn().mockResolvedValue({});
  const decode = vi.fn().mockReturnValue({
    payload: {
      exp: Number.MAX_SAFE_INTEGER,
      iss: 'https://issuer/',
    },
  });
  const useOktaAuth = vi.fn().mockImplementation(() => {
    return {
      authState,
      oktaAuth: {
        getAccessToken,
        handleLoginRedirect,
        token: {
          decode,
        },
      },
    };
  });
  vi.spyOn(oktaReactModule, 'useOktaAuth').mockImplementation(useOktaAuth);

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('should pass properties to the Session component', async () => {
    const testId = 'child-div';
    const childText = 'TEST';

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
      const childDiv = screen.queryByTestId(testId);
      expect(childDiv).toBeInTheDocument();
      expect(childDiv).toHaveTextContent(childText);
    });

    expect(sessionSpy).toHaveBeenCalledWith(
      {
        accessToken,
        children: children,
        expires: expect.any(Number),
        issuer: expect.stringMatching(urlRegex),
        provider: 'okta',
      },
      {},
    );
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
      expect(screen.queryByTestId('alert-message')).toHaveTextContent(errorMessage);
    });
  });

  test('should show an error message if the auth state has an error', async () => {
    const errorMessage = 'error message';
    useOktaAuth.mockImplementation(() => {
      return {
        authState: {
          error: new Error(errorMessage),
        },
        oktaAuth: {
          handleLoginRedirect,
        },
      };
    });

    render(
      <BrowserRouter>
        <OktaSession></OktaSession>
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByTestId('alert-message')).toHaveTextContent(errorMessage);
    });
  });

  test('should render AccessDenied if a JWT cannot be retrieved from Okta', async () => {
    const testId = 'child-div';
    const childText = 'TEST';

    getAccessToken.mockReturnValue(undefined);
    handleLoginRedirect.mockImplementation(() => {
      authState.isAuthenticated = true;
      return Promise.resolve();
    });
    useOktaAuth.mockImplementation(() => {
      return {
        authState,
        oktaAuth: {
          getAccessToken,
          handleLoginRedirect,
        },
      };
    });

    const accessDeniedSpy = vi.spyOn(accessDeniedModule, 'AccessDenied');
    const children = <div data-testid={testId}>{childText}</div>;
    render(
      <BrowserRouter>
        <OktaSession>{children}</OktaSession>
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(accessDeniedSpy).toHaveBeenCalled();
    });
  });

  test('should render AccessDenied if a JWT does not have expiration', async () => {
    const testId = 'child-div';
    const childText = 'TEST';
    const decode = vi.fn().mockReturnValue({
      payload: {
        exp: undefined,
        iss: 'https://issuer/',
      },
    });

    getAccessToken.mockReturnValue(accessToken);
    handleLoginRedirect.mockImplementation(() => {
      authState.isAuthenticated = true;
      return Promise.resolve();
    });
    useOktaAuth.mockImplementation(() => {
      return {
        authState,
        oktaAuth: {
          getAccessToken,
          handleLoginRedirect,
          token: {
            decode,
          },
        },
      };
    });

    const accessDeniedSpy = vi.spyOn(accessDeniedModule, 'AccessDenied');
    const children = <div data-testid={testId}>{childText}</div>;
    render(
      <BrowserRouter>
        <OktaSession>{children}</OktaSession>
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(accessDeniedSpy).toHaveBeenCalled();
    });
  });

  test('should render AccessDenied if a JWT does not have issuer', async () => {
    const testId = 'child-div';
    const childText = 'TEST';
    const decode = vi.fn().mockReturnValue({
      payload: {
        exp: Number.MAX_SAFE_INTEGER,
        iss: undefined,
      },
    });

    getAccessToken.mockReturnValue(accessToken);
    handleLoginRedirect.mockImplementation(() => {
      authState.isAuthenticated = true;
      return Promise.resolve();
    });
    useOktaAuth.mockImplementation(() => {
      return {
        authState,
        oktaAuth: {
          getAccessToken,
          handleLoginRedirect,
          token: {
            decode,
          },
        },
      };
    });

    const accessDeniedSpy = vi.spyOn(accessDeniedModule, 'AccessDenied');
    const children = <div data-testid={testId}>{childText}</div>;
    render(
      <BrowserRouter>
        <OktaSession>{children}</OktaSession>
      </BrowserRouter>,
    );
    await waitFor(() => {
      expect(accessDeniedSpy).toHaveBeenCalledWith(
        {
          message: 'Invalid issuer or expiration claims.',
        },
        {},
      );
    });
  });
});
