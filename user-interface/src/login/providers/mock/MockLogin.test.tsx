import { describe } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { MockLogin } from './MockLogin';

describe('MockLogin', () => {
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

    await waitFor(() => {
      const childDiv = screen.queryByTestId(testId);
      expect(childDiv).toBeInTheDocument();
      expect(childDiv).toHaveTextContent(childText);
    });
  });
});
