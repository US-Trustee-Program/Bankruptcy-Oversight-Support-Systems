import { describe } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { OktaLogout } from './OktaLogout';

describe('OktaLogout', () => {
  test.skip('should render the SessionEnd component', () => {
    render(
      <BrowserRouter>
        <OktaLogout></OktaLogout>
      </BrowserRouter>,
    );
    expect(screen.queryByTestId('alert-container')).toBeInTheDocument();
  });
});
