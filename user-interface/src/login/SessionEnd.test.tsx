import LocalStorage from '@/lib/utils/local-storage';
import { fireEvent, render, screen } from '@testing-library/react';
import * as reactRouter from 'react-router';
import { BrowserRouter } from 'react-router-dom';
import { describe } from 'vitest';

import { LOGIN_PATH, LOGOUT_SESSION_END_PATH } from './login-library';
import { SessionEnd } from './SessionEnd';

describe('SessionEnd', () => {
  const navigate = vi.fn();
  const useNavigate = vi.spyOn(reactRouter, 'useNavigate').mockImplementation(() => {
    return navigate;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should render alert', () => {
    render(
      <BrowserRouter>
        <SessionEnd></SessionEnd>
      </BrowserRouter>,
    );
    expect(screen.getByTestId('alert-container')).toBeInTheDocument();
  });

  test('should clear session from local storage', () => {
    const removeSession = vi.spyOn(LocalStorage, 'removeSession');
    const removeAck = vi.spyOn(LocalStorage, 'removeAck');
    render(
      <BrowserRouter>
        <SessionEnd></SessionEnd>
      </BrowserRouter>,
    );
    expect(removeSession).toHaveBeenCalled();
    expect(removeAck).toHaveBeenCalled();
  });

  test('should change the path to /session-end', () => {
    render(
      <BrowserRouter>
        <SessionEnd></SessionEnd>
      </BrowserRouter>,
    );
    expect(useNavigate).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(LOGOUT_SESSION_END_PATH);
  });

  test('should allow the user to redirect to login', () => {
    render(
      <BrowserRouter>
        <SessionEnd></SessionEnd>
      </BrowserRouter>,
    );
    const loginRedirectButton = screen.queryByTestId('button-login');
    expect(loginRedirectButton).toBeInTheDocument();

    fireEvent.click(loginRedirectButton!);

    expect(useNavigate).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(LOGIN_PATH);
  });
});
