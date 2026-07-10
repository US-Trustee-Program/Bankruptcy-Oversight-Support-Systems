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

  let getLoginConfigurationFromEnv: ReturnType<typeof vi.spyOn>;
  let securityComponent: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getLoginConfigurationFromEnv = vi
      .spyOn(libraryModule, 'getLoginConfiguration')
      .mockReturnValue(mockConfiguration);

    securityComponent = vi
      .spyOn(oktaReactModule, 'Security')
      .mockImplementation((props: PropsWithChildren) => {
        return <>{props.children}</>;
      });
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

  test('should call unregisterRenewOktaToken when component unmounts', async () => {
    const registerRenewOktaTokenSpy = vi
      .spyOn(oktaLibrary, 'registerRenewOktaToken')
      .mockImplementation(() => {});
    const unregisterRenewOktaTokenSpy = vi
      .spyOn(oktaLibrary, 'unregisterRenewOktaToken')
      .mockImplementation(() => {});

    const testId = 'child-div';
    const childText = 'TEST';
    const children = <div data-testid={testId}>{childText}</div>;

    const { unmount } = render(<OktaProvider>{children}</OktaProvider>);

    await waitFor(() => {
      expect(screen.queryByTestId(testId)).toBeInTheDocument();
    });

    expect(registerRenewOktaTokenSpy).toHaveBeenCalledTimes(1);
    expect(unregisterRenewOktaTokenSpy).not.toHaveBeenCalled();

    unmount();

    expect(unregisterRenewOktaTokenSpy).toHaveBeenCalledTimes(1);

    registerRenewOktaTokenSpy.mockRestore();
    unregisterRenewOktaTokenSpy.mockRestore();
  });

  test('should render children when config includes a scopes array of strings', async () => {
    getLoginConfigurationFromEnv.mockReturnValue({
      ...mockConfiguration,
      scopes: ['custom-scope'],
    } as EnvLoginConfig);

    const testId = 'child-div';
    const children = <div data-testid={testId}>TEST</div>;

    render(<OktaProvider>{children}</OktaProvider>);

    await waitFor(() => {
      expect(screen.queryByTestId(testId)).toBeInTheDocument();
    });
  });

  test('should render children and filter out non-string values from configured scopes', async () => {
    getLoginConfigurationFromEnv.mockReturnValue({
      ...mockConfiguration,
      scopes: ['custom-scope', 42, null],
    } as unknown as EnvLoginConfig);

    const testId = 'child-div';
    const children = <div data-testid={testId}>TEST</div>;

    render(<OktaProvider>{children}</OktaProvider>);

    await waitFor(() => {
      expect(screen.queryByTestId(testId)).toBeInTheDocument();
    });
  });
});
