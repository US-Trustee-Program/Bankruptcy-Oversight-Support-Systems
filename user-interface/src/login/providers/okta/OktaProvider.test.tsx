import { describe } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import * as oktaReactModule from '@okta/okta-react';
import { OktaProvider } from './OktaProvider';
import { PropsWithChildren } from 'react';
import * as libraryModule from '@/login/login-library';
import { EnvLoginConfig } from '@common/cams/login';
import * as oktaLibrary from './okta-library';

describe('OktaProvider', () => {
  const mockConfiguration: EnvLoginConfig = {
    issuer: 'https://dev-00000000.okta.com/oauth2/default',
    clientId: '00000000000000000000',
    redirectUri: 'http://localhost:3000/login-continue',
  };

  const getLoginConfigurationFromEnv = vi
    .spyOn(libraryModule, 'getLoginConfiguration')
    .mockReturnValue(mockConfiguration);

  const securityComponent = vi
    .spyOn(oktaReactModule, 'Security')
    .mockImplementation((props: PropsWithChildren) => {
      return <>{props.children}</>;
    });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should configure <Security> and render children.', async () => {
    const testId = 'child-div';
    const childText = 'TEST';
    const children = <div data-testid={testId}>{childText}</div>;

    render(<OktaProvider>{children}</OktaProvider>);

    await waitFor(() => {
      expect(screen.queryByTestId(testId)).toBeInTheDocument();
    });

    expect(getLoginConfigurationFromEnv).toHaveBeenCalled();
    expect(securityComponent).toHaveBeenCalled();
  });

  test('should show an error message there is a configuration error', async () => {
    const error = new Error('MOCK ERROR');
    getLoginConfigurationFromEnv.mockImplementation(() => {
      throw error;
    });

    render(<OktaProvider></OktaProvider>);

    expect(securityComponent).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByTestId('alert-message')).toHaveTextContent(error.message);
    });
  });

  test('should call registerRenewOktaToken when component renders', async () => {
    // Reset mock to return proper config
    getLoginConfigurationFromEnv.mockReturnValue(mockConfiguration);

    const registerRenewOktaTokenSpy = vi
      .spyOn(oktaLibrary, 'registerRenewOktaToken')
      .mockImplementation(() => {});

    const testId = 'child-div';
    const childText = 'TEST';
    const children = <div data-testid={testId}>{childText}</div>;

    render(<OktaProvider>{children}</OktaProvider>);

    await waitFor(() => {
      expect(screen.queryByTestId(testId)).toBeInTheDocument();
    });

    expect(registerRenewOktaTokenSpy).toHaveBeenCalledTimes(1);
    expect(registerRenewOktaTokenSpy).toHaveBeenCalledWith(expect.any(Object));

    registerRenewOktaTokenSpy.mockRestore();
  });
});
