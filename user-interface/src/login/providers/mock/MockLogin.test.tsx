import testingUtilities from '@/lib/testing/testing-utilities';
import { MockData } from '@common/cams/test-utilities/mock-data';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe } from 'vitest';
import { vi } from 'vitest';

import { MockLogin } from './MockLogin';

describe('MockLogin', () => {
  const fetchSpy = vi
    .spyOn(global, 'fetch')
    .mockImplementation(
      (_input: Request | string | URL, _init?: RequestInit): Promise<Response> => {
        return Promise.resolve({
          json: vi.fn().mockResolvedValue({ data: { value: MockData.getJwt() } }),
          ok: true,
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

    vi.stubEnv('CAMS_BASE_PATH', '');
    vi.stubEnv('CAMS_SERVER_HOSTNAME', '');
    vi.stubEnv('CAMS_SERVER_PORT', '');
    vi.stubEnv('CAMS_SERVER_PROTOCOL', '');

    vi.resetModules();
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
      const radio = testingUtilities.selectRadio('role-0');
      expect(radio).toBeInTheDocument();
    });

    const loginButton = screen.queryByTestId('button-login-modal-submit-button');
    expect(loginButton).toBeInTheDocument();
    fireEvent.click(loginButton!);

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
    fireEvent.click(loginButton!);

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
        (_input: Request | string | URL, _init?: RequestInit): Promise<Response> => {
          return Promise.resolve({
            json: vi.fn().mockResolvedValue({ data: { value: null } }),
            ok: true,
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
    fireEvent.click(loginButton!);

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

    fireEvent.click(loginButton!);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
