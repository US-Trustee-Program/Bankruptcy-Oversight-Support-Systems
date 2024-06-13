import { fireEvent, render, screen } from '@testing-library/react';
import { describe } from 'vitest';
import { SessionEnd } from './SessionEnd';
import { BrowserRouter } from 'react-router-dom';
import * as reactRouter from 'react-router';
import { LOGIN_PATH } from './login-library';

describe('SessionEnd', () => {
  test('should render alert', () => {
    render(
      <BrowserRouter>
        <SessionEnd></SessionEnd>
      </BrowserRouter>,
    );
    expect(screen.queryByTestId('alert-container')).toBeInTheDocument();
  });
  test('should clear session from local storage', () => {
    render(
      <BrowserRouter>
        <SessionEnd></SessionEnd>
      </BrowserRouter>,
    );
    // TODO
  });
  test('should allow the user to redirect to login', () => {
    const navigate = vi.fn();
    const useNavigate = vi.spyOn(reactRouter, 'useNavigate').mockImplementation(() => {
      return navigate;
    });
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
