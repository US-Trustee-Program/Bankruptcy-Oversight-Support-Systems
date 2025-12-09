import { PropsWithChildren } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { describe } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as oktaProviderModule from './providers/okta/OktaProvider';
import * as oktaSessionModule from './providers/okta/OktaSession';
import * as badConfigurationModule from './BadConfiguration';
import * as libraryModule from '@/login/login-library';
import { LoginContinue } from './LoginContinue';
import { Session } from './Session';
import MockData from '@common/cams/test-utilities/mock-data';
import TestingUtilities from '@/lib/testing/testing-utilities';

describe('LoginContinue', () => {
  const getLoginProviderFromEnv = vi.spyOn(libraryModule, 'getLoginProvider');
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
          provider="okta"
          user={{ id: 'mockId', name: 'Mock User' }}
          expires={Number.MAX_SAFE_INTEGER}
          issuer="http://issuer/"
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
    await TestingUtilities.waitForDocumentBody();

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
    await TestingUtilities.waitForDocumentBody();

    expect(screen.getByTestId('alert-message')).toBeInTheDocument();
    expect(getLoginProviderFromEnv).toHaveBeenCalled();
    expect(badConfigurationComponent).toHaveBeenCalled();
  });
});
