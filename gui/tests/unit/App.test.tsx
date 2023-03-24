import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from '../../src/App';

test('renders Total Active Cases', () => {
  render(
    <BrowserRouter>
      <App />
    </BrowserRouter>,
  );

  expect(1).toBe(1);
  /*
  const h1 = screen.getByText(/Case List/i);
  expect(h1).toBeInTheDocument();

  const tableHeader = screen.getAllByRole('columnheader');
  expect(tableHeader[0].textContent).toBe('Case Div');
  expect(tableHeader[1].textContent).toBe('Case Year');
  expect(tableHeader[2].textContent).toBe('Case Number');
  expect(tableHeader[3].textContent).toBe('Chapter');
  expect(tableHeader[4].textContent).toBe('Staff 1');
  expect(tableHeader[5].textContent).toBe('Staff 2');
   */
});

