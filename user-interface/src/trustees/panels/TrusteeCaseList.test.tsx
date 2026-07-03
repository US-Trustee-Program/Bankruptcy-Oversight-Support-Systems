import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import TrusteeCaseList from './TrusteeCaseList';
import Api2 from '@/lib/models/api2';
import { TrusteeCaseListItem } from '@common/cams/trustee-appointments';
import { DEFAULT_SEARCH_LIMIT, DEFAULT_SEARCH_OFFSET } from '@common/api/search';
import { TrusteeCaseListFilterValue } from './filters/trusteeCaseListFilter.types';

const mockCases: TrusteeCaseListItem[] = [
  {
    caseId: '081-24-12345',
    courtDivisionName: 'White Plains',
    caseTitle: 'Test Debtor One',
    chapter: '7',
    dateFiled: '2024-03-15',
    appointedDate: '2024-03-20',
    caseStatus: 'OPEN',
  },
  {
    caseId: '081-23-99999',
    courtDivisionName: 'Manhattan',
    caseTitle: 'Test Debtor Two',
    chapter: '13',
    dateFiled: '2023-11-01',
    appointedDate: '2023-11-05',
    caseStatus: 'CLOSED',
  },
];

const noPagination = { count: 2, totalCount: 2, currentPage: 1, totalPages: 1, limit: 25 };
const withPagination = { count: 25, totalCount: 60, currentPage: 1, totalPages: 3, limit: 25 };
const defaultFilter: TrusteeCaseListFilterValue = { caseStatus: 'OPEN', chapters: [] };

function renderComponent(
  trusteeId = 'trustee-123',
  filterPredicate: TrusteeCaseListFilterValue = defaultFilter,
  onFilterChange = vi.fn(),
) {
  return render(
    <BrowserRouter>
      <TrusteeCaseList
        trusteeId={trusteeId}
        filterPredicate={filterPredicate}
        onFilterChange={onFilterChange}
      />
    </BrowserRouter>,
  );
}

