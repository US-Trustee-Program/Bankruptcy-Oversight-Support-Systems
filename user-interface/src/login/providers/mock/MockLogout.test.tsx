import { describe } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { MockLogout } from './MockLogout';

describe('MockLogout', () => {
  test('should render the SessionEnd component', () => {
    render(
      <BrowserRouter>
        <MockLogout></MockLogout>
      </BrowserRouter>,
    );
    expect(screen.queryByTestId('alert-container')).toBeInTheDocument();
  });
});
