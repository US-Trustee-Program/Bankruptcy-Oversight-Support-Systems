import * as libraryModule from '@/login/login-library';
import { EnvLoginConfig } from '@common/cams/login';
import * as oktaReactModule from '@okta/okta-react';
import { render, screen, waitFor } from '@testing-library/react';
import { PropsWithChildren } from 'react';
import { describe } from 'vitest';

import { OktaProvider } from './OktaProvider';

describe('OktaProvider', () => {
  const mockConfiguration: EnvLoginConfig = {
    clientId: '00000000000000000000',
    issuer: 'https://dev-00000000.okta.com/oauth2/default',
    redirectUri: 'http://localhost:3000/login-continue',
  };

  const getLoginConfigurationFromEnv = vi
    .spyOn(libraryModule, 'getLoginConfigurationFromEnv')
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
});
