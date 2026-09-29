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
import * as logoutModule from './Logout';
import { Login } from './Login';
import { LoginProvider } from './login-library';
import LocalStorage from '@/lib/utils/local-storage';
import MockData from '@common/cams/test-utilities/mock-data';
import { CamsSession } from '@common/cams/session';
import { JSX } from 'react/jsx-runtime';
import { mockConfiguration } from '@/lib/testing/mock-configuration';
import TestingUtilities from '@/lib/testing/testing-utilities';
import DateHelper from '@common/date-helper';

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
  let logoutComponent: MockInstance<() => JSX.Element>;

  let getSession: MockInstance<() => CamsSession | null>;
  let removeSession: MockInstance<() => void>;

  let getAuthIssuerFromEnv: MockInstance<() => string | undefined>;
  let getLoginProviderFromEnv: MockInstance<() => string>;

  beforeEach(() => {
    vi.restoreAllMocks();
    oktaProviderComponent = vi.spyOn(oktaProviderModule, 'OktaProvider');
    oktaLoginComponent = vi.spyOn(oktaLoginModule, 'OktaLogin');
    mockLoginComponent = vi.spyOn(mockLoginModule, 'MockLogin');

    sessionComponent = vi.spyOn(sessionModule, 'Session');
    badConfigurationComponent = vi.spyOn(badConfigurationModule, 'BadConfiguration');
    logoutComponent = vi.spyOn(logoutModule, 'Logout');

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
    logoutComponent.mockImplementation(() => {
      return <></>;
    });
    sessionComponent.mockImplementation(() => {
      return <></>;
    });
    badConfigurationComponent.mockImplementation(() => {
      return <></>;
    });
    getSession.mockReturnValue(null);
    removeSession.mockImplementation(vi.fn());
    // Acknowledged by default so most tests don't need to think about the privacy warning.
    // The 2 privacy-warning tests below need mockReset() first to clear this queued value
    // before queuing their own false -- mockReturnValueOnce() stacks rather than replaces.
    vi.spyOn(LocalStorage, 'getAck').mockReturnValueOnce(true);
  });

  test('should load provider from environment vars', () => {
    mockConfiguration({ loginProvider: 'okta' });

    render(
      <BrowserRouter>
        <Login>{children}</Login>
      </BrowserRouter>,
    );
    expect(getLoginProviderFromEnv).toHaveBeenCalled();
    expect(oktaProviderComponent).toHaveBeenCalled();
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
    mockConfiguration({
      loginProvider: 'mock',
      serverHostName: 'fake.issuer.com',
      serverPort: '',
      serverProtocol: 'https',
      basePath: '',
    });

    const mockSession = {
      accessToken: MockData.getJwt(),
      provider: 'mock',
      issuer,
      user: {
        id: 'mockId',
        name: 'Mock User',
      },
      expires: Number.MAX_SAFE_INTEGER,
    };
    getSession.mockReturnValue(mockSession);

    render(
      <BrowserRouter>
        <Login>{children}</Login>
      </BrowserRouter>,
    );
    expect(getSession).toHaveBeenCalled();
    expect(removeSession).not.toHaveBeenCalled();
    expect(sessionComponent).toHaveBeenCalledWith(expect.objectContaining(mockSession), undefined);
  });

  test('should check for an existing okta login and skip if a session exists', async () => {
    getAuthIssuerFromEnv.mockReturnValue(issuer);
    getLoginProviderFromEnv.mockReturnValue('okta');
    const mockSession = {
      accessToken: MockData.getJwt(),
      provider: 'okta',
      issuer,
      user: {
        id: 'mockId',
        name: 'Mock User',
      },
      expires: Number.MAX_SAFE_INTEGER,
    };
    getSession.mockReturnValue(mockSession);
    render(
      <BrowserRouter>
        <Login>{children}</Login>
      </BrowserRouter>,
    );
    await TestingUtilities.waitForDocumentBody();

    expect(getSession).toHaveBeenCalled();
    expect(getAuthIssuerFromEnv).toHaveBeenCalled();
    expect(removeSession).not.toHaveBeenCalled();
    expect(sessionComponent).toHaveBeenCalledWith(expect.objectContaining(mockSession), undefined);
  });

  test.each([
    {
      scenario: 'the provider changed',
      envProvider: 'okta',
      envIssuer: issuer,
      sessionProvider: 'mock',
      sessionIssuer: issuer,
    },
    {
      scenario: 'the issuer changed',
      envProvider: 'okta',
      envIssuer: 'http://bogus.issuer.com/oauth/default',
      sessionProvider: 'okta',
      sessionIssuer: 'http://different.issuer.com/oauth/default',
    },
  ])(
    'should clear an existing session if $scenario',
    ({ envProvider, envIssuer, sessionProvider, sessionIssuer }) => {
      getLoginProviderFromEnv.mockReturnValue(envProvider);
      getAuthIssuerFromEnv.mockReturnValue(envIssuer);
      getSession.mockReturnValue({
        accessToken: MockData.getJwt(),
        provider: sessionProvider,
        issuer: sessionIssuer,
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
    },
  );

  test('should render Logout when the existing session has expired', () => {
    getLoginProviderFromEnv.mockReturnValue('mock');
    getSession.mockReturnValue({
      accessToken: MockData.getJwt(),
      provider: 'mock',
      issuer,
      user: {
        id: 'mockId',
        name: 'Mock User',
      },
      expires: DateHelper.nowInSeconds() - 100,
    });
    render(
      <BrowserRouter>
        <Login>{children}</Login>
      </BrowserRouter>,
    );
    expect(logoutComponent).toHaveBeenCalled();
    expect(sessionComponent).not.toHaveBeenCalled();
  });

  test('should show privacy warning if not acknowledged', async () => {
    getLoginProviderFromEnv.mockReturnValue('mock');
    vi.spyOn(LocalStorage, 'getAck').mockReset().mockReturnValueOnce(false);
    render(
      <BrowserRouter>
        <Login>{children}</Login>
      </BrowserRouter>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('button-auo-confirm')).toBeInTheDocument();
    });
  });

  test('should skip the privacy warning when skipAuthorizedUseOnly prop is true', async () => {
    getLoginProviderFromEnv.mockReturnValue('mock');
    vi.spyOn(LocalStorage, 'getAck').mockReset().mockReturnValueOnce(false);
    render(
      <BrowserRouter>
        <Login skipAuthorizedUseOnly={true}>{children}</Login>
      </BrowserRouter>,
    );
    await waitFor(() => {
      expect(screen.getByTestId(testId)).toBeInTheDocument();
    });
    expect(screen.queryByTestId('button-auo-confirm')).not.toBeInTheDocument();
  });

  test('should render OktaProvider for okta provider type', () => {
    getLoginProviderFromEnv.mockReturnValue('okta');
    render(
      <BrowserRouter>
        <Login>{children}</Login>
      </BrowserRouter>,
    );
    expect(getLoginProviderFromEnv).toHaveBeenCalled();
    expect(oktaProviderComponent).toHaveBeenCalled();
    expect(oktaLoginComponent).toHaveBeenCalled();
  });

  test('should render MockProvider for mock provider type', () => {
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
    expect(sessionComponent).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'none',
        expires: Number.MAX_SAFE_INTEGER,
        user: expect.objectContaining({ roles: expect.any(Array) }),
      }),
      undefined,
    );
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
    expect(sessionComponent).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'none' }),
      undefined,
    );
  });

  test('should pass an explicitly supplied user through to Session for the none provider', async () => {
    getLoginProviderFromEnv.mockReturnValue('none');
    const explicitUser = MockData.getCamsUser();
    render(
      <BrowserRouter>
        <Login provider="none" user={explicitUser}></Login>
      </BrowserRouter>,
    );
    await TestingUtilities.waitForDocumentBody();

    expect(sessionComponent).toHaveBeenCalledWith(
      expect.objectContaining({ user: explicitUser }),
      undefined,
    );
  });

  test('should normalize an uppercase provider value before validating it', () => {
    render(
      <BrowserRouter>
        <Login provider={'OKTA' as LoginProvider}>{children}</Login>
      </BrowserRouter>,
    );

    expect(oktaProviderComponent).toHaveBeenCalled();
    expect(badConfigurationComponent).not.toHaveBeenCalled();
  });

  test.each([
    { providerValue: 'bogus', description: 'an unrecognized provider value' },
    { providerValue: '', description: 'an empty/unconfigured provider value' },
  ])('should render BadConfiguration for $description', ({ providerValue }) => {
    getLoginProviderFromEnv.mockReturnValue(providerValue);
    render(
      <BrowserRouter>
        <Login>{children}</Login>
      </BrowserRouter>,
    );

    expect(getLoginProviderFromEnv).toHaveBeenCalled();
    expect(badConfigurationComponent).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining(`Configuration variable value: '${providerValue}'.`),
      }),
      undefined,
    );
  });
});
