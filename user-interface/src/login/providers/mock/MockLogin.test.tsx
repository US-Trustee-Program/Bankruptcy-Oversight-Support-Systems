import { describe, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import MockData from '@common/cams/test-utilities/mock-data';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';
import { MockLogin } from './MockLogin';
import * as SessionModule from '@/login/Session';
import { SessionProps } from '@/login/Session';
import { blankConfiguration } from '@/lib/testing/mock-configuration';

describe('MockLogin', () => {
  let userEvent: CamsUserEvent;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockImplementation(
        (_input: string | URL | Request, _init?: RequestInit): Promise<Response> => {
          return Promise.resolve({
            ok: true,
            json: vi.fn().mockResolvedValue({ data: { value: MockData.getJwt() } }),
          } as unknown as Response);
        },
      );

    vi.spyOn(SessionModule, 'Session').mockImplementation((props: SessionProps) => {
      return <>{props.children}</>;
    });

    userEvent = TestingUtilities.setupUserEvent();
  });

  test('should show modal when no session exists', async () => {
    render(
      <BrowserRouter>
        <MockLogin user={null}>
          <div>Hello World!!</div>
        </MockLogin>
      </BrowserRouter>,
    );

    await waitFor(() => {
      const modal = screen.getByTestId('modal-content-login-modal');
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveAttribute('aria-labelledby', 'login-modal-heading');
    });
  });

  test('should report a bad mock issuer to the console', async () => {
    const errorSpy = vi.spyOn(global.console, 'error');

    vi.resetModules();
    vi.doMock('@/configuration/appConfiguration', async () => {
      return {
        default: () => ({
          ...blankConfiguration,
          basePath: '',
          serverHostName: '',
          serverPort: '',
          serverProtocol: '',
        }),
      };
    });

    const mod = await import('./MockLogin');
    const { MockLogin } = mod;

    render(
      <BrowserRouter>
        <MockLogin user={null}>
          <div>Hello World!!</div>
        </MockLogin>
      </BrowserRouter>,
    );

    await waitFor(() => {
      const radio = TestingUtilities.selectRadio('role-0');
      expect(radio).toBeInTheDocument();
    });

    const loginButton = screen.queryByTestId('button-login-modal-submit-button');
    expect(loginButton).toBeInTheDocument();
    await userEvent.click(loginButton!);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });

  test('should allow the user to select a role', async () => {
    const testId = 'child-div';
    const childText = 'TEST';

    const children = <div data-testid={testId}>{childText}</div>;
    render(
      <BrowserRouter>
        <MockLogin user={null}>{children}</MockLogin>
      </BrowserRouter>,
    );

    TestingUtilities.selectRadio('role-0');

    const loginButton = screen.queryByTestId('button-login-modal-submit-button');
    expect(loginButton).toBeInTheDocument();
    await userEvent.click(loginButton!);

    expect(fetchSpy).toHaveBeenCalled();

    await waitFor(() => {
      const childDiv = screen.queryByTestId(testId);
      expect(childDiv).toBeInTheDocument();
      expect(childDiv).toHaveTextContent(childText);
    });
  });

  test('should handle failed login response', async () => {
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockImplementation(
        (_input: string | URL | Request, _init?: RequestInit): Promise<Response> => {
          return Promise.resolve({
            ok: true,
            json: vi.fn().mockResolvedValue({ data: { value: null } }),
          } as unknown as Response);
        },
      );

    render(
      <BrowserRouter>
        <MockLogin user={null}>
          <div>Hello World!!</div>
        </MockLogin>
      </BrowserRouter>,
    );

    TestingUtilities.selectRadio('role-0');

    const loginButton = screen.queryByTestId('button-login-modal-submit-button');
    expect(loginButton).toBeInTheDocument();
    await userEvent.click(loginButton!);

    expect(fetchSpy).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByTestId('child-div')).not.toBeInTheDocument();
    });
  });

  test('should not attempt login without selected role', async () => {
    render(
      <BrowserRouter>
        <MockLogin user={null}>
          <div>Hello World!!</div>
        </MockLogin>
      </BrowserRouter>,
    );

    const loginButton = screen.queryByTestId('button-login-modal-submit-button');
    expect(loginButton).toBeInTheDocument();
    expect(loginButton).toBeDisabled();

    await userEvent.click(loginButton!);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