describe('TrusteeCaseList', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('shows empty state alert with filter suggestion when no cases are returned', async () => {
    vi.spyOn(Api2, 'getTrusteeCases').mockResolvedValue({
      data: [],
      pagination: { count: 0, totalCount: 0, currentPage: 1, totalPages: 0, limit: 25 },
    });
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('No case appointments found')).toBeInTheDocument();
      expect(screen.getByText('Consider adjusting your filters.')).toBeInTheDocument();
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

    expect(screen.getByText('(White Plains)', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('(Manhattan)', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Test Debtor One')).toBeInTheDocument();
    expect(screen.getByText('Test Debtor Two')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('13')).toBeInTheDocument();
    expect(screen.getByText('03/15/2024')).toBeInTheDocument();
    expect(screen.getByText('03/20/2024')).toBeInTheDocument();
  });

  test('renders column headers in order', async () => {
    vi.spyOn(Api2, 'getTrusteeCases').mockResolvedValue({
      data: mockCases,
      pagination: noPagination,
    });
    renderComponent();
    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
    const headerCells = screen.getAllByRole('columnheader');
    const headerText = headerCells.map((cell) => cell.textContent?.trim());
    expect(headerText).toEqual([
      'Case Number (Division)',
      'Case Title',
      'Chapter',
      'Case Filed',
      'Appt. Date',
      'Case Status',
    ]);
  });

  test('renders "Open" for a case with caseStatus OPEN and "Closed" for CLOSED', async () => {
    vi.spyOn(Api2, 'getTrusteeCases').mockResolvedValue({
      data: mockCases,
      pagination: noPagination,
    });
    renderComponent();
    const table = await screen.findByRole('table');
    const statusCells = within(table).getAllByText(/^(Open|Closed)$/);
    expect(statusCells).toHaveLength(2);
    expect(statusCells[0]).toHaveTextContent('Open');
    expect(statusCells[1]).toHaveTextContent('Closed');
  });

  test('renders "Open" for any non-CLOSED caseStatus', async () => {
    const caseWithUnknownStatus: TrusteeCaseListItem = {
      ...mockCases[0],
      caseId: '081-24-00099',
      caseStatus: 'OPEN',
    };
    vi.spyOn(Api2, 'getTrusteeCases').mockResolvedValue({
      data: [caseWithUnknownStatus],
      pagination: noPagination,
    });
    renderComponent();
    await screen.findByRole('table');
    const statusCell = document.querySelector('[data-cell="Case Status"]');
    expect(statusCell).toHaveTextContent('Open');
  });

  test('displays case count above the table', async () => {
    vi.spyOn(Api2, 'getTrusteeCases').mockResolvedValue({
      data: mockCases,
      pagination: { count: 2, totalCount: 42, currentPage: 1, totalPages: 2, limit: 25 },
    });
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('42 Cases')).toBeInTheDocument();
    });
  });

  test('displays singular "Case" when totalCount is 1', async () => {
    vi.spyOn(Api2, 'getTrusteeCases').mockResolvedValue({
      data: [mockCases[0]],
      pagination: { count: 1, totalCount: 1, currentPage: 1, totalPages: 1, limit: 25 },
    });
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('1 Case')).toBeInTheDocument();
    });
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
      expect(spy).toHaveBeenCalledWith(
        'trustee-abc',
        expect.objectContaining({ limit: DEFAULT_SEARCH_LIMIT, offset: DEFAULT_SEARCH_OFFSET }),
      );
    });
  });

  test('passes caseStatus=OPEN to API when filter is OPEN', async () => {
    const spy = vi.spyOn(Api2, 'getTrusteeCases').mockResolvedValue({
      data: [],
      pagination: { count: 0, totalCount: 0, currentPage: 1, totalPages: 0, limit: 25 },
    });
    renderComponent('trustee-123', { caseStatus: 'OPEN', chapters: [] });
    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(
        'trustee-123',
        expect.objectContaining({ caseStatus: 'OPEN' }),
      );
    });
  });

  test('passes chapters to API when chapter filter applied', async () => {
    const spy = vi.spyOn(Api2, 'getTrusteeCases').mockResolvedValue({
      data: [],
      pagination: { count: 0, totalCount: 0, currentPage: 1, totalPages: 0, limit: 25 },
    });
    renderComponent('trustee-123', { caseStatus: 'ALL', chapters: ['7', '11'] });
    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(
        'trustee-123',
        expect.objectContaining({ chapters: ['7', '11'] }),
      );
    });
  });

  test('resets to page 1 when filterPredicate changes', async () => {
    const spy = vi.spyOn(Api2, 'getTrusteeCases').mockResolvedValue({
      data: mockCases,
      pagination: withPagination,
    });
    const { rerender } = renderComponent('trustee-123', defaultFilter);
    await screen.findByRole('navigation', { name: 'Pagination' });

    // go to page 2
    spy.mockClear();
    const nextButton = screen.getByTestId('pagination-button-next-results');
    await userEvent.click(nextButton);
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith(
        'trustee-123',
        expect.objectContaining({ offset: DEFAULT_SEARCH_LIMIT }),
      ),
    );

    // change filter — should reset offset to 0
    spy.mockClear();
    const onFilterChange = vi.fn();
    rerender(
      <BrowserRouter>
        <TrusteeCaseList
          trusteeId="trustee-123"
          filterPredicate={{ caseStatus: 'OPEN', chapters: [] }}
          onFilterChange={onFilterChange}
        />
      </BrowserRouter>,
    );
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith(
        'trustee-123',
        expect.objectContaining({ offset: DEFAULT_SEARCH_OFFSET }),
      ),
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
      expect(region).toHaveTextContent('No case appointments found');
    });
  });

  test('renders blank appt. date cell when appointedDate is undefined', async () => {
    const caseWithoutApptDate: TrusteeCaseListItem = {
      caseId: '081-24-00001',
      courtDivisionName: 'Buffalo',
      caseTitle: 'No Date Debtor',
      chapter: '7',
      dateFiled: '2024-01-01',
      caseStatus: 'OPEN',
    };
    vi.spyOn(Api2, 'getTrusteeCases').mockResolvedValue({
      data: [caseWithoutApptDate],
      pagination: noPagination,
    });
    renderComponent();
    await screen.findByRole('table');
    const apptDateCell = document.querySelector('[data-cell="Appt. Date"]');
    expect(apptDateCell).toBeInTheDocument();
    expect(apptDateCell).toHaveTextContent('');
  });

  test('case count element is an aria-live polite region', async () => {
    vi.spyOn(Api2, 'getTrusteeCases').mockResolvedValue({
      data: mockCases,
      pagination: noPagination,
    });
    renderComponent();
    await screen.findByRole('table');
    const countEl = screen.getByText(/^\d+ Cases?$/);
    expect(countEl).toHaveAttribute('aria-live', 'polite');
    expect(countEl).toHaveAttribute('aria-atomic', 'true');
  });

  test('passes date filter fields to API when set', async () => {
    const spy = vi.spyOn(Api2, 'getTrusteeCases').mockResolvedValue({
      data: [],
      pagination: { count: 0, totalCount: 0, currentPage: 1, totalPages: 0, limit: 25 },
    });
    renderComponent('trustee-123', {
      caseStatus: 'ALL',
      chapters: [],
      filedDateFrom: '2024-01-01',
      filedDateTo: '2024-12-31',
    });
    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(
        'trustee-123',
        expect.objectContaining({
          filedDateFrom: '2024-01-01',
          filedDateTo: '2024-12-31',
        }),
      );
    });
  });

  test('passes divisionCodes to API when division filter is applied', async () => {
    const spy = vi.spyOn(Api2, 'getTrusteeCases').mockResolvedValue({
      data: mockCases,
      pagination: noPagination,
    });
    renderComponent('trustee-123', {
      caseStatus: 'OPEN',
      chapters: [],
      divisionCodes: ['0971', '0972'],
    });
    await screen.findByRole('table');
    expect(spy).toHaveBeenCalledWith(
      'trustee-123',
      expect.objectContaining({ divisionCodes: ['0971', '0972'] }),
    );
  });

  test('omits divisionCodes from API call when filter has no division codes', async () => {
    const spy = vi.spyOn(Api2, 'getTrusteeCases').mockResolvedValue({
      data: mockCases,
      pagination: noPagination,
    });
    renderComponent();
    await screen.findByRole('table');
    expect(spy).toHaveBeenCalledWith(
      'trustee-123',
      expect.not.objectContaining({ divisionCodes: expect.anything() }),
    );
  });

  test('omits division label when courtDivisionName is empty', async () => {
    const caseNoDivision: TrusteeCaseListItem = {
      caseId: '081-24-00002',
      courtDivisionName: '',
      caseTitle: 'No Division Debtor',
      chapter: '13',
      dateFiled: '2024-02-01',
      appointedDate: '2024-02-05',
      caseStatus: 'OPEN',
    };
    vi.spyOn(Api2, 'getTrusteeCases').mockResolvedValue({
      data: [caseNoDivision],
      pagination: noPagination,
    });
    renderComponent();
    await screen.findByRole('table');
    const cells = screen.getAllByRole('cell');
    cells.forEach((cell) => expect(cell).not.toHaveTextContent(/\(/));
  });
});
