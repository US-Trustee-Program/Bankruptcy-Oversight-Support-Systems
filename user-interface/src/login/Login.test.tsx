import { PropsWithChildren } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { describe } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as oktaProviderModule from './providers/okta/OktaProvider';
import * as oktaLoginModule from './providers/okta/OktaLogin';
import * as badConfigurationModule from './BadConfiguration';
import * as libraryModule from '@/login/login-library';
import * as mockLoginModule from './providers/mock/MockLogin';
import * as sessionModule from './Session';
import { Login } from './Login';
import localStorage, { LocalStorage } from '@/lib/utils/local-storage';
import { MockData } from '@common/cams/test-utilities/mock-data';
import { randomUUID } from 'node:crypto';

describe('Login', () => {
  const testId = 'child-div';
  const childText = 'TEST';
  const children = <div data-testid={testId}>{childText}</div>;
  const issuer = 'https://fake.issuer.com/oauth2/default';

  const oktaProviderComponent = vi.spyOn(oktaProviderModule, 'OktaProvider');
  const oktaLoginComponent = vi.spyOn(oktaLoginModule, 'OktaLogin');
  const mockLoginComponent = vi.spyOn(mockLoginModule, 'MockLogin');

  const sessionComponent = vi.spyOn(sessionModule, 'Session');
  const badConfigurationComponent = vi.spyOn(badConfigurationModule, 'BadConfiguration');

  const getSession = vi.spyOn(LocalStorage, 'getSession');
  const removeSession = vi.spyOn(LocalStorage, 'removeSession');

  const getAuthIssuerFromEnv = vi.spyOn(libraryModule, 'getAuthIssuerFromEnv');
  const getLoginProviderFromEnv = vi.spyOn(libraryModule, 'getLoginProviderFromEnv');

  beforeEach(() => {
    oktaProviderComponent.mockImplementation((props: PropsWithChildren) => {
      return <>{props.children}</>;
    });
    oktaLoginComponent.mockImplementation(() => {
      return <></>;
    });
    mockLoginComponent.mockImplementation((props: PropsWithChildren) => {
      return <> {props.children}</>;
    });
    getSession.mockReturnValue(null);
    removeSession.mockImplementation(vi.fn());
    vi.spyOn(localStorage, 'getAck').mockReturnValueOnce(true);
    vi.spyOn(libraryModule, 'getLoginConfigurationFromEnv').mockReturnValue({
      issuer,
      clientId: randomUUID(),
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test('should load provider and issuer from environment vars', () => {
    vi.stubEnv('CAMS_LOGIN_PROVIDER', 'okta');
    vi.stubEnv(
      'CAMS_LOGIN_PROVIDER_CONFIG',
      '{"issuer": "https://fake.okta.com/oauth2/default", "clientId": "000000000000"}',
    );
    render(
      <BrowserRouter>
        <Login>{children}</Login>
      </BrowserRouter>,
    );
    expect(getLoginProviderFromEnv).toHaveBeenCalled();
    expect(getAuthIssuerFromEnv).toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  test('should check for an existing login and continue if a session does not exist', () => {
    getLoginProviderFromEnv.mockReturnValue('mock');
    render(
      <BrowserRouter>
        <Login>{children}</Login>
      </BrowserRouter>,
    );
    expect(getSession).toHaveBeenCalled();
    expect(removeSession).not.toHaveBeenCalled();
    expect(sessionComponent).not.toHaveBeenCalled();
  });

  test('should check for an existing mock login and skip if a session exists', () => {
    getAuthIssuerFromEnv.mockReturnValue(undefined);
    getLoginProviderFromEnv.mockReturnValue('mock');
    getSession.mockReturnValueOnce({
      apiToken: MockData.getJwt(),
      provider: 'mock',
      user: {
        name: 'Mock User',
      },
      validatedClaims: {},
    });
    render(
      <BrowserRouter>
        <Login>{children}</Login>
      </BrowserRouter>,
    );
    expect(getSession).toHaveBeenCalled();
    expect(removeSession).not.toHaveBeenCalled();
    expect(sessionComponent).toHaveBeenCalled();
  });

  test('should check for an existing okta login and skip if a session exists', () => {
    getAuthIssuerFromEnv.mockReturnValue(issuer);
    getLoginProviderFromEnv.mockReturnValue('okta');
    getSession.mockReturnValue({
      apiToken: MockData.getJwt(),
      provider: 'okta',
      user: {
        name: 'Mock User',
      },
      validatedClaims: { iss: issuer },
    });
    render(
      <BrowserRouter>
        <Login>{children}</Login>
      </BrowserRouter>,
    );
    expect(getSession).toHaveBeenCalled();
    expect(removeSession).not.toHaveBeenCalled();
    expect(sessionComponent).toHaveBeenCalled();
  });

  test('should clear an existing session if the provider changed', () => {
    getLoginProviderFromEnv.mockReturnValue('okta');
    getSession.mockReturnValue({
      apiToken: MockData.getJwt(),
      provider: 'mock',
      user: {
        name: 'Mock User',
      },
      validatedClaims: {},
    });
    render(
      <BrowserRouter>
        <Login>{children}</Login>
      </BrowserRouter>,
    );
    expect(getSession).toHaveBeenCalled();
    expect(removeSession).toHaveBeenCalled();
    expect(sessionComponent).not.toHaveBeenCalled();
  });

  test('should clear an existing session if the issuer changed', () => {
    getLoginProviderFromEnv.mockReturnValue('okta');
    getAuthIssuerFromEnv.mockReturnValue('http://bogus.issuer.com/oauth/default');

    getSession.mockReturnValue({
      apiToken: MockData.getJwt(),
      provider: 'okta',
      user: {
        name: 'Mock User',
      },
      validatedClaims: { iss: issuer },
    });
    render(
      <BrowserRouter>
        <Login>{children}</Login>
      </BrowserRouter>,
    );
    expect(getSession).toHaveBeenCalled();
    expect(removeSession).toHaveBeenCalled();
    expect(sessionComponent).not.toHaveBeenCalled();
  });

  test('should render OktaProvider for okta provider type', async () => {
    getLoginProviderFromEnv.mockReturnValue('okta');
    vi.spyOn(localStorage, 'getAck').mockReturnValueOnce(false);
    render(
      <BrowserRouter>
        <Login>{children}</Login>
      </BrowserRouter>,
    );

    fireEvent.click(screen.getByTestId('button-auo-confirm'));
    expect(getLoginProviderFromEnv).toHaveBeenCalled();
    expect(oktaProviderComponent).toHaveBeenCalled();
    expect(oktaLoginComponent).toHaveBeenCalled();
  });

  test('should render MockProvider for mock provider type', async () => {
    getLoginProviderFromEnv.mockReturnValue('mock');
    render(
      <BrowserRouter>
        <Login>{children}</Login>
      </BrowserRouter>,
    );
    expect(getLoginProviderFromEnv).toHaveBeenCalled();
    expect(mockLoginComponent).toHaveBeenCalled();
  });

  test('should render Session for none provider type', async () => {
    getLoginProviderFromEnv.mockReturnValue('none');
    render(
      <BrowserRouter>
        <Login></Login>
      </BrowserRouter>,
    );
    expect(getLoginProviderFromEnv).toHaveBeenCalled();
    expect(sessionComponent).toHaveBeenCalled();
  });

  test('should render Session for none provider type if passed to Login component directly', async () => {
    getLoginProviderFromEnv.mockReturnValue('none');
    render(
      <BrowserRouter>
        <Login provider="none"></Login>
      </BrowserRouter>,
    );
    expect(getLoginProviderFromEnv).not.toHaveBeenCalled();
    expect(sessionComponent).toHaveBeenCalled();
  });

  test('should render BadConfiguration for other provider types', async () => {
    getLoginProviderFromEnv.mockReturnValue('bogus');
    render(
      <BrowserRouter>
        <Login>{children}</Login>
      </BrowserRouter>,
    );

    expect(getLoginProviderFromEnv).toHaveBeenCalled();
    expect(badConfigurationComponent).toHaveBeenCalled();
  });

  test('should render BadConfiguration if provider is not configured', async () => {
    getLoginProviderFromEnv.mockReturnValue('');
    render(
      <BrowserRouter>
        <Login>{children}</Login>
      </BrowserRouter>,
    );

    expect(getLoginProviderFromEnv).toHaveBeenCalled();
    expect(badConfigurationComponent).toHaveBeenCalled();
  });
});
