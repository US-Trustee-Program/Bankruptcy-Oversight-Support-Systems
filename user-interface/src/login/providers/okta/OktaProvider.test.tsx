import { describe } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import * as oktaReactModule from '@okta/okta-react';
import { OktaProvider } from './OktaProvider';
import { PropsWithChildren } from 'react';
import * as libraryModule from '@/login/login-library';

describe('OktaProvider', () => {
  const getLoginConfigurationFromEnv = vi.spyOn(libraryModule, 'getLoginConfigurationFromEnv');
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
