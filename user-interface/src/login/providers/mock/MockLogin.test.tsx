import { describe } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { MockLogin } from './MockLogin';
import { MockData } from '@common/cams/test-utilities/mock-data';

describe('MockLogin', () => {
  const fetchSpy = vi
    .spyOn(global, 'fetch')
    .mockImplementation(
      (_input: string | URL | Request, _init?: RequestInit): Promise<Response> => {
        return Promise.resolve({
          ok: true,
          json: vi.fn().mockResolvedValue({ token: MockData.getJwt() }),
        } as unknown as Response);
      },
    );

  beforeEach(() => {
    vi.clearAllMocks();
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

    const radioButton = screen.queryByTestId('radio-role-0-click-target');
    expect(radioButton).toBeInTheDocument();
    fireEvent.click(radioButton!);

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

    const radioButton = screen.queryByTestId('radio-role-0-click-target');
    expect(radioButton).toBeInTheDocument();
    fireEvent.click(radioButton!);

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
});
