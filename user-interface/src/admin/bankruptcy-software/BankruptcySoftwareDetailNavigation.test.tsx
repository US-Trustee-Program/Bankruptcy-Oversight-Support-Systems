import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BankruptcySoftwareDetailNavigation } from './BankruptcySoftwareDetailNavigation';

describe('BankruptcySoftwareDetailNavigation', () => {
  test('should render Overview link with correct path', () => {
    render(
      <MemoryRouter>
        <BankruptcySoftwareDetailNavigation softwareId="sw-1" />
      </MemoryRouter>,
    );

    const overviewLink = screen.getByTestId('software-overview-nav-link');
    expect(overviewLink).toBeInTheDocument();
    expect(overviewLink).toHaveTextContent('Overview');
    expect(overviewLink).toHaveAttribute('href', '/admin/bankruptcy-software/sw-1/overview');
  });

  test('should render Change History link with correct path', () => {
    render(
      <MemoryRouter>
        <BankruptcySoftwareDetailNavigation softwareId="sw-1" />
      </MemoryRouter>,
    );

    const historyLink = screen.getByTestId('software-audit-history-nav-link');
    expect(historyLink).toBeInTheDocument();
    expect(historyLink).toHaveTextContent('Change History');
    expect(historyLink).toHaveAttribute('href', '/admin/bankruptcy-software/sw-1/audit-history');
  });
});
