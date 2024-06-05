import { render, screen } from '@testing-library/react';
import { describe } from 'vitest';
import { AccessDenied } from './AccessDenied';
import { BrowserRouter } from 'react-router-dom';

describe('AccessDenied', () => {
  test('should render alert', async () => {
    render(
      <BrowserRouter>
        <AccessDenied></AccessDenied>
      </BrowserRouter>,
    );
    expect(screen.queryByTestId('alert-container')).toBeInTheDocument();
  });
});
