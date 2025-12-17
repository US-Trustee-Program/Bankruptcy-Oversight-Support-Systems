import { BrowserRouter } from 'react-router-dom';
import { describe } from 'vitest';
import * as oktaReactModule from '@okta/okta-react';
import { OktaSession } from './OktaSession';
import { render, screen, waitFor } from '@testing-library/react';
import * as sessionModule from '../../Session';
import * as accessDeniedModule from '../../AccessDenied';
import MockData from '@common/cams/test-utilities/mock-data';
import { urlRegex } from '@common/cams/test-utilities/regex';

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
      oktaAuth: {
        handleLoginRedirect,
        getAccessToken,
        token: {
          decode,
        },
      },
      authState,
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
        children: children,
        provider: 'okta',
        issuer: expect.stringMatching(urlRegex),
        accessToken,
        expires: expect.any(Number),
      },
      undefined,
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
        oktaAuth: {
          handleLoginRedirect,
        },
        authState: {
          error: new Error(errorMessage),
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
        oktaAuth: {
          handleLoginRedirect,
          getAccessToken,
        },
        authState,
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
        oktaAuth: {
          handleLoginRedirect,
          getAccessToken,
          token: {
            decode,
          },
        },
        authState,
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
        oktaAuth: {
          handleLoginRedirect,
          getAccessToken,
          token: {
            decode,
          },
        },
        authState,
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
        undefined,
      );
    });
  });
});
