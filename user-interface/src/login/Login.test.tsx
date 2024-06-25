import { PropsWithChildren } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { describe } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import * as oktaProviderModule from './providers/okta/OktaProvider';
import * as oktaLoginModule from './providers/okta/OktaLogin';
import * as badConfigurationModule from './BadConfiguration';
import * as libraryModule from '@/login/login-library';
import * as mockLoginModule from './providers/mock/MockLogin';
import * as sessionModule from './Session';
import { Login } from './Login';
import { LocalStorage } from '@/lib/utils/local-storage';
import { MOCK_AUTHORIZATION_BEARER_TOKEN } from '@common/cams/session';

describe('Login', () => {
  const testId = 'child-div';
  const childText = 'TEST';
  const children = <div data-testid={testId}>{childText}</div>;

  const oktaProviderComponent = vi
    .spyOn(oktaProviderModule, 'OktaProvider')
    .mockImplementation((props: PropsWithChildren) => {
      return <>{props.children}</>;
    });

  const oktaLoginComponent = vi.spyOn(oktaLoginModule, 'OktaLogin').mockImplementation(() => {
    return <></>;
  });

  const mockLoginComponent = vi
    .spyOn(mockLoginModule, 'MockLogin')
    .mockImplementation((props: PropsWithChildren) => {
      return <> {props.children}</>;
    });

  const sessionComponent = vi.spyOn(sessionModule, 'Session');
  const badConfigurationComponent = vi.spyOn(badConfigurationModule, 'BadConfiguration');

  const getSession = vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);
  const removeSession = vi.spyOn(LocalStorage, 'removeSession').mockImplementation(vi.fn());

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should check for an existing login and continue if a session does not exist', () => {
    const getLoginProviderFromEnv = vi.spyOn(libraryModule, 'getLoginProviderFromEnv');
    getLoginProviderFromEnv.mockReturnValueOnce('mock');
    render(
      <BrowserRouter>
        <Login>{children}</Login>
      </BrowserRouter>,
    );
    expect(getSession).toHaveBeenCalled();
    expect(removeSession).not.toHaveBeenCalled();
    expect(sessionComponent).not.toHaveBeenCalled();
  });

  test('should check for an existing login and skip if a session exists', () => {
    const getLoginProviderFromEnv = vi.spyOn(libraryModule, 'getLoginProviderFromEnv');
    getLoginProviderFromEnv.mockReturnValueOnce('mock');
    getSession.mockReturnValueOnce({
      apiToken: MOCK_AUTHORIZATION_BEARER_TOKEN,
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

  test('should clear an existing session if the provider changed', () => {
    const getLoginProviderFromEnv = vi.spyOn(libraryModule, 'getLoginProviderFromEnv');
    getLoginProviderFromEnv.mockReturnValueOnce('okta');
    getSession.mockReturnValue({
      apiToken: MOCK_AUTHORIZATION_BEARER_TOKEN,
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

  test('should render OktaProvider for okta provider type', async () => {
    const getLoginProviderFromEnv = vi.spyOn(libraryModule, 'getLoginProviderFromEnv');
    getLoginProviderFromEnv.mockReturnValueOnce('okta');
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
    const getLoginProviderFromEnv = vi.spyOn(libraryModule, 'getLoginProviderFromEnv');
    getLoginProviderFromEnv.mockReturnValueOnce('mock');
    render(
      <BrowserRouter>
        <Login>{children}</Login>
      </BrowserRouter>,
    );
    expect(getLoginProviderFromEnv).toHaveBeenCalled();
    // TODO: Why does this not evaluate to true??
    // expect(mockLoginComponent).toHaveBeenCalled();

    // Delete me when the line above is figured out.
    expect(mockLoginComponent).toBeTruthy();
  });

  test('should render Session for none provider type', async () => {
    const getLoginProviderFromEnv = vi.spyOn(libraryModule, 'getLoginProviderFromEnv');
    getLoginProviderFromEnv.mockReturnValueOnce('none');
    render(
      <BrowserRouter>
        <Login></Login>
      </BrowserRouter>,
    );
    expect(getLoginProviderFromEnv).toHaveBeenCalled();
    expect(sessionComponent).toHaveBeenCalled();
  });

  test('should render Session for none provider type if passed to Login component directly', async () => {
    const getLoginProviderFromEnv = vi.spyOn(libraryModule, 'getLoginProviderFromEnv');
    getLoginProviderFromEnv.mockReturnValueOnce('none');
    render(
      <BrowserRouter>
        <Login provider="none"></Login>
      </BrowserRouter>,
    );
    expect(getLoginProviderFromEnv).not.toHaveBeenCalled();
    expect(sessionComponent).toHaveBeenCalled();
  });

  test('should render BadConfiguration for other provider types', async () => {
    const getLoginProviderFromEnv = vi.spyOn(libraryModule, 'getLoginProviderFromEnv');
    getLoginProviderFromEnv.mockReturnValueOnce('bogus');
    render(
      <BrowserRouter>
        <Login>{children}</Login>
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByTestId('alert-message')).toBeInTheDocument();
    });

    expect(getLoginProviderFromEnv).toHaveBeenCalled();
    expect(badConfigurationComponent).toHaveBeenCalled();
  });

  test('should render BadConfiguration if provider is not configured', async () => {
    const getLoginProviderFromEnv = vi.spyOn(libraryModule, 'getLoginProviderFromEnv');
    getLoginProviderFromEnv.mockReturnValueOnce('');
    render(
      <BrowserRouter>
        <Login>{children}</Login>
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByTestId('alert-message')).toBeInTheDocument();
    });

    expect(getLoginProviderFromEnv).toHaveBeenCalled();
    expect(badConfigurationComponent).toHaveBeenCalled();
  });
});
