import { render, screen } from '@testing-library/react';
import { SearchResultsHeader } from './SearchResultsHeader';
import { describe, test, expect } from 'vitest';

describe('SearchResultsHeader', () => {
  test('should render all columns when debtor name column is shown', () => {
    const labels = ['Case Number (Division)', 'Case Title', 'Debtor Name', 'Chapter', 'Case Filed'];

    render(
      <table>
        <thead>
          <SearchResultsHeader id="test-header" labels={labels} showDebtorNameColumn={true} />
        </thead>
      </table>,
    );

    expect(screen.getByTestId('header-case-number')).toBeInTheDocument();
    expect(screen.getByTestId('header-case-title')).toBeInTheDocument();
    expect(screen.getByTestId('header-debtor-name')).toBeInTheDocument();
    expect(screen.getByTestId('header-chapter')).toBeInTheDocument();
    expect(screen.getByTestId('header-date-filed')).toBeInTheDocument();
  });

  test('should not render Debtor Name column when debtor name column is hidden', () => {
    const labels = ['Case Number (Division)', 'Case Title', 'Chapter', 'Case Filed'];

    render(
      <table>
        <thead>
          <SearchResultsHeader id="test-header" labels={labels} showDebtorNameColumn={false} />
        </thead>
      </table>,
    );

    expect(screen.getByTestId('header-case-number')).toBeInTheDocument();
    expect(screen.getByTestId('header-case-title')).toBeInTheDocument();
    expect(screen.queryByTestId('header-debtor-name')).not.toBeInTheDocument();
    expect(screen.getByTestId('header-chapter')).toBeInTheDocument();
    expect(screen.getByTestId('header-date-filed')).toBeInTheDocument();
  });
});
