import { render, screen } from '@testing-library/react';
import { SearchResultsHeader } from './SearchResultsHeader';
import { describe, it, expect } from 'vitest';

describe('SearchResultsHeader', () => {
  it('should render all columns when phonetic search is enabled', () => {
    const labels = ['Case Number (Division)', 'Case Title', 'Debtor Name', 'Chapter', 'Case Filed'];

    render(
      <table>
        <thead>
          <SearchResultsHeader id="test-header" labels={labels} phoneticSearchEnabled={true} />
        </thead>
      </table>,
    );

    expect(screen.getByText('Case Number (Division)')).toBeInTheDocument();
    expect(screen.getByText('Case Title')).toBeInTheDocument();
    expect(screen.getByText('Debtor Name')).toBeInTheDocument();
    expect(screen.getByText('Chapter')).toBeInTheDocument();
    expect(screen.getByText('Case Filed')).toBeInTheDocument();
  });

  it('should not render Debtor Name column when phonetic search is disabled', () => {
    const labels = ['Case Number (Division)', 'Case Title', 'Chapter', 'Case Filed'];

    render(
      <table>
        <thead>
          <SearchResultsHeader id="test-header" labels={labels} phoneticSearchEnabled={false} />
        </thead>
      </table>,
    );

    expect(screen.getByText('Case Number (Division)')).toBeInTheDocument();
    expect(screen.getByText('Case Title')).toBeInTheDocument();
    expect(screen.queryByText('Debtor Name')).not.toBeInTheDocument();
    expect(screen.getByText('Chapter')).toBeInTheDocument();
    expect(screen.getByText('Case Filed')).toBeInTheDocument();
  });
});
