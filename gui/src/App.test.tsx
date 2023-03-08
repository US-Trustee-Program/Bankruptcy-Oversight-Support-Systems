import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

test('renders Total Active Cases', () => {
  render(
    <BrowserRouter>
      <App />
    </BrowserRouter>,
  );

  const h1 = screen.getByText(/Total Active Cases/i);
  expect(h1).toBeInTheDocument();

  const p = screen.getByText(/[0-9]+/);
  expect(p).toBeInTheDocument();
});
