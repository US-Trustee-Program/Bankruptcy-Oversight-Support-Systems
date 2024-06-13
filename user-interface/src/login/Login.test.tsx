import { PropsWithChildren } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { describe } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import * as oktaProviderModule from './providers/okta/OktaProvider';
import * as oktaLoginModule from './providers/okta/OktaLogin';
import * as badConfigurationModule from './BadConfiguration';
import * as libraryModule from '@/login/login-library';
import * as mockLoginModule from './providers/mock/MockLogin';
// import { CamsUser } from '@/login/login-library';
import Login from './Login';

describe('Login', () => {
  // const user: CamsUser = { name: 'First Last' };
  const testId = 'child-div';
  const childText = 'TEST';
  const children = <div data-testid={testId}>{childText}</div>;

  const getLoginProviderFromEnv = vi.spyOn(libraryModule, 'getLoginProviderFromEnv');

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
  const badConfigurationComponent = vi.spyOn(badConfigurationModule, 'BadConfiguration');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should render OktaProvider for okta provider type', async () => {
    getLoginProviderFromEnv.mockReturnValueOnce('okta');
    render(
      <BrowserRouter>
        <Login>{children}</Login>
      </BrowserRouter>,
    );

    fireEvent.click(screen.getByTestId('button-auo-confirm'));
    screen.debug();
    expect(getLoginProviderFromEnv).toHaveBeenCalled();
    expect(oktaProviderComponent).toHaveBeenCalled();
    expect(oktaLoginComponent).toHaveBeenCalled();
  });

  test('should render MockProvider for mock provider type', async () => {
    getLoginProviderFromEnv.mockReturnValueOnce('mock');
    render(
      <BrowserRouter>
        <Login>{children}</Login>
      </BrowserRouter>,
    );
    screen.debug();
    expect(getLoginProviderFromEnv).toHaveBeenCalled();
    expect(mockLoginComponent).toHaveBeenCalled();
  });

  // test('should render Session for none provider type', async () => {
  //   getLoginProviderFromEnv.mockReturnValueOnce('none');
  //   render(
  //     <BrowserRouter>
  //       <Login></Login>
  //     </BrowserRouter>,
  //   );
  //   expect(getLoginProviderFromEnv).toHaveBeenCalled();
  //   expect(mockLoginComponent).toHaveBeenCalled();
  // });

  test('should render BadConfiguration for other provider types', async () => {
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
});
