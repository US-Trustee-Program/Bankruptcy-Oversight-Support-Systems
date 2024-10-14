import { MockData } from '@common/cams/test-utilities/mock-data';
import { CaseBasics } from '@common/cams/cases';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import SearchScreen from '@/search/SearchScreen';
import { CasesSearchPredicate, DEFAULT_SEARCH_LIMIT } from '@common/api/search';
import Api2 from '@/lib/models/api2';
import testingUtilities from '@/lib/testing/testing-utilities';
import { MockInstance } from 'vitest';
import { ResponseBody } from '@common/api/response';

describe('search screen', () => {
  const caseList = [MockData.getCaseSummary(), MockData.getCaseSummary()];
  const searchResponseBody: ResponseBody<CaseBasics[]> = {
    meta: { self: 'self-url' },
    pagination: {
      count: caseList.length,
      currentPage: 1,
      limit: DEFAULT_SEARCH_LIMIT,
    },
    data: caseList,
  };
  const emptySearchResponseBody: ResponseBody<CaseBasics[]> = {
    meta: { self: 'self-url' },
    pagination: {
      count: 0,
      currentPage: 0,
      limit: DEFAULT_SEARCH_LIMIT,
    },
    data: [],
  };

  let searchCasesSpy: MockInstance;

  beforeEach(async () => {
    vi.stubEnv('CAMS_PA11Y', 'true');
    searchCasesSpy = vi.spyOn(Api2, 'searchCases').mockResolvedValue(searchResponseBody);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function renderWithoutProps() {
    render(
      <BrowserRouter>
        <SearchScreen></SearchScreen>
      </BrowserRouter>,
    );
  }

  test('should render a list of cases by chapter number', async () => {
    const divisionSearchPredicate = {
      limit: 25,
      offset: 0,
      chapters: expect.any(Array<string>),
    };

    renderWithoutProps();

    const searchButton = screen.getByTestId('button-search-submit');
    const loadingSpinner = document.querySelector('.loading-spinner');
    let defaultStateAlert = document.querySelector('#default-state-alert');
    expect(defaultStateAlert).toBeInTheDocument();
    expect(defaultStateAlert).toBeVisible();

    let table = document.querySelector('.search-results table');
    expect(table).not.toBeInTheDocument();
    const expandButton = screen.getByTestId('button-case-chapter-search-expand');

    // Make first search request...
    testingUtilities.selectComboBoxItem('case-chapter-search', 2);
    fireEvent.click(expandButton!);
    fireEvent.click(searchButton);

    await waitFor(() => {
      // wait for loading to appear and default state alert to be removed
      defaultStateAlert = document.querySelector('#default-state-alert');
      expect(defaultStateAlert).not.toBeInTheDocument();
      expect(document.querySelector('.loading-spinner')).toBeInTheDocument();
    });

    await waitFor(() => {
      // wait for loading to disappear
      expect(loadingSpinner).not.toBeInTheDocument();
      table = document.querySelector('.search-results table');
      expect(table).toBeVisible();
    });

    const rows = document.querySelectorAll('#search-results-table-body > tr');

    expect(rows).toHaveLength(caseList.length);
    expect(searchCasesSpy).toHaveBeenLastCalledWith(
      expect.objectContaining(divisionSearchPredicate),
    );

    // Make second search request...
    // testingUtilities.selectComboBoxItem('case-chapter-search', 3);
    // fireEvent.click(expandButton!);
    // fireEvent.click(searchButton);

    // await waitFor(() => {
    //   const listItemContainer = document.querySelector('#case-chapter-search-item-list-container');
    //   screen.debug(listItemContainer!);
    //   expect(document.querySelector('.loading-spinner')).toBeInTheDocument();
    //   table = document.querySelector('.search-results table');
    //   expect(table).not.toBeInTheDocument();
    // });

    // await waitFor(() => {
    //   // wait for loading to disappear
    //   expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
    //   table = document.querySelector('.search-results table');
    //   expect(table).toBeVisible();
    // });

    // expect(searchCasesSpy).toHaveBeenLastCalledWith(
    //   expect.objectContaining(divisionSearchPredicate),
    // );

    // clear division selection
    const pillButton = document.querySelector('#case-chapter-search .pill-clear-button');
    expect(pillButton).toBeInTheDocument();

    const pillBox = document.querySelector('#case-chapter-search-pill-box');
    expect(pillBox).toBeInTheDocument();
    expect(pillBox?.children.length).toBeGreaterThan(0);

    fireEvent.click(pillButton!);

    await waitFor(() => {
      expect(pillBox?.children.length).toEqual(0);
      expect(pillButton).not.toBeInTheDocument();
    });
  });

  test('should render a list of cases by court division', async () => {
    const divisionSearchPredicate = {
      limit: 25,
      offset: 0,
      divisionCodes: expect.any(Array<string>),
    };

    renderWithoutProps();

    const searchButton = screen.getByTestId('button-search-submit');
    const loadingSpinner = document.querySelector('.loading-spinner');
    const defaultStateAlert = document.querySelector('#default-state-alert');
    expect(defaultStateAlert).toBeInTheDocument();
    expect(defaultStateAlert).toBeVisible();

    let table = document.querySelector('.search-results table');
    expect(table).not.toBeInTheDocument();
    const expandButton = screen.getByTestId('button-court-selections-search-expand');

    await waitFor(() => {
      expect(expandButton).toBeInTheDocument();
      fireEvent.click(expandButton);
    });

    // Make first search request....
    await waitFor(() => {
      testingUtilities.selectComboBoxItem('court-selections-search');
    });

    fireEvent.click(expandButton);
    fireEvent.click(searchButton);

    await waitFor(() => {
      const expandedList = document.querySelector('.item-list-container .expanded');
      expect(expandedList).not.toBeInTheDocument();
    });

    await waitFor(() => {
      // wait for loading to appear and default state alert to be removed
      expect(defaultStateAlert).not.toBeVisible();
    });

    await waitFor(() => {
      // wait for loading to disappear
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
      table = document.querySelector('.search-results table');
      expect(table).toBeVisible();
    });

    const rows = document.querySelectorAll('#search-results-table-body > tr');
    expect(rows).toHaveLength(caseList.length);

    expect(searchCasesSpy).toHaveBeenLastCalledWith(
      expect.objectContaining(divisionSearchPredicate),
    );

    // Make second search request...
    await waitFor(() => {
      fireEvent.click(expandButton);
    });
    testingUtilities.selectComboBoxItem('court-selections-search', 1);

    fireEvent.click(expandButton);
    fireEvent.click(searchButton);

    await waitFor(() => {
      const expandedList = document.querySelector('.item-list-container .expanded');
      expect(expandedList).not.toBeInTheDocument();
    });

    await waitFor(() => {
      // wait for loading to disappear
      expect(loadingSpinner).not.toBeInTheDocument();
      table = document.querySelector('.search-results table');
      expect(table).toBeVisible();
    });

    expect(searchCasesSpy).toHaveBeenLastCalledWith(
      expect.objectContaining(divisionSearchPredicate),
    );

    // clear division selection
    const pillButton = document.querySelector('#court-selections-search .pill-clear-button');
    expect(pillButton).toBeInTheDocument();

    const pillBox = document.querySelector('#court-selections-search-pill-box');
    expect(pillBox).toBeInTheDocument();
    expect(pillBox?.children.length).toBeGreaterThan(0);

    fireEvent.click(pillButton!);

    await waitFor(() => {
      expect(pillBox?.children.length).toEqual(0);
      expect(pillButton).not.toBeInTheDocument();
    });
  });

  test('should render a list of cases by case number', async () => {
    const caseNumber = '00-11111';
    const casesSearchPredicate: CasesSearchPredicate = {
      caseNumber,
      limit: 25,
      offset: 0,
    };

    renderWithoutProps();

    let defaultStateAlert = document.querySelector('#default-state-alert');
    expect(defaultStateAlert).toBeInTheDocument();
    expect(defaultStateAlert).toBeVisible();

    const caseNumberInput = screen.getByTestId('basic-search-field');
    expect(caseNumberInput).toBeInTheDocument();
    expect(caseNumberInput).toBeEnabled();

    let table = document.querySelector('.search-results table');
    expect(table).not.toBeInTheDocument();

    fireEvent.change(caseNumberInput, { target: { value: '00-00000' } });
    const searchButton = screen.getByTestId('button-search-submit');
    fireEvent.click(searchButton);

    await waitFor(() => {
      // wait for loading to appear and default state alert to be removed
      defaultStateAlert = document.querySelector('#default-state-alert');
      expect(defaultStateAlert).not.toBeInTheDocument();
      expect(document.querySelector('.loading-spinner')).toBeInTheDocument();
    });

    await waitFor(() => {
      // wait for loading to disappear
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
      table = document.querySelector('.search-results table');
      expect(table).toBeVisible();
    });

    const rows = document.querySelectorAll('#search-results-table-body > tr');
    expect(rows).toHaveLength(caseList.length);

    fireEvent.change(caseNumberInput, { target: { value: caseNumber } });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).toBeInTheDocument();
      table = document.querySelector('.search-results table');
      expect(table).not.toBeInTheDocument();
    });

    expect(searchCasesSpy).toHaveBeenCalledWith(casesSearchPredicate);
  });

  test('should only search for full case number', async () => {
    const caseNumber = '';
    renderWithoutProps();

    let defaultStateAlert = document.querySelector('#default-state-alert');
    expect(defaultStateAlert).toBeInTheDocument();
    expect(defaultStateAlert).toBeVisible();

    const caseNumberInput = screen.getByTestId('basic-search-field');
    expect(caseNumberInput).toBeInTheDocument();
    expect(caseNumberInput).toBeEnabled();

    let table = document.querySelector('.search-results table');
    expect(table).not.toBeInTheDocument();

    fireEvent.change(caseNumberInput, { target: { value: '00-00000' } });
    const searchButton = screen.getByTestId('button-search-submit');
    fireEvent.click(searchButton);

    await waitFor(() => {
      // wait for loading to appear and default state alert to be removed
      defaultStateAlert = document.querySelector('#default-state-alert');
      expect(defaultStateAlert).not.toBeInTheDocument();
      expect(document.querySelector('.loading-spinner')).toBeInTheDocument();
    });

    await waitFor(() => {
      // wait for loading to disappear
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
      table = document.querySelector('.search-results table');
      expect(table).toBeVisible();
    });

    const rows = document.querySelectorAll('#search-results-table-body > tr');
    expect(rows).toHaveLength(caseList.length);

    fireEvent.change(caseNumberInput, { target: { value: caseNumber } });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
      table = document.querySelector('.search-results table');
      expect(table).not.toBeInTheDocument();
      expect(screen.getByTestId('alert-message-default-state-alert')).toBeInTheDocument();
    });

    expect(searchCasesSpy.mock.calls).toHaveLength(1);
  });

  test('should show the no results alert when no results are available', async () => {
    renderWithoutProps();

    vi.spyOn(Api2, 'searchCases').mockResolvedValueOnce(emptySearchResponseBody);

    const caseNumberInput = screen.getByTestId('basic-search-field');

    let table = document.querySelector('.search-results table');
    expect(table).not.toBeInTheDocument();

    let noResultsAlert = document.querySelector('#no-results-alert');
    expect(noResultsAlert).not.toBeInTheDocument();

    fireEvent.change(caseNumberInput, { target: { value: '00-00000' } });
    const searchButton = screen.getByTestId('button-search-submit');
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();

      table = document.querySelector('.search-results table');
      expect(table).not.toBeInTheDocument();

      noResultsAlert = document.querySelector('#no-results-alert');
      expect(noResultsAlert).toBeInTheDocument();
      expect(noResultsAlert).toBeVisible();
    });

    fireEvent.change(caseNumberInput, { target: { value: '00-11111' } });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).toBeInTheDocument();

      noResultsAlert = document.querySelector('#no-results-alert');
      expect(noResultsAlert).not.toBeInTheDocument();
    });
  });

  test('should show the error alert when an error is encountered', async () => {
    renderWithoutProps();

    vi.spyOn(Api2, 'searchCases')
      .mockRejectedValueOnce({
        message: 'some error',
      })
      .mockResolvedValue(searchResponseBody);

    const caseNumberInput = screen.getByTestId('basic-search-field');
    const searchButton = screen.getByTestId('button-search-submit');
    expect(document.querySelector('#search-error-alert')).not.toBeInTheDocument();

    fireEvent.change(caseNumberInput, { target: { value: '00-00000' } });

    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
      expect(document.querySelector('.search-results table')).not.toBeInTheDocument();

      const searchErrorAlert = document.querySelector('#search-error-alert');
      expect(searchErrorAlert).toBeInTheDocument();
      expect(searchErrorAlert).toBeVisible();
    });

    // TODO: We need to make sure the SearchResults.tsx can use the mock api to look this up.
    fireEvent.change(caseNumberInput, { target: { value: '00-11111' } });
    fireEvent.click(searchButton);
    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();

      const searchErrorAlert = document.querySelector('#search-error-alert');
      screen.debug(searchErrorAlert!);
      expect(searchErrorAlert).not.toBeInTheDocument();
      expect(document.querySelector('.search-results table')).toBeInTheDocument();
    });
  });

  test('should show an error alert if offices cannot be retrieved from API', async () => {
    vi.spyOn(Api2, 'getCourts')
      .mockRejectedValueOnce({
        message: 'some error',
      })
      .mockResolvedValue(emptySearchResponseBody);
    const globalAlertSpy = testingUtilities.spyOnGlobalAlert();

    renderWithoutProps();

    await waitFor(() => {
      expect(globalAlertSpy.error).toHaveBeenCalledWith('Cannot load office list');
    });
  });
});
