import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BankDetailNavigation } from './BankDetailNavigation';

describe('BankDetailNavigation', () => {
  test('should render Overview link with correct path', () => {
    render(
      <MemoryRouter>
        <BankDetailNavigation bankId="bank-1" />
      </MemoryRouter>,
    );

    const overviewLink = screen.getByTestId('bank-overview-nav-link');
    expect(overviewLink).toBeInTheDocument();
    expect(overviewLink).toHaveTextContent('Overview');
    expect(overviewLink).toHaveAttribute('href', '/admin/banks/bank-1/overview');
  });

  test('should render Change History link with correct path', () => {
    render(
      <MemoryRouter>
        <BankDetailNavigation bankId="bank-1" />
      </MemoryRouter>,
    );

    const historyLink = screen.getByTestId('bank-audit-history-nav-link');
    expect(historyLink).toBeInTheDocument();
    expect(historyLink).toHaveTextContent('Change History');
    expect(historyLink).toHaveAttribute('href', '/admin/banks/bank-1/audit-history');
  });
});
