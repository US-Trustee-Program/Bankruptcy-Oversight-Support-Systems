import MockData from '@common/cams/test-utilities/mock-data';
import { CasesPagination, ScoreBreakdown, SearchMetadata, SyncedCase } from '@common/cams/cases';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CasesSearchPredicate, DEFAULT_SEARCH_LIMIT } from '@common/api/search';
import SearchResults, { SearchResultsProps } from './SearchResults';
import { BrowserRouter } from 'react-router-dom';
import { SearchResultsHeader } from '@/search/SearchResultsHeader';
import { SearchResultsRow } from '@/search/SearchResultsRow';
import Api2 from '@/lib/models/api2';
import { CamsHttpError } from '@/lib/models/api';
import * as AppInsightsModule from '@/lib/hooks/UseApplicationInsights';

vi.mock('@microsoft/applicationinsights-react-js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@microsoft/applicationinsights-react-js')>();
  return {
    ...actual,
    useTrackEvent: () => vi.fn(),
  };
});

function makeSearchMetadata(overrides: Partial<SearchMetadata> = {}): SearchMetadata {
  const scoreBreakdown: ScoreBreakdown = {
    exactScore: 10000,
    nicknameScore: 0,
    phoneticScore: 100,
    charPrefixScore: 0,
    ...overrides.scoreBreakdown,
  };
  return {
    matchScore: 10100,
    primaryMatchType: 'exact',
    scoreBreakdown,
    ...overrides,
  };
}

