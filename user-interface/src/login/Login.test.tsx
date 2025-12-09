import { PropsWithChildren } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { describe, MockInstance } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import * as oktaProviderModule from './providers/okta/OktaProvider';
import * as oktaLoginModule from './providers/okta/OktaLogin';
import * as badConfigurationModule from './BadConfiguration';
import * as libraryModule from '@/login/login-library';
import * as mockLoginModule from './providers/mock/MockLogin';
import * as sessionModule from './Session';
import { Login } from './Login';
import LocalStorage from '@/lib/utils/local-storage';
import MockData from '@common/cams/test-utilities/mock-data';
import { randomUUID } from 'node:crypto';
import { CamsSession } from '@common/cams/session';
import { JSX } from 'react/jsx-runtime';
import { blankConfiguration } from '@/lib/testing/mock-configuration';
import TestingUtilities from '@/lib/testing/testing-utilities';

describe('Login', () => {
  const testId = 'child-div';
  const childText = 'TEST';
  const children = <div data-testid={testId}>{childText}</div>;
  const issuer = 'https://fake.issuer.com/oauth2/default';

  let oktaProviderComponent: MockInstance<
    (props: oktaProviderModule.OktaProviderProps) => JSX.Element
  >;
  let oktaLoginComponent: MockInstance<() => JSX.Element>;
  let mockLoginComponent: MockInstance<(props: mockLoginModule.MockLoginProps) => JSX.Element>;

  let sessionComponent: MockInstance<(props: sessionModule.SessionProps) => JSX.Element>;
  let badConfigurationComponent: MockInstance<
    (props: badConfigurationModule.BadConfigurationProps) => JSX.Element
  >;

  let getSession: MockInstance<() => CamsSession | null>;
  let removeSession: MockInstance<() => void>;

  let getAuthIssuerFromEnv: MockInstance<() => string | undefined>;
  let getLoginProviderFromEnv: MockInstance<() => string>;

  beforeEach(() => {
    oktaProviderComponent = vi.spyOn(oktaProviderModule, 'OktaProvider');
    oktaLoginComponent = vi.spyOn(oktaLoginModule, 'OktaLogin');
    mockLoginComponent = vi.spyOn(mockLoginModule, 'MockLogin');

    sessionComponent = vi.spyOn(sessionModule, 'Session');
    badConfigurationComponent = vi.spyOn(badConfigurationModule, 'BadConfiguration');

    getSession = vi.spyOn(LocalStorage, 'getSession');
    removeSession = vi.spyOn(LocalStorage, 'removeSession');

    getAuthIssuerFromEnv = vi.spyOn(libraryModule, 'getAuthIssuer');
    getLoginProviderFromEnv = vi.spyOn(libraryModule, 'getLoginProvider');

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
    vi.spyOn(LocalStorage, 'getAck').mockReturnValueOnce(true);
    vi.spyOn(libraryModule, 'getLoginConfiguration').mockReturnValue({
      issuer,
      clientId: randomUUID(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should load provider from environment vars', async () => {
    vi.doMock('@/configuration/appConfiguration', async () => {
      return {
        default: () => ({
          ...blankConfiguration,
          loginProvider: 'okta',
          loginProviderConfig: '{"issuer": "${issuer}", "clientId": "000000000000"}',
        }),
      };
    });

    vi.resetModules();
    const { Login } = await import('./Login');
    const libraryModule = await import('@/login/login-library');
    const getLoginProviderFromEnv = vi.spyOn(libraryModule, 'getLoginProvider');

    render(
      <BrowserRouter>
        <Login>{children}</Login>
      </BrowserRouter>,
    );
    expect(getLoginProviderFromEnv).toHaveBeenCalled();
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

  test('should check for an existing mock login and skip if a session exists', async () => {
    vi.doMock('@/configuration/appConfiguration', async () => {
      return {
        default: () => ({
          ...blankConfiguration,
          loginProvider: 'mock',
          loginProviderConfig: '',
          serverHostName: 'fake.issuer.com',
          serverPort: '',
          serverProtocol: 'https',
          basePath: '',
        }),
      };
    });

    vi.resetModules();
    await import('@/login/login-library');
    const localStorageModule = await import('@/lib/utils/local-storage');
    const LocalStorage = localStorageModule.default;
    const { Login } = await import('./Login');
    const sessionModule = await import('./Session');

    const getSession = vi.spyOn(LocalStorage, 'getSession').mockReturnValue({
      accessToken: MockData.getJwt(),
      provider: 'mock',
      issuer,
      user: {
        id: 'mockId',
        name: 'Mock User',
      },
      expires: Number.MAX_SAFE_INTEGER,
    });
    const sessionComponent = vi.spyOn(sessionModule, 'Session');

    render(
      <BrowserRouter>
        <Login>{children}</Login>
      </BrowserRouter>,
    );
    expect(getSession).toHaveBeenCalled();
    expect(removeSession).not.toHaveBeenCalled();
    expect(sessionComponent).toHaveBeenCalled();
  });

  test('should check for an existing okta login and skip if a session exists', async () => {
    getAuthIssuerFromEnv.mockReturnValue(issuer);
    getLoginProviderFromEnv.mockReturnValue('okta');
    getSession.mockReturnValue({
      accessToken: MockData.getJwt(),
      provider: 'okta',
      issuer,
      user: {
        id: 'mockId',
        name: 'Mock User',
      },
      expires: Number.MAX_SAFE_INTEGER,
    });
    render(
      <BrowserRouter>
        <Login>{children}</Login>
      </BrowserRouter>,
    );
    await TestingUtilities.waitForDocumentBody();

    expect(getSession).toHaveBeenCalled();
    expect(getAuthIssuerFromEnv).toHaveBeenCalled();
    expect(removeSession).not.toHaveBeenCalled();
    expect(sessionComponent).toHaveBeenCalled();
  });

  test('should clear an existing session if the provider changed', () => {
    getAuthIssuerFromEnv.mockReturnValue(issuer);
    getLoginProviderFromEnv.mockReturnValue('okta');
    getSession.mockReturnValue({
      accessToken: MockData.getJwt(),
      provider: 'mock',
      issuer,
      user: {
        id: 'mockId',
        name: 'Mock User',
      },
      expires: Number.MAX_SAFE_INTEGER,
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
      accessToken: MockData.getJwt(),
      provider: 'okta',
      issuer: 'http://different.issuer.com/oauth/default',
      user: {
        id: 'mockId',
        name: 'Mock User',
      },
      expires: Number.MAX_SAFE_INTEGER,
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

  test.skip('should show privacy warning if not acknowledged', async () => {
    vi.spyOn(localStorage, 'getAck').mockReturnValueOnce(false);
    render(
      <BrowserRouter>
        <Login>{children}</Login>
      </BrowserRouter>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('button-auo-confirm')).toBeInTheDocument();
    });
  });

  test('should render OktaProvider for okta provider type', async () => {
    getLoginProviderFromEnv.mockReturnValue('okta');
    vi.spyOn(LocalStorage, 'getAck').mockReturnValueOnce(true);
    render(
      <BrowserRouter>
        <Login>{children}</Login>
      </BrowserRouter>,
    );
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
    await TestingUtilities.waitForDocumentBody();

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
    await TestingUtilities.waitForDocumentBody();

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
