import { PropsWithChildren } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { describe } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import * as oktaProviderModule from './providers/okta/OktaProvider';
import * as oktaSessionModule from './providers/okta/OktaSession';
import * as badConfigurationModule from './BadConfiguration';
import * as libraryModule from '@/login/login-library';
import { LoginContinue } from './LoginContinue';
import { Session } from './Session';

describe('LoginContinue', () => {
  const getLoginProviderFromEnv = vi.spyOn(libraryModule, 'getLoginProviderFromEnv');
  const oktaProviderComponent = vi
    .spyOn(oktaProviderModule, 'OktaProvider')
    .mockImplementation((props: PropsWithChildren) => {
      return <>{props.children}</>;
    });
  const oktaSessionComponent = vi
    .spyOn(oktaSessionModule, 'OktaSession')
    .mockImplementation((props: PropsWithChildren) => {
      return (
        <Session apiToken={''} provider="okta" user={{ name: 'Mock User' }}>
          {props.children}
        </Session>
      );
    });
  const badConfigurationComponent = vi.spyOn(badConfigurationModule, 'BadConfiguration');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should render OktaProvider for okta provider type', async () => {
    getLoginProviderFromEnv.mockReturnValueOnce('okta');
    render(
      <BrowserRouter>
        <LoginContinue></LoginContinue>
      </BrowserRouter>,
    );

    expect(getLoginProviderFromEnv).toHaveBeenCalled();
    expect(oktaProviderComponent).toHaveBeenCalled();
    expect(oktaSessionComponent).toHaveBeenCalled();
  });

  test('should render BadConfiguration for other provider type', async () => {
    getLoginProviderFromEnv.mockReturnValueOnce('bogus');
    render(
      <BrowserRouter>
        <LoginContinue></LoginContinue>
      </BrowserRouter>,
    );
    await waitFor(() => {
      expect(screen.queryByTestId('alert-message')).toBeInTheDocument();
    });

    expect(getLoginProviderFromEnv).toHaveBeenCalled();
    expect(badConfigurationComponent).toHaveBeenCalled();
  });
});
