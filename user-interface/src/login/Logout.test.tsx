import { describe } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import * as oktaProviderModule from './providers/okta/OktaProvider';
import * as oktaLogoutModule from './providers/okta/OktaLogout';
import * as mockLogoutModule from './providers/mock/MockLogout';
import * as sessionEndModule from './SessionEnd';
import { PropsWithChildren } from 'react';
import * as libraryModule from '@/login/login-library';
import { Logout } from './Logout';
import { SessionEnd } from './SessionEnd';
import { BrowserRouter } from 'react-router-dom';

describe('Logout', () => {
  const getLoginProviderFromEnv = vi.spyOn(libraryModule, 'getLoginProviderFromEnv');
  const oktaProviderComponent = vi
    .spyOn(oktaProviderModule, 'OktaProvider')
    .mockImplementation((props: PropsWithChildren) => {
      return <>{props.children}</>;
    });
  const oktaLogoutComponent = vi.spyOn(oktaLogoutModule, 'OktaLogout').mockImplementation(() => {
    return <SessionEnd />;
  });
  const mockLogoutComponent = vi.spyOn(mockLogoutModule, 'MockLogout').mockImplementation(() => {
    return <SessionEnd />;
  });
  const sessionEndComponent = vi.spyOn(sessionEndModule, 'SessionEnd');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should render OktaProvider for okta provider type', async () => {
    getLoginProviderFromEnv.mockReturnValueOnce('okta');
    render(
      <BrowserRouter>
        <Logout></Logout>
      </BrowserRouter>,
    );
    await waitFor(() => {
      expect(screen.queryByTestId('alert-message')).toBeInTheDocument();
    });

    expect(getLoginProviderFromEnv).toHaveBeenCalled();
    expect(oktaProviderComponent).toHaveBeenCalled();
    expect(oktaLogoutComponent).toHaveBeenCalled();
    expect(sessionEndComponent).toHaveBeenCalled();
  });

  test('should render MockProvider for mock provider type', async () => {
    getLoginProviderFromEnv.mockReturnValueOnce('mock');
    render(
      <BrowserRouter>
        <Logout></Logout>
      </BrowserRouter>,
    );
    await waitFor(() => {
      expect(screen.queryByTestId('alert-message')).toBeInTheDocument();
    });

    expect(getLoginProviderFromEnv).toHaveBeenCalled();
    expect(mockLogoutComponent).toHaveBeenCalled();
    expect(sessionEndComponent).toHaveBeenCalled();
  });

  test('should render SessionEnd for all other provider types', async () => {
    getLoginProviderFromEnv.mockReturnValueOnce('none');
    render(
      <BrowserRouter>
        <Logout></Logout>
      </BrowserRouter>,
    );
    await waitFor(() => {
      expect(screen.queryByTestId('alert-message')).toBeInTheDocument();
    });

    expect(getLoginProviderFromEnv).toHaveBeenCalled();
    expect(sessionEndComponent).toHaveBeenCalled();
  });
});
