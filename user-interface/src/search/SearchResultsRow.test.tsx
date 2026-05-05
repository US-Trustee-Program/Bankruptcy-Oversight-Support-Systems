import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { SearchResultsRow } from './SearchResultsRow';
import MockData from '@common/cams/test-utilities/mock-data';

describe('SearchResultsRow', () => {
  const labels = ['Case Number (Division)', 'Case Title', 'Chapter', 'Case Filed'];

  function renderRow(overrides = {}, showOpenClosedColumn = false) {
    const bCase = MockData.getSyncedCase({ override: overrides });
    render(
      <BrowserRouter>
        <SearchResultsRow
          bCase={bCase}
          labels={[...labels, 'Open/Closed']}
          idx={0}
          showOpenClosedColumn={showOpenClosedColumn}
        />
      </BrowserRouter>,
    );
  }

  test('shows "Open" for a case with no closedDate when showOpenClosedColumn is true', () => {
    renderRow({ closedDate: undefined }, true);
    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  test('shows "Closed" for a case with a closedDate when showOpenClosedColumn is true', () => {
    renderRow({ closedDate: '2024-01-01' }, true);
    expect(screen.getByText('Closed')).toBeInTheDocument();
  });

  test('does not render Open/Closed cell when showOpenClosedColumn is false', () => {
    renderRow({ closedDate: undefined }, false);
    expect(screen.queryByText('Open')).not.toBeInTheDocument();
    expect(screen.queryByText('Closed')).not.toBeInTheDocument();
  });
});
