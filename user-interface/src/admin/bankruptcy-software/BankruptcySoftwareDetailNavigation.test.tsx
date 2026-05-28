import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BankruptcySoftwareDetailNavigation } from './BankruptcySoftwareDetailNavigation';

describe('BankruptcySoftwareDetailNavigation', () => {
  test('should render Overview, Trustees, and Change History links with correct paths', () => {
    render(
      <MemoryRouter>
        <BankruptcySoftwareDetailNavigation softwareId="sw-1" />
      </MemoryRouter>,
    );

    const overviewLink = screen.getByTestId('software-overview-nav-link');
    expect(overviewLink).toHaveTextContent('Overview');
    expect(overviewLink).toHaveAttribute('href', '/admin/bankruptcy-software/sw-1/overview');

    const trusteesLink = screen.getByTestId('software-trustees-nav-link');
    expect(trusteesLink).toHaveTextContent('Trustees');
    expect(trusteesLink).toHaveAttribute('href', '/admin/bankruptcy-software/sw-1/trustees');

    const historyLink = screen.getByTestId('software-audit-history-nav-link');
    expect(historyLink).toHaveTextContent('Change History');
    expect(historyLink).toHaveAttribute('href', '/admin/bankruptcy-software/sw-1/audit-history');
  });

  test('should apply active class to Overview link when on overview route', () => {
    render(
      <MemoryRouter initialEntries={['/admin/bankruptcy-software/sw-1/overview']}>
        <BankruptcySoftwareDetailNavigation softwareId="sw-1" />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('software-overview-nav-link')).toHaveClass('usa-current');
    expect(screen.getByTestId('software-trustees-nav-link')).not.toHaveClass('usa-current');
    expect(screen.getByTestId('software-audit-history-nav-link')).not.toHaveClass('usa-current');
  });

  test('should apply active class to Trustees link when on trustees route', () => {
    render(
      <MemoryRouter initialEntries={['/admin/bankruptcy-software/sw-1/trustees']}>
        <BankruptcySoftwareDetailNavigation softwareId="sw-1" />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('software-trustees-nav-link')).toHaveClass('usa-current');
    expect(screen.getByTestId('software-overview-nav-link')).not.toHaveClass('usa-current');
    expect(screen.getByTestId('software-audit-history-nav-link')).not.toHaveClass('usa-current');
  });

  test('should apply active class to Change History link when on audit-history route', () => {
    render(
      <MemoryRouter initialEntries={['/admin/bankruptcy-software/sw-1/audit-history']}>
        <BankruptcySoftwareDetailNavigation softwareId="sw-1" />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('software-audit-history-nav-link')).toHaveClass('usa-current');
    expect(screen.getByTestId('software-overview-nav-link')).not.toHaveClass('usa-current');
    expect(screen.getByTestId('software-trustees-nav-link')).not.toHaveClass('usa-current');
  });
});
