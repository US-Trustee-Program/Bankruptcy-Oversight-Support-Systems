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

    expect(
      screen.getByRole('columnheader', { name: 'Case Number (Division)' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Case Title' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Debtor Name' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Chapter' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Case Filed' })).toBeInTheDocument();
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

    expect(
      screen.getByRole('columnheader', { name: 'Case Number (Division)' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Case Title' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Debtor Name' })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Chapter' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Case Filed' })).toBeInTheDocument();
  });
});
