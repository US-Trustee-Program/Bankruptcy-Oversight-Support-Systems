import * as libraryModule from '@/login/login-library';
import { MockData } from '@common/cams/test-utilities/mock-data';
import { render, screen, waitFor } from '@testing-library/react';
import { PropsWithChildren } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { describe } from 'vitest';

import * as badConfigurationModule from './BadConfiguration';
import { LoginContinue } from './LoginContinue';
import * as oktaProviderModule from './providers/okta/OktaProvider';
import * as oktaSessionModule from './providers/okta/OktaSession';
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
        <Session
          accessToken={MockData.getJwt()}
          expires={Number.MAX_SAFE_INTEGER}
          issuer="http://issuer/"
          provider="okta"
          user={{ id: 'mockId', name: 'Mock User' }}
        >
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
      expect(screen.getByTestId('alert-message')).toBeInTheDocument();
    });

    expect(getLoginProviderFromEnv).toHaveBeenCalled();
    expect(badConfigurationComponent).toHaveBeenCalled();
  });
});
