import { describe } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { MockLogin } from './MockLogin';
import { MockData } from '@common/cams/test-utilities/mock-data';
import testingUtilities from '@/lib/testing/testing-utilities';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';

describe('MockLogin', () => {
  const fetchSpy = vi
    .spyOn(global, 'fetch')
    .mockImplementation(
      (_input: string | URL | Request, _init?: RequestInit): Promise<Response> => {
        return Promise.resolve({
          ok: true,
          json: vi.fn().mockResolvedValue({ data: { value: MockData.getJwt() } }),
        } as unknown as Response);
      },
    );

  beforeEach(() => {
    vi.clearAllMocks();
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
      const modal = screen.getByTestId('modal-login-modal');
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveAttribute('aria-labelledby', 'login-modal-heading');
    });
  });

  test('should report a bad mock issuer to the console', async () => {
    const errorSpy = vi.spyOn(global.console, 'error');

    const originalConfig = window.CAMS_CONFIGURATION;
    window.CAMS_CONFIGURATION = {
      ...originalConfig,
      CAMS_BASE_PATH: '',
      CAMS_SERVER_HOSTNAME: '',
      CAMS_SERVER_PORT: '',
      CAMS_SERVER_PROTOCOL: '',
    };

    vi.resetModules();
    const mod = await import('./MockLogin');
    const { MockLogin } = mod;

    window.CAMS_CONFIGURATION = originalConfig;

    render(
      <BrowserRouter>
        <MockLogin user={null}>
          <div>Hello World!!</div>
        </MockLogin>
      </BrowserRouter>,
    );

    await waitFor(() => {
      const radio = testingUtilities.selectRadio('role-0');
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

    testingUtilities.selectRadio('role-0');

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

    testingUtilities.selectRadio('role-0');

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
