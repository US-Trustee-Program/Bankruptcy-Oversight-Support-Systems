import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import TrusteeCaseList from './TrusteeCaseList';
import Api2 from '@/lib/models/api2';
import { TrusteeCaseListItem } from '@common/cams/trustee-appointments';
import { DEFAULT_SEARCH_LIMIT, DEFAULT_SEARCH_OFFSET } from '@common/api/search';

const mockCases: TrusteeCaseListItem[] = [
  {
    caseId: '081-24-12345',
    caseNumber: '24-12345',
    courtDivisionName: 'White Plains',
    caseTitle: 'Test Debtor One',
    chapter: '7',
    dateFiled: '2024-03-15',
    appointedDate: '2024-03-20',
  },
  {
    caseId: '081-23-99999',
    caseNumber: '23-99999',
    courtDivisionName: 'Manhattan',
    caseTitle: 'Test Debtor Two',
    chapter: '13',
    dateFiled: '2023-11-01',
    appointedDate: '2023-11-05',
  },
];

const noPagination = { count: 2, totalCount: 2, currentPage: 1, totalPages: 1, limit: 25 };
const withPagination = { count: 25, totalCount: 60, currentPage: 1, totalPages: 3, limit: 25 };

function renderComponent(trusteeId = 'trustee-123') {
  return render(
    <BrowserRouter>
      <TrusteeCaseList trusteeId={trusteeId} />
    </BrowserRouter>,
  );
}

