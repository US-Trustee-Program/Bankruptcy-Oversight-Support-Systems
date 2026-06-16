import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  test('calls onCaseClick with bCase and rank when case number link is clicked', async () => {
    const onCaseClick = vi.fn();
    const bCase = MockData.getSyncedCase({ override: { caseId: '000-11-22222' } });
    render(
      <BrowserRouter>
        <SearchResultsRow
          bCase={bCase}
          labels={[...labels, 'Open/Closed']}
          idx={2}
          rank={3}
          onCaseClick={onCaseClick}
        />
      </BrowserRouter>,
    );

    const link = screen.getByRole('link');
    await userEvent.click(link);

    expect(onCaseClick).toHaveBeenCalledTimes(1);
    expect(onCaseClick).toHaveBeenCalledWith(bCase, 3);
  });

  test('falls back to idx + 1 as rank when rank prop is omitted', async () => {
    const onCaseClick = vi.fn();
    const bCase = MockData.getSyncedCase({ override: { caseId: '000-11-22222' } });
    render(
      <BrowserRouter>
        <SearchResultsRow
          bCase={bCase}
          labels={[...labels, 'Open/Closed']}
          idx={4}
          onCaseClick={onCaseClick}
        />
      </BrowserRouter>,
    );

    const link = screen.getByRole('link');
    await userEvent.click(link);

    expect(onCaseClick).toHaveBeenCalledWith(bCase, 5);
  });
});
