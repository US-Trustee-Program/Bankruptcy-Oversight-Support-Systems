import { render, screen } from '@testing-library/react';
import { describe } from 'vitest';
import { SessionEnd } from './SessionEnd';
import { BrowserRouter } from 'react-router-dom';

describe('SessionEnd', () => {
  test('should render alert', () => {
    render(
      <BrowserRouter>
        <SessionEnd></SessionEnd>
      </BrowserRouter>,
    );
    expect(screen.queryByTestId('alert-container')).toBeInTheDocument();
  });
});