describe('SearchResults component tests', () => {
  let caseList: SyncedCase[];
  const onStartSearchingSpy = vi.fn();
  const onEndSearchingSpy = vi.fn();

  beforeEach(async () => {
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
    caseList = MockData.buildArray(MockData.getSyncedCase, 60);
    vi.spyOn(Api2, 'searchCases').mockResolvedValue({
      meta: {
        self: 'self-link',
      },
      pagination: {
        currentPage: 1,
        limit: DEFAULT_SEARCH_LIMIT,
        count: caseList.length,
        next: 'next-link',
        totalPages: Math.ceil(caseList.length / DEFAULT_SEARCH_LIMIT),
      },
      data: caseList,
    });
  });

  function renderWithProps(props: Partial<SearchResultsProps> = {}) {
    const defaultProps: SearchResultsProps = {
      id: 'search-results',
      searchPredicate: {
        caseNumber: '00-11111',
        limit: 25,
        offset: 0,
      },
      onStartSearching: onStartSearchingSpy,
      onEndSearching: onEndSearchingSpy,
      header: SearchResultsHeader,
      row: SearchResultsRow,
    };
    render(
      <BrowserRouter>
        <SearchResults {...defaultProps} {...props}></SearchResults>{' '}
      </BrowserRouter>,
    );
  }

  function getCaseTable() {
    return document.querySelector('.search-results .cams-table');
  }

  test('should render a list of cases with a valid search predicate', async () => {
    const caseNumber = '00-11111';
    const searchPredicate: CasesSearchPredicate = {
      caseNumber,
      limit: 25,
      offset: 0,
    };

    renderWithProps({ searchPredicate });

    expect(getCaseTable()).not.toBeInTheDocument();

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
      expect(getCaseTable()).toBeVisible();
    });

    const rows = document.querySelectorAll('.search-results .cams-table__body .cams-table__row');
    expect(rows).toHaveLength(caseList.length);
  });

  test('should not show a table when no results are returned', async () => {
    vi.spyOn(Api2, 'searchCases').mockResolvedValue({
      meta: { self: 'self-link' },
      pagination: { currentPage: 0, limit: DEFAULT_SEARCH_LIMIT, count: 0 },
      data: [],
    });

    renderWithProps();

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
      expect(getCaseTable()).not.toBeInTheDocument();
    });
  });

  test('should call onResultsChanged with hasResults false when no results are returned', async () => {
    const onResultsChanged = vi.fn();
    vi.spyOn(Api2, 'searchCases').mockResolvedValue({
      meta: { self: 'self-link' },
      pagination: { currentPage: 0, limit: DEFAULT_SEARCH_LIMIT, count: 0 },
      data: [],
    });

    renderWithProps({ onResultsChanged });

    await waitFor(() => {
      expect(onResultsChanged).toHaveBeenCalledWith(false, undefined);
    });
  });

  test('should call onResultsChanged with hasResults true and closedCasesCount when results are returned', async () => {
    const onResultsChanged = vi.fn();
    vi.spyOn(Api2, 'searchCases').mockResolvedValue({
      meta: { self: 'self-link' },
      pagination: {
        currentPage: 1,
        limit: DEFAULT_SEARCH_LIMIT,
        count: caseList.length,
        closedCasesCount: 3,
      } as CasesPagination,
      data: caseList,
    });

    renderWithProps({ onResultsChanged });

    await waitFor(() => {
      expect(onResultsChanged).toHaveBeenCalledWith(true, 3);
    });
  });

  test('should call onSearchError when a non-timeout error is encountered', async () => {
    const onSearchError = vi.fn();
    vi.spyOn(Api2, 'searchCases').mockRejectedValue(new Error('SomeError'));

    renderWithProps({ onSearchError });

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
      expect(onSearchError).toHaveBeenCalledTimes(1);
    });
  });

  test('should call onSearchError with a CamsHttpError when a 504 error is encountered', async () => {
    const onSearchError = vi.fn();
    vi.spyOn(Api2, 'searchCases').mockRejectedValue(new CamsHttpError(504, 'Gateway Timeout'));

    renderWithProps({ onSearchError });

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
      expect(onSearchError).toHaveBeenCalledTimes(1);
      expect(onSearchError.mock.calls[0][0]).toBeInstanceOf(CamsHttpError);
    });
  });

  test('should render pagination', async () => {
    renderWithProps();

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).toBeInTheDocument();
    });

    await waitFor(() => {
      const pagination = document.querySelector('.usa-pagination');
      expect(pagination).toBeInTheDocument();
      expect(pagination).toBeVisible();
    });

    const nextPage = screen.getByTestId('pagination-button-next-results');
    fireEvent.click(nextPage);

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).toBeInTheDocument();
    });

    await waitFor(() => {
      const pagination = document.querySelector('.usa-pagination');
      expect(pagination).toBeInTheDocument();
      expect(pagination).toBeVisible();
    });
  });

  test('should not search for an invalid predicate', async () => {
    renderWithProps({
      searchPredicate: {
        limit: 25,
        offset: 0,
      },
    });

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
    });
  });

  test('renders Open/Closed column header when showOpenClosedColumn is true', async () => {
    renderWithProps({ showOpenClosedColumn: true });

    await waitFor(() => {
      expect(getCaseTable()).toBeInTheDocument();
    });

    expect(screen.getByTestId('header-open-closed')).toBeInTheDocument();
  });

  test('does not render Open/Closed column header when showOpenClosedColumn is false', async () => {
    renderWithProps({ showOpenClosedColumn: false });

    await waitFor(() => {
      expect(getCaseTable()).toBeInTheDocument();
    });

    expect(screen.queryByTestId('header-open-closed')).not.toBeInTheDocument();
  });

  describe('searchResultClick event tracking', () => {
    const debtorNamePredicate: CasesSearchPredicate = {
      debtorName: 'Smith',
      chapters: ['7'],
      offset: 0,
      limit: 25,
    };

    const mockTrackEvent = vi.fn();

    function setupCaseListWithMetadata(count: number): SyncedCase[] {
      return MockData.buildArray(
        () => MockData.getSyncedCase({ override: { searchMetadata: makeSearchMetadata() } }),
        count,
      );
    }

    beforeEach(() => {
      vi.restoreAllMocks();
      vi.spyOn(AppInsightsModule, 'getAppInsights').mockReturnValue({
        reactPlugin: {} as ReturnType<typeof AppInsightsModule.getAppInsights>['reactPlugin'],
        appInsights: { trackEvent: mockTrackEvent } as unknown as ReturnType<
          typeof AppInsightsModule.getAppInsights
        >['appInsights'],
      });
      mockTrackEvent.mockReset();
    });

    test('does not log searchResultClick when debtorName is absent', async () => {
      const casesWithMetadata = setupCaseListWithMetadata(3);
      vi.spyOn(Api2, 'searchCases').mockResolvedValue({
        meta: { self: 'self-link' },
        pagination: { currentPage: 1, limit: 25, count: 3 },
        data: casesWithMetadata,
      });

      renderWithProps({
        searchPredicate: { caseNumber: '00-11111', offset: 0, limit: 25 },
      });

      await waitFor(() => expect(getCaseTable()).toBeInTheDocument());

      const link = screen.getByTestId(`case-number-${casesWithMetadata[0].caseId}-link`);
      await userEvent.click(link);

      const clickEvents = mockTrackEvent.mock.calls.filter(
        (call) => call[0]?.name === 'searchResultClick',
      );
      expect(clickEvents).toHaveLength(0);
    });

    test('does not log searchResultClick when searchMetadata is absent', async () => {
      const casesWithoutMetadata = MockData.buildArray(MockData.getSyncedCase, 3);
      vi.spyOn(Api2, 'searchCases').mockResolvedValue({
        meta: { self: 'self-link' },
        pagination: { currentPage: 1, limit: 25, count: 3 },
        data: casesWithoutMetadata,
      });

      renderWithProps({ searchPredicate: debtorNamePredicate });

      await waitFor(() => expect(getCaseTable()).toBeInTheDocument());

      const link = screen.getByTestId(`case-number-${casesWithoutMetadata[0].caseId}-link`);
      await userEvent.click(link);

      const clickEvents = mockTrackEvent.mock.calls.filter(
        (call) => call[0]?.name === 'searchResultClick',
      );
      expect(clickEvents).toHaveLength(0);
    });

    test('logs searchResultClick with correct payload when clicking rank 3', async () => {
      const casesWithMetadata = setupCaseListWithMetadata(5);
      vi.spyOn(Api2, 'searchCases').mockResolvedValue({
        meta: { self: 'self-link' },
        pagination: { currentPage: 1, limit: 25, count: 5 },
        data: casesWithMetadata,
      });

      renderWithProps({ searchPredicate: debtorNamePredicate });

      await waitFor(() => expect(getCaseTable()).toBeInTheDocument());

      const link = screen.getByTestId(`case-number-${casesWithMetadata[2].caseId}-link`);
      await userEvent.click(link); // rank 3

      const clickCall = mockTrackEvent.mock.calls.find(
        (call) => call[0]?.name === 'searchResultClick',
      );
      expect(clickCall).toBeDefined();
      const [event] = clickCall!;
      expect(event.name).toBe('searchResultClick');
      expect(event.measurements?.rank).toBe(3);
      expect(event.measurements?.matchScore).toBe(10100);
      expect(event.properties?.primaryMatchType).toBe('exact');
      expect(JSON.parse(event.properties?.chapters)).toEqual(['7']);
      expect(event.properties?.excludeClosedCases).toBeUndefined();

      const higherRanked = JSON.parse(event.properties?.higherRankedResults);
      expect(higherRanked).toHaveLength(2);
      expect(higherRanked[0].rank).toBe(1);
      expect(higherRanked[1].rank).toBe(2);
    });

    test('logs empty higherRankedResults when clicking rank 1', async () => {
      const casesWithMetadata = setupCaseListWithMetadata(3);
      vi.spyOn(Api2, 'searchCases').mockResolvedValue({
        meta: { self: 'self-link' },
        pagination: { currentPage: 1, limit: 25, count: 3 },
        data: casesWithMetadata,
      });

      renderWithProps({ searchPredicate: debtorNamePredicate });

      await waitFor(() => expect(getCaseTable()).toBeInTheDocument());

      const link = screen.getByTestId(`case-number-${casesWithMetadata[0].caseId}-link`);
      await userEvent.click(link); // rank 1

      const clickCall = mockTrackEvent.mock.calls.find(
        (call) => call[0]?.name === 'searchResultClick',
      );
      expect(clickCall).toBeDefined();
      expect(JSON.parse(clickCall![0].properties?.higherRankedResults)).toEqual([]);
    });

    test('caps higherRankedResults at 5 when clicking rank 8', async () => {
      const casesWithMetadata = setupCaseListWithMetadata(10);
      vi.spyOn(Api2, 'searchCases').mockResolvedValue({
        meta: { self: 'self-link' },
        pagination: { currentPage: 1, limit: 25, count: 10 },
        data: casesWithMetadata,
      });

      renderWithProps({ searchPredicate: debtorNamePredicate });

      await waitFor(() => expect(getCaseTable()).toBeInTheDocument());

      const link = screen.getByTestId(`case-number-${casesWithMetadata[7].caseId}-link`);
      await userEvent.click(link); // rank 8

      const clickCall = mockTrackEvent.mock.calls.find(
        (call) => call[0]?.name === 'searchResultClick',
      );
      expect(clickCall).toBeDefined();
      const higherRanked = JSON.parse(clickCall![0].properties?.higherRankedResults);
      expect(higherRanked).toHaveLength(5);
    });
  });
});
