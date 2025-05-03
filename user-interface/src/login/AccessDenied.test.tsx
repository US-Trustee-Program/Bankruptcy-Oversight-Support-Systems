import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe } from 'vitest';

import { AccessDenied } from './AccessDenied';

describe('AccessDenied', () => {
  test('should render alert and return to login button', async () => {
    render(
      <BrowserRouter>
        <AccessDenied></AccessDenied>
      </BrowserRouter>,
    );
    expect(screen.queryByTestId('alert-container')).toBeInTheDocument();
    const loginButton = screen.getByTestId('button-return-to-login');
    expect(loginButton).toBeVisible();
    fireEvent.click(loginButton);
  });
});
