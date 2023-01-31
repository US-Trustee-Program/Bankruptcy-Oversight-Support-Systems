import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Total Active Cases', () => {
  render(<App />);

  const h1 = screen.getByText(/Total Active Cases/i);
  expect(h1).toBeInTheDocument();

  const p = screen.getByText(/[0-9]+/);
  expect(p).toBeInTheDocument();
});