describe('TrusteeCaseList', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('shows loading spinner while fetching', () => {
    vi.spyOn(Api2, 'getTrusteeCases').mockReturnValue(new Promise(() => {}));
    renderComponent();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  test('shows empty state when no cases returned', async () => {
    vi.spyOn(Api2, 'getTrusteeCases').mockResolvedValue({
      data: [],
      pagination: { count: 0, totalCount: 0, currentPage: 1, totalPages: 0, limit: 25 },
    });
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('No case appointments found.')).toBeInTheDocument();
    });
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  test('shows error alert when fetch fails', async () => {
    vi.spyOn(Api2, 'getTrusteeCases').mockRejectedValue(new Error('network error'));
    renderComponent();
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load case list.');
  });

  test('renders table with case data including all columns', async () => {
    vi.spyOn(Api2, 'getTrusteeCases').mockResolvedValue({
      data: mockCases,
      pagination: noPagination,
    });
    renderComponent();
    await waitFor(() => {
      expect(screen.getByRole('table', { name: 'Case list for trustee' })).toBeInTheDocument();
    });

    // case numbers with division (via CaseNumber component + division text)
    expect(screen.getByText('24-12345')).toBeInTheDocument();
    expect(screen.getByText('23-99999')).toBeInTheDocument();
    expect(screen.getByText('(White Plains)')).toBeInTheDocument();
    expect(screen.getByText('(Manhattan)')).toBeInTheDocument();

    // case title column
    expect(screen.getByText('Test Debtor One')).toBeInTheDocument();
    expect(screen.getByText('Test Debtor Two')).toBeInTheDocument();

    // chapter column
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('13')).toBeInTheDocument();

    // date columns (formatted MM/DD/YYYY)
    expect(screen.getByText('03/15/2024')).toBeInTheDocument();
    expect(screen.getByText('03/20/2024')).toBeInTheDocument();
  });

  test('renders correct column headers', async () => {
    vi.spyOn(Api2, 'getTrusteeCases').mockResolvedValue({
      data: mockCases,
      pagination: noPagination,
    });
    renderComponent();
    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
    expect(screen.getByText('Case Number (Division)')).toBeInTheDocument();
    expect(screen.getByText('Case Title')).toBeInTheDocument();
    expect(screen.getByText('Chapter')).toBeInTheDocument();
    expect(screen.getByText('Case Filed')).toBeInTheDocument();
    expect(screen.getByText('Appt. Date')).toBeInTheDocument();
  });

  test('calls getTrusteeCases with correct trusteeId and default predicate on mount', async () => {
    const spy = vi.spyOn(Api2, 'getTrusteeCases').mockResolvedValue({
      data: [],
      pagination: {
        count: 0,
        totalCount: 0,
        currentPage: 1,
        totalPages: 0,
        limit: DEFAULT_SEARCH_LIMIT,
      },
    });
    renderComponent('trustee-abc');
    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith('trustee-abc', {
        limit: DEFAULT_SEARCH_LIMIT,
        offset: DEFAULT_SEARCH_OFFSET,
      });
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test('re-fetches with reset predicate when trusteeId prop changes', async () => {
    const spy = vi.spyOn(Api2, 'getTrusteeCases').mockResolvedValue({
      data: [],
      pagination: {
        count: 0,
        totalCount: 0,
        currentPage: 1,
        totalPages: 0,
        limit: DEFAULT_SEARCH_LIMIT,
      },
    });
    const { rerender } = renderComponent('trustee-aaa');
    await waitFor(() => expect(spy).toHaveBeenCalledWith('trustee-aaa', expect.anything()));

    spy.mockClear();
    rerender(
      <BrowserRouter>
        <TrusteeCaseList trusteeId="trustee-bbb" />
      </BrowserRouter>,
    );
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith('trustee-bbb', {
        limit: DEFAULT_SEARCH_LIMIT,
        offset: DEFAULT_SEARCH_OFFSET,
      }),
    );
  });

  test('does not show pagination when totalPages is 1', async () => {
    vi.spyOn(Api2, 'getTrusteeCases').mockResolvedValue({
      data: mockCases,
      pagination: noPagination,
    });
    renderComponent();
    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
  });

  test('shows pagination when totalPages is greater than 1', async () => {
    vi.spyOn(Api2, 'getTrusteeCases').mockResolvedValue({
      data: mockCases,
      pagination: withPagination,
    });
    renderComponent();
    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
    });
  });

  test('clicking next page triggers new API call with updated offset', async () => {
    const spy = vi.spyOn(Api2, 'getTrusteeCases').mockResolvedValue({
      data: mockCases,
      pagination: withPagination,
    });
    renderComponent();
    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
    });

    spy.mockClear();
    const nextButton = screen.getByTestId('pagination-button-next-results');
    await userEvent.click(nextButton);

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(
        'trustee-123',
        expect.objectContaining({ offset: DEFAULT_SEARCH_LIMIT }),
      );
    });
  });

  test('loading spinner announces loading state to screen readers', () => {
    vi.spyOn(Api2, 'getTrusteeCases').mockReturnValue(new Promise(() => {}));
    renderComponent();
    const spinner = screen.getByRole('status');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveTextContent('Loading case list...');
  });

  test('empty state is in a live region', async () => {
    vi.spyOn(Api2, 'getTrusteeCases').mockResolvedValue({
      data: [],
      pagination: { count: 0, totalCount: 0, currentPage: 1, totalPages: 0, limit: 25 },
    });
    renderComponent();
    await waitFor(() => {
      const region = screen.getByRole('status');
      expect(region).toBeInTheDocument();
      expect(region).toHaveTextContent('No case appointments found.');
    });
  });

  test('renders blank appt. date cell when appointedDate is undefined', async () => {
    const caseWithoutApptDate: TrusteeCaseListItem = {
      caseId: '081-24-00001',
      caseNumber: '24-00001',
      courtDivisionName: 'Buffalo',
      caseTitle: 'No Date Debtor',
      chapter: '7',
      dateFiled: '2024-01-01',
    };
    vi.spyOn(Api2, 'getTrusteeCases').mockResolvedValue({
      data: [caseWithoutApptDate],
      pagination: noPagination,
    });
    renderComponent();
    await screen.findByRole('table');
    const cells = screen.getAllByRole('cell');
    const apptDateCell = cells[cells.length - 1];
    expect(apptDateCell).toHaveTextContent('');
  });

  test('omits division label when courtDivisionName is empty', async () => {
    const caseNoDivision: TrusteeCaseListItem = {
      caseId: '081-24-00002',
      caseNumber: '24-00002',
      courtDivisionName: '',
      caseTitle: 'No Division Debtor',
      chapter: '13',
      dateFiled: '2024-02-01',
      appointedDate: '2024-02-05',
    };
    vi.spyOn(Api2, 'getTrusteeCases').mockResolvedValue({
      data: [caseNoDivision],
      pagination: noPagination,
    });
    renderComponent();
    await screen.findByRole('table');
    // No parenthesised division label should appear in the table body
    const cells = screen.getAllByRole('cell');
    cells.forEach((cell) => expect(cell).not.toHaveTextContent(/\(/));
  });

  test('resets to page 1 when trusteeId changes while on page 2', async () => {
    const spy = vi.spyOn(Api2, 'getTrusteeCases').mockResolvedValue({
      data: mockCases,
      pagination: withPagination,
    });
    const { rerender } = renderComponent('trustee-aaa');
    await screen.findByRole('navigation', { name: 'Pagination' });

    // navigate to page 2
    spy.mockClear();
    const nextButton = screen.getByTestId('pagination-button-next-results');
    await userEvent.click(nextButton);
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith(
        'trustee-aaa',
        expect.objectContaining({ offset: DEFAULT_SEARCH_LIMIT }),
      ),
    );

    // change trusteeId — should reset offset back to 0
    spy.mockClear();
    rerender(
      <BrowserRouter>
        <TrusteeCaseList trusteeId="trustee-bbb" />
      </BrowserRouter>,
    );
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith('trustee-bbb', {
        limit: DEFAULT_SEARCH_LIMIT,
        offset: DEFAULT_SEARCH_OFFSET,
      }),
    );
  });
});
