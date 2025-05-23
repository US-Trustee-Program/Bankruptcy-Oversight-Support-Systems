import { MockData } from '@common/cams/test-utilities/mock-data';
import { SyncedCase } from '@common/cams/cases';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import SearchScreen from '@/search/SearchScreen';
import { CasesSearchPredicate, DEFAULT_SEARCH_LIMIT } from '@common/api/search';
import testingUtilities from '@/lib/testing/testing-utilities';
import { MockInstance } from 'vitest';
import { ResponseBody } from '@common/api/response';
import Api2 from '@/lib/models/api2';
import userEvent from '@testing-library/user-event';
import LocalStorage from '@/lib/utils/local-storage';
import { UstpOfficeDetails } from '@common/cams/offices';
import { REGION_02_GROUP_NY } from '@common/cams/test-utilities/mock-user';
import { getCourtDivisionCodes } from '@common/cams/users';

describe('search screen', () => {
  const userOffices = [REGION_02_GROUP_NY];
  const user = MockData.getCamsUser({ offices: userOffices });
  const userDivisions = getCourtDivisionCodes(user);
  const session = MockData.getCamsSession({ user });
  const caseList = MockData.buildArray(MockData.getSyncedCase, 2);
  const searchResponseBody: ResponseBody<SyncedCase[]> = {
    meta: { self: 'self-url' },
    pagination: {
      count: caseList.length,
      currentPage: 1,
      limit: DEFAULT_SEARCH_LIMIT,
    },
    data: caseList,
  };
  const emptySearchResponseBody: ResponseBody<SyncedCase[]> = {
    meta: { self: 'self-url' },
    pagination: {
      count: 0,
      currentPage: 0,
      limit: DEFAULT_SEARCH_LIMIT,
    },
    data: [],
  };
  const includeAssignments = { includeAssignments: true };
  let searchCasesSpy: MockInstance;

  beforeEach(async () => {
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
    searchCasesSpy = vi.spyOn(Api2, 'searchCases').mockResolvedValue(searchResponseBody);
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
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

    await waitFor(() => {
      expect(document.querySelector('.search-results table')).not.toBeInTheDocument();
    });
    const expandButton = screen.getByTestId('button-case-chapter-search-expand');

    // Make first search request...
    await testingUtilities.toggleComboBoxItemSelection('case-chapter-search', 2);
    await userEvent.click(expandButton!);
    await userEvent.click(searchButton);

    await waitFor(() => {
      // wait for the default state alert to be removed
      expect(document.querySelector('#default-state-alert')).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(document.querySelector('.search-results table')).toBeInTheDocument();
    });

    const rows = document.querySelectorAll('#search-results-table-body > tr');

    expect(rows).toHaveLength(caseList.length);
    expect(searchCasesSpy).toHaveBeenLastCalledWith(
      expect.objectContaining(divisionSearchPredicate),
      includeAssignments,
    );

    await testingUtilities.toggleComboBoxItemSelection('case-chapter-search', 3);
    await userEvent.click(expandButton!);

    expect(document.querySelectorAll('#case-chapter-search-item-list li.selected')).toHaveLength(2);
    await userEvent.click(searchButton);

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
    });
    const table = document.querySelector('.search-results table');
    expect(table).toBeVisible();

    expect(searchCasesSpy).toHaveBeenLastCalledWith(
      expect.objectContaining(divisionSearchPredicate),
      includeAssignments,
    );

    const clearButton = document.querySelector('#case-chapter-search .clear-all-button');
    expect(clearButton).toBeInTheDocument();

    await userEvent.click(clearButton!);

    await waitFor(() => {
      expect(
        document.querySelector('#case-chapter-search-item-list li.selected'),
      ).not.toBeInTheDocument();
    });
  });

  test('should place default court divisions at the top of the combobox list', async () => {
    vi.spyOn(Api2, 'getCourts').mockResolvedValue({
      meta: {
        self: '',
      },
      data: MockData.getCourts(),
    });

    const courts = session.user.offices;
    const allDivisions = courts!.map((court: UstpOfficeDetails) => court.groups![0].divisions);
    const divisions = allDivisions.flat();
    const officeNames = divisions.map((division) => division.courtOffice.courtOfficeName).sort();

    renderWithoutProps();

    let comboBox;
    await waitFor(() => {
      comboBox = document.querySelector('#court-selections-search-item-list');
      expect(comboBox).toBeInTheDocument();
    });

    const options = comboBox!.querySelectorAll('li');
    expect(options![0]).toHaveTextContent(officeNames[0]);
    expect(options![1]).toHaveTextContent(officeNames[1]);
  });

  test('should render a list of cases by court division and clear selections', async () => {
    vi.spyOn(Api2, 'getCourts').mockResolvedValue({
      meta: {
        self: '',
      },
      data: MockData.getCourts(),
    });

    renderWithoutProps();

    const searchButton = screen.getByTestId('button-search-submit');
    await userEvent.click(searchButton);

    await waitFor(() => {
      expect(document.querySelector('.search-results table')).toBeInTheDocument();
    });

    const expandButton = screen.getByTestId('button-court-selections-search-expand');
    await waitFor(() => {
      expect(expandButton).toBeInTheDocument();
    });

    await userEvent.click(expandButton);

    // Make first search request....
    let itemToSelect = userDivisions.length + 1;
    await testingUtilities.toggleComboBoxItemSelection('court-selections-search', itemToSelect);

    await userEvent.click(expandButton);

    await waitFor(() => {
      const expandedList = document.querySelector('.item-list-container .expanded');
      expect(expandedList).not.toBeInTheDocument();
    });

    await userEvent.click(searchButton);

    await waitFor(() => {
      // wait for loading to disappear
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
      expect(document.querySelector('.search-results table')).toBeVisible();
    });

    const rows = document.querySelectorAll('#search-results-table-body > tr');
    expect(rows).toHaveLength(caseList.length);

    const divisionSearchPredicate = {
      limit: 25,
      offset: 0,
      divisionCodes: [...userDivisions],
    };

    expect(searchCasesSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        ...divisionSearchPredicate,
        divisionCodes: [...userDivisions, expect.any(String)],
      }),
      includeAssignments,
    );

    // Make second search request...
    await userEvent.click(expandButton);
    await testingUtilities.toggleComboBoxItemSelection('court-selections-search', ++itemToSelect);

    await userEvent.click(expandButton);

    await userEvent.click(searchButton);

    await waitFor(() => {
      const expandedList = document.querySelector('.item-list-container .expanded');
      expect(expandedList).not.toBeInTheDocument();
    });

    const loadingSpinner = document.querySelector('.loading-spinner');
    await waitFor(() => {
      // wait for loading to disappear
      expect(loadingSpinner).not.toBeInTheDocument();
      expect(document.querySelector('.search-results table')).toBeVisible();
    });

    expect(searchCasesSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        ...divisionSearchPredicate,
        divisionCodes: [...userDivisions, expect.any(String), expect.any(String)],
      }),
      includeAssignments,
    );

    // clear division selection
    const clearButton = document.querySelector('#court-selections-search .clear-all-button');
    expect(clearButton).toBeInTheDocument();

    await userEvent.click(clearButton!);

    await waitFor(() => {
      expect(
        document.querySelector('#case-chapter-search-item-list li.selected'),
      ).not.toBeInTheDocument();
    });
  });

  test('should render a list of cases by case number', async () => {
    const caseNumber = '00-11111';
    const casesSearchPredicate: CasesSearchPredicate = {
      caseNumber,
      limit: 25,
      divisionCodes: expect.anything(),
      offset: 0,
      excludeChildConsolidations: false,
      excludeClosedCases: true,
    };

    renderWithoutProps();

    // Clear the default search on initial render.
    searchCasesSpy.mockClear();

    const caseNumberInput = screen.getByTestId('basic-search-field');
    expect(caseNumberInput).toBeInTheDocument();

    await waitFor(() => {
      expect(caseNumberInput).toBeEnabled();
    });

    await userEvent.type(caseNumberInput, caseNumber);
    const searchButton = screen.getByTestId('button-search-submit');
    await userEvent.click(searchButton);

    await waitFor(() => {
      // wait for loading to disappear
      expect(document.querySelector('.search-results table')).toBeVisible();
    });

    const rows = document.querySelectorAll('#search-results-table-body > tr');
    expect(rows).toHaveLength(caseList.length);

    await userEvent.type(caseNumberInput, caseNumber);
    await userEvent.click(searchButton);

    await waitFor(() => {
      expect(document.querySelector('.search-results table')).toBeInTheDocument();
    });

    expect(searchCasesSpy).toHaveBeenCalledWith(casesSearchPredicate, includeAssignments);
  });

  test('should only search for full case number', async () => {
    const incompleteCaseNumber = '12123';
    renderWithoutProps();

    // Clear the default search on initial render.
    searchCasesSpy.mockClear();

    const caseNumberInput = screen.getByTestId('basic-search-field');
    expect(caseNumberInput).toBeInTheDocument();

    await waitFor(() => {
      expect(caseNumberInput).toBeEnabled();
    });

    await userEvent.type(caseNumberInput, '00-00000');
    const searchButton = screen.getByTestId('button-search-submit');
    await userEvent.click(searchButton);

    await waitFor(() => {
      expect(document.querySelector('.search-results table')).toBeVisible();
    });

    const rows = document.querySelectorAll('#search-results-table-body > tr');
    expect(rows).toHaveLength(caseList.length);

    await userEvent.type(caseNumberInput, incompleteCaseNumber);
    const numberOfCallsBefore = searchCasesSpy.mock.calls.length;
    await userEvent.click(searchButton);

    expect(searchCasesSpy.mock.calls).toHaveLength(numberOfCallsBefore);
  });

  test('should show the no results alert when no results are available', async () => {
    vi.spyOn(Api2, 'searchCases').mockResolvedValueOnce(emptySearchResponseBody);
    renderWithoutProps();

    let table = document.querySelector('.search-results table');
    expect(table).not.toBeInTheDocument();

    let searchButton = screen.getByTestId('button-search-submit');
    await userEvent.click(searchButton);

    let noResultsAlert = document.querySelector('#no-results-alert');

    await waitFor(() => {
      table = document.querySelector('.search-results table');
      expect(table).not.toBeInTheDocument();

      noResultsAlert = document.querySelector('#no-results-alert');
      expect(noResultsAlert).toBeInTheDocument();
      expect(noResultsAlert).toBeVisible();
    });

    const caseNumberInput: HTMLInputElement = screen.getByTestId('basic-search-field');
    await userEvent.type(caseNumberInput, '00-11111');
    await waitFor(() => {
      expect(caseNumberInput['value']).toEqual('00-11111');
    });
    searchButton = screen.getByTestId('button-search-submit');
    await userEvent.click(searchButton);

    await waitFor(() => {
      noResultsAlert = document.querySelector('#no-results-alert');
      expect(noResultsAlert).not.toBeInTheDocument();
    });
  });

  test('should show the error alert when an error is encountered', async () => {
    const caseNumber = '00-00000';
    vi.spyOn(Api2, 'searchCases').mockImplementation(
      (predicate: CasesSearchPredicate, _options?: unknown) => {
        if (predicate.caseNumber === caseNumber) {
          return Promise.reject({
            message: 'some error',
          });
        }
        return Promise.resolve(searchResponseBody);
      },
    );

    renderWithoutProps();

    const caseNumberInput: HTMLInputElement = screen.getByTestId('basic-search-field');
    const searchButton = screen.getByTestId('button-search-submit');
    expect(document.querySelector('#search-error-alert')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(caseNumberInput).toBeEnabled();
    });

    await userEvent.type(caseNumberInput, caseNumber);
    await waitFor(() => {
      expect(caseNumberInput['value']).toEqual(caseNumber);
    });

    await userEvent.click(searchButton);

    await waitFor(() => {
      expect(document.querySelector('.search-results table')).not.toBeInTheDocument();

      const searchErrorAlert = document.querySelector('#search-error-alert');
      expect(searchErrorAlert).toBeInTheDocument();
      expect(searchErrorAlert).toBeVisible();
    });

    // TODO: We need to make sure the SearchResults.tsx can use the mock api to look this up.
    await waitFor(() => {
      expect(caseNumberInput).toBeEnabled();
    });

    await userEvent.clear(caseNumberInput);
    await userEvent.type(caseNumberInput, '00-11111');
    await userEvent.click(searchButton);
    await waitFor(() => {
      const searchErrorAlert = document.querySelector('#search-error-alert');
      expect(searchErrorAlert).not.toBeInTheDocument();
    });
    expect(document.querySelector('.search-results table')).toBeInTheDocument();
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

  test('search button should be disabled until search criteria is entered', async () => {
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(
      MockData.getCamsSession({ user: MockData.getCamsUser({ offices: [] }) }),
    );

    renderWithoutProps();

    const searchButton = screen.getByTestId('button-search-submit');
    expect(searchButton).toBeDisabled();
  });

  test('should show an alert if the user does not have an assigned office', async () => {
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(
      MockData.getCamsSession({ user: MockData.getCamsUser({ offices: [] }) }),
    );

    renderWithoutProps();

    await waitFor(() => {
      expect(screen.getByTestId('alert-default-state-alert')).toBeInTheDocument();
    });
  });

  test('should update search predicate when Include Closed Cases checkbox is toggled', async () => {
    renderWithoutProps();
    const caseNumberInput = screen.getByTestId('basic-search-field');
    await userEvent.type(caseNumberInput, '1100000');

    const initialCheckbox = screen.getByTestId('checkbox-include-closed');
    expect(initialCheckbox).not.toBeChecked();

    // Click the checkbox label to include closed cases
    await userEvent.click(document.querySelector('#checkbox-include-closed-click-target')!);

    // Click search button to perform search
    const searchButton = screen.getByTestId('button-search-submit');
    await userEvent.click(searchButton);

    // Wait for search to complete
    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
    });

    // Now check if the checkbox is checked
    const checkedCheckbox = screen.getByTestId('checkbox-include-closed');
    expect(checkedCheckbox).toBeChecked();

    // Verify that search was called with excludeClosedCases set to false
    expect(searchCasesSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        excludeClosedCases: false,
      }),
      includeAssignments,
    );

    // Click the checkbox label again to exclude closed cases
    await userEvent.click(document.querySelector('#checkbox-include-closed-click-target')!);

    // Click search button to perform search
    await userEvent.click(searchButton);

    // Wait for search to complete
    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
    });

    // Now check if the checkbox is unchecked
    const uncheckedCheckbox = screen.getByTestId('checkbox-include-closed');
    expect(uncheckedCheckbox).not.toBeChecked();

    // Verify that search was called with excludeClosedCases set to true
    expect(searchCasesSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        excludeClosedCases: true,
      }),
      includeAssignments,
    );
  });
});
