import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DevLogin } from './DevLogin';
import * as apiConfiguration from '@/configuration/apiConfiguration';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';

// Mock dependencies
vi.mock('@/login/Session', () => ({
  Session: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="session-component">{children}</div>
  ),
}));

vi.mock('@/login/BlankPage', () => ({
  BlankPage: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="blank-page">{children}</div>
  ),
}));

const mockApiConfig = {
  protocol: 'http',
  server: 'localhost',
  port: '3000',
  basePath: '/api',
};

describe('DevLogin component', () => {
  beforeEach(() => {
    vi.spyOn(apiConfiguration, 'default').mockReturnValue(mockApiConfig);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderWithRouter(user = null) {
    return render(
      <BrowserRouter>
        <DevLogin user={user}>
          <div data-testid="child-content">App Content</div>
        </DevLogin>
      </BrowserRouter>,
    );
  }

  describe('rendering', () => {
    test('should render login modal with username and password inputs', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Developer Login')).toBeInTheDocument();
      });

      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
    });

    test('should render within BlankPage component', () => {
      renderWithRouter();

      expect(screen.getByTestId('blank-page')).toBeInTheDocument();
    });
  });

  describe('form validation', () => {
    test('should have submit button disabled initially', async () => {
      renderWithRouter();

      await waitFor(() => {
        const loginButton = screen.getByTestId('button-login-modal-submit-button');
        expect(loginButton).toBeDisabled();
      });
    });

    test('should keep submit button disabled when only username is filled', async () => {
      const user = userEvent.setup();
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      });

      const usernameInput = screen.getByLabelText(/username/i);
      await user.type(usernameInput, 'testuser');

      await waitFor(() => {
        const loginButton = screen.getByTestId('button-login-modal-submit-button');
        expect(loginButton).toBeDisabled();
      });
    });

    test('should keep submit button disabled when only password is filled', async () => {
      const user = userEvent.setup();
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      });

      const passwordInput = screen.getByLabelText(/password/i);
      await user.type(passwordInput, 'testpassword');

      await waitFor(() => {
        const loginButton = screen.getByTestId('button-login-modal-submit-button');
        expect(loginButton).toBeDisabled();
      });
    });

    test('should enable submit button when both fields are filled', async () => {
      const user = userEvent.setup();
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      });

      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'testpassword');

      await waitFor(() => {
        const loginButton = screen.getByTestId('button-login-modal-submit-button');
        expect(loginButton).toBeEnabled();
      });
    });

    test('should clear username and re-disable button when username is cleared', async () => {
      const user = userEvent.setup();
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      });

      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'testpassword');

      await waitFor(() => {
        const loginButton = screen.getByTestId('button-login-modal-submit-button');
        expect(loginButton).toBeEnabled();
      });

      await user.clear(usernameInput);

      await waitFor(() => {
        const loginButton = screen.getByTestId('button-login-modal-submit-button');
        expect(loginButton).toBeDisabled();
      });
    });
  });

  describe('authentication flow', () => {
    test('should display error alert on invalid credentials', async () => {
      const user = userEvent.setup();
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      });

      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);

      await user.type(usernameInput, 'wronguser');
      await user.type(passwordInput, 'wrongpassword');

      const loginButton = screen.getByTestId('button-login-modal-submit-button');
      fireEvent.click(loginButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid username or password.')).toBeInTheDocument();
      });
    });

    test('should display error alert when no token is received', async () => {
      const user = userEvent.setup();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} }),
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      });

      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'testpassword');

      const loginButton = screen.getByTestId('button-login-modal-submit-button');
      fireEvent.click(loginButton);

      await waitFor(() => {
        expect(screen.getByText('Authentication failed. No token received.')).toBeInTheDocument();
      });
    });

    test('should display error alert on invalid token format', async () => {
      const user = userEvent.setup();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { value: 'invalid.token' } }),
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      });

      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'testpassword');

      const loginButton = screen.getByTestId('button-login-modal-submit-button');
      fireEvent.click(loginButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid token format.')).toBeInTheDocument();
      });
    });

    test('should display error alert on fetch exception', async () => {
      const user = userEvent.setup();
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      });

      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'testpassword');

      const loginButton = screen.getByTestId('button-login-modal-submit-button');
      fireEvent.click(loginButton);

      await waitFor(() => {
        expect(screen.getByText('Login failed. Please try again.')).toBeInTheDocument();
      });
    });

    test('should render Session component on successful authentication', async () => {
      const user = userEvent.setup();
      const mockToken = `header.${btoa(JSON.stringify({ sub: 'user123', exp: 9999999999 }))}.signature`;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { value: mockToken } }),
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      });

      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);

      await user.type(usernameInput, 'validuser');
      await user.type(passwordInput, 'validpassword');

      const loginButton = screen.getByTestId('button-login-modal-submit-button');
      fireEvent.click(loginButton);

      await waitFor(() => {
        expect(screen.getByTestId('session-component')).toBeInTheDocument();
      });

      expect(screen.getByTestId('child-content')).toHaveTextContent('App Content');
    });

    test('should make fetch request with correct credentials', async () => {
      const user = userEvent.setup();
      const mockToken = `header.${btoa(JSON.stringify({ sub: 'user123', exp: 9999999999 }))}.signature`;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { value: mockToken } }),
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      });

      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'testpass');

      const loginButton = screen.getByTestId('button-login-modal-submit-button');
      fireEvent.click(loginButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      const fetchCall = (global.fetch as unknown as { mock: { calls: [string, RequestInit][] } })
        .mock.calls[0];
      expect(fetchCall[0]).toMatch(/\/oauth2\/default$/);
      expect(fetchCall[1]).toMatchObject({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: 'testuser', password: 'testpass' }),
      });
    });
  });

  describe('configuration errors', () => {
    test('should display error alert when issuer URL is invalid', async () => {
      const user = userEvent.setup();
      // Mock URL.canParse to return false
      const originalCanParse = URL.canParse;
      URL.canParse = vi.fn().mockReturnValue(false);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      });

      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'testpassword');

      const loginButton = screen.getByTestId('button-login-modal-submit-button');
      fireEvent.click(loginButton);

      await waitFor(() => {
        expect(screen.getByText('Configuration error. Invalid issuer URL.')).toBeInTheDocument();
      });

      expect(console.error).toHaveBeenCalledWith(
        'Dev issuer is not a valid URL. Check values in configuration.',
      );

      // Restore
      URL.canParse = originalCanParse;
    });
  });

  describe('alert clearing', () => {
    test('should clear alert when typing in username field', async () => {
      const user = userEvent.setup();
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      });

      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);

      await user.type(usernameInput, 'wronguser');
      await user.type(passwordInput, 'wrongpassword');

      const loginButton = screen.getByTestId('button-login-modal-submit-button');
      fireEvent.click(loginButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid username or password.')).toBeInTheDocument();
      });

      // Type in username field - should clear alert
      await user.type(usernameInput, 'a');

      await waitFor(() => {
        expect(screen.queryByText('Invalid username or password.')).not.toBeInTheDocument();
      });
    });

    test('should clear alert when typing in password field', async () => {
      const user = userEvent.setup();
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      });

      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);

      await user.type(usernameInput, 'wronguser');
      await user.type(passwordInput, 'wrongpassword');

      const loginButton = screen.getByTestId('button-login-modal-submit-button');
      fireEvent.click(loginButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid username or password.')).toBeInTheDocument();
      });

      // Type in password field - should clear alert
      await user.type(passwordInput, 'b');

      await waitFor(() => {
        expect(screen.queryByText('Invalid username or password.')).not.toBeInTheDocument();
      });
    });
  });
});
