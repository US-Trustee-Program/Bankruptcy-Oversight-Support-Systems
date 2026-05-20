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
    expect(historyLink).toHaveTextContent('Change History');
    expect(historyLink).toHaveAttribute('href', '/admin/banks/bank-1/audit-history');
  });

  test('should apply active class to Overview link when on overview route', () => {
    render(
      <MemoryRouter initialEntries={['/admin/banks/bank-1/overview']}>
        <BankDetailNavigation bankId="bank-1" />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('bank-overview-nav-link')).toHaveClass('usa-current');
    expect(screen.getByTestId('bank-audit-history-nav-link')).not.toHaveClass('usa-current');
  });

  test('should apply active class to Change History link when on audit-history route', () => {
    render(
      <MemoryRouter initialEntries={['/admin/banks/bank-1/audit-history']}>
        <BankDetailNavigation bankId="bank-1" />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('bank-audit-history-nav-link')).toHaveClass('usa-current');
    expect(screen.getByTestId('bank-overview-nav-link')).not.toHaveClass('usa-current');
  });
});
