import MockData from '@common/cams/test-utilities/mock-data';
import { SyncedCase } from '@common/cams/cases';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { CourtDivisionDetails } from '@common/cams/courts';
import SearchScreen, { validateFormData } from '@/search/SearchScreen';
import { CasesSearchPredicate, DEFAULT_SEARCH_LIMIT } from '@common/api/search';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';
import { MockInstance } from 'vitest';
import { ResponseBody } from '@common/api/response';
import Api2 from '@/lib/models/api2';
import LocalStorage from '@/lib/utils/local-storage';
import { UstpOfficeDetails } from '@common/cams/offices';
import { REGION_02_GROUP_NY } from '@common/cams/test-utilities/mock-user';
import { getCourtDivisionCodes } from '@common/cams/users';
import * as UseFeatureFlagsModule from '@/lib/hooks/UseFeatureFlags';

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
  let userEvent: CamsUserEvent;

  beforeEach(async () => {
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
    searchCasesSpy = vi.spyOn(Api2, 'searchCases').mockResolvedValue(searchResponseBody);
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
    userEvent = TestingUtilities.setupUserEvent();
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
    await TestingUtilities.toggleComboBoxItemSelection('case-chapter-search', 2);
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

    await TestingUtilities.toggleComboBoxItemSelection('case-chapter-search', 3);
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
    await TestingUtilities.toggleComboBoxItemSelection('court-selections-search', itemToSelect);

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
    await TestingUtilities.toggleComboBoxItemSelection('court-selections-search', ++itemToSelect);

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
      excludeMemberConsolidations: false,
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
      .mockResolvedValue({
        meta: { self: 'self-url' },
        pagination: {
          count: 0,
          currentPage: 0,
          limit: DEFAULT_SEARCH_LIMIT,
        },
        data: [],
      } as unknown as ResponseBody<CourtDivisionDetails[]>);
    const globalAlertSpy = TestingUtilities.spyOnGlobalAlert();

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
    await TestingUtilities.waitForDocumentBody();

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

  test('should trigger search when Enter key is pressed in case number field', async () => {
    const caseNumber = '00-11111';

    renderWithoutProps();

    // Clear the default search on initial render.
    searchCasesSpy.mockClear();

    const caseNumberInput = screen.getByTestId('basic-search-field');
    expect(caseNumberInput).toBeInTheDocument();

    await waitFor(() => {
      expect(caseNumberInput).toBeEnabled();
    });

    // Type case number
    await userEvent.type(caseNumberInput, caseNumber);

    // Trigger form submission (simulating Enter key press which submits the form)
    const form = screen.getByTestId('filter-and-search-panel');
    fireEvent.submit(form);

    await waitFor(() => {
      // wait for loading to disappear
      expect(document.querySelector('.search-results table')).toBeVisible();
    });

    const rows = document.querySelectorAll('#search-results-table-body > tr');
    expect(rows).toHaveLength(caseList.length);

    // Verify that search was called with correct predicate including case number
    expect(searchCasesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        caseNumber,
        excludeMemberConsolidations: false,
        excludeClosedCases: true,
      }),
      includeAssignments,
    );
  });

  test('should trigger search when Enter key is pressed after selecting chapter', async () => {
    renderWithoutProps();

    await waitFor(() => {
      expect(document.querySelector('.search-results table')).not.toBeInTheDocument();
    });

    // Select a chapter
    await TestingUtilities.toggleComboBoxItemSelection('case-chapter-search', 2);

    const expandButton = screen.getByTestId('button-case-chapter-search-expand');
    await userEvent.click(expandButton!);

    // Get the filter-and-search form
    const filterAndSearchPanel = screen.getByTestId('filter-and-search-panel');
    expect(filterAndSearchPanel).toBeInTheDocument();

    // Trigger form submission (simulating Enter key press which submits the form)
    fireEvent.submit(filterAndSearchPanel);

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
      expect.objectContaining({
        chapters: expect.any(Array<string>),
      }),
      includeAssignments,
    );
  });

  test('should not trigger search when Enter key is pressed with invalid search criteria', async () => {
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(
      MockData.getCamsSession({ user: MockData.getCamsUser({ offices: [] }) }),
    );

    renderWithoutProps();
    await TestingUtilities.waitForDocumentBody();

    // Clear the default search on initial render.
    searchCasesSpy.mockClear();

    const caseNumberInput = screen.getByTestId('basic-search-field');

    await waitFor(() => {
      expect(caseNumberInput).toBeEnabled();
    });

    // Type incomplete case number and press Enter
    await userEvent.type(caseNumberInput, '12345');
    await userEvent.keyboard('{Enter}');

    // Wait for any potential async updates to settle
    await waitFor(
      () => {
        expect(searchCasesSpy).not.toHaveBeenCalled();
      },
      { timeout: 100 },
    );
  });

  test('should trigger search multiple times when Enter key is pressed with different case numbers', async () => {
    const firstCaseNumber = '00-11111';
    const secondCaseNumber = '00-22222';

    renderWithoutProps();

    // Clear the default search on initial render.
    searchCasesSpy.mockClear();

    const caseNumberInput = screen.getByTestId('basic-search-field');

    await waitFor(() => {
      expect(caseNumberInput).toBeEnabled();
    });

    // First search - type case number and submit form
    await userEvent.type(caseNumberInput, firstCaseNumber);
    const form = screen.getByTestId('filter-and-search-panel');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(document.querySelector('.search-results table')).toBeVisible();
    });

    // Verify first search was called
    expect(searchCasesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        caseNumber: firstCaseNumber,
      }),
      includeAssignments,
    );

    const firstCallCount = searchCasesSpy.mock.calls.length;

    // Clear the input and type a new case number
    await userEvent.clear(caseNumberInput);
    await userEvent.type(caseNumberInput, secondCaseNumber);
    fireEvent.submit(form);

    // Wait for the search to be triggered and complete
    await waitFor(() => {
      expect(searchCasesSpy.mock.calls.length).toBeGreaterThan(firstCallCount);
    });

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
    });

    // Verify second search was called with correct parameters
    expect(searchCasesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        caseNumber: secondCaseNumber,
      }),
      includeAssignments,
    );
  });

  test('should show error when invalid case number is entered', async () => {
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(
      MockData.getCamsSession({ user: MockData.getCamsUser({ offices: [] }) }),
    );

    renderWithoutProps();
    await TestingUtilities.waitForDocumentBody();

    const caseNumberInput = screen.getByTestId('basic-search-field');

    await waitFor(() => {
      expect(caseNumberInput).toBeEnabled();
    });

    // Type invalid case number
    await userEvent.type(caseNumberInput, '55');

    // Wait for debounced validation to run
    await waitFor(
      () => {
        const errorMessage = screen.queryByText(/Must be 7 digits/i);
        expect(errorMessage).toBeInTheDocument();
      },
      { timeout: 1000 },
    );

    // Search button should be disabled
    const searchButton = screen.getByTestId('button-search-submit');
    expect(searchButton).toBeDisabled();
  });

  test('should clear error when valid case number is entered after invalid one', async () => {
    renderWithoutProps();

    // Clear the default search on initial render
    searchCasesSpy.mockClear();

    const caseNumberInput = screen.getByTestId('basic-search-field');

    await waitFor(() => {
      expect(caseNumberInput).toBeEnabled();
    });

    // Type invalid case number
    await userEvent.type(caseNumberInput, '55');

    // Wait for error to appear
    await waitFor(
      () => {
        const errorMessage = screen.queryByText(/Must be 7 digits/i);
        expect(errorMessage).toBeInTheDocument();
      },
      { timeout: 1000 },
    );

    // Clear and type valid case number
    await userEvent.clear(caseNumberInput);
    await userEvent.type(caseNumberInput, '12-34567');

    // Wait for error to clear
    await waitFor(
      () => {
        const errorMessage = screen.queryByText(/Must be 7 digits/i);
        expect(errorMessage).not.toBeInTheDocument();
      },
      { timeout: 1000 },
    );

    // Search button should be enabled (because we have a valid case number AND default division codes)
    const searchButton = screen.getByTestId('button-search-submit');
    expect(searchButton).not.toBeDisabled();
  });

  test('should show form validation error when trying to search with no criteria', async () => {
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(
      MockData.getCamsSession({ user: MockData.getCamsUser({ offices: [] }) }),
    );

    renderWithoutProps();
    await TestingUtilities.waitForDocumentBody();

    const searchButton = screen.getByTestId('button-search-submit');

    // Try to click search button (it should be disabled)
    expect(searchButton).toBeDisabled();

    // The button being disabled prevents the click, but let's verify the state
    // by checking that no search was triggered
    expect(searchCasesSpy).not.toHaveBeenCalled();
  });

  test('should not show form validation error when at least one criterion is selected', async () => {
    renderWithoutProps();

    const searchButton = screen.getByTestId('button-search-submit');

    await waitFor(() => {
      expect(searchButton).not.toBeDisabled();
    });

    // No validation error alert should be visible
    const validationAlert = screen.queryByTestId('search-validation-alert');
    expect(validationAlert).not.toBeInTheDocument();
  });
});

describe('validateFormData function', () => {
  test('should return valid for valid case number', () => {
    const result = validateFormData({ caseNumber: '12-34567' });
    expect(result.isValid).toBe(true);
    expect(result.fieldErrors.caseNumber).toBeUndefined();
  });

  test('should return error for invalid case number format via raw input', () => {
    const result = validateFormData({ caseNumber: '12345' });
    expect(result.isValid).toBe(false);
    expect(result.fieldErrors.caseNumber?.reasons).toBeDefined();
    expect(result.fieldErrors.caseNumber?.reasons).toEqual(['Must be 7 digits']);
  });

  test('should return valid for undefined case number when other criteria provided', () => {
    const result = validateFormData({ divisionCodes: ['081'] });
    expect(result.isValid).toBe(true);
    expect(result.fieldErrors.caseNumber).toBeUndefined();
  });

  test('should return valid for undefined case number when chapter criteria provided', () => {
    const result = validateFormData({ caseNumber: undefined, chapters: ['11'] });
    expect(result.isValid).toBe(true);
    expect(result.fieldErrors.caseNumber).toBeUndefined();
  });

  test('should return form validation error when no search criteria provided', () => {
    const result = validateFormData({});
    expect(result.isValid).toBe(false);
    expect(result.formValidationError).toBe('Please enter at least one search criterion');
  });

  test('should handle raw input with valid case number', () => {
    const result = validateFormData({ caseNumber: '12-34567' });
    expect(result.isValid).toBe(true);
    expect(result.fieldErrors.caseNumber).toBeUndefined();
  });
});

describe('debtor name search', () => {
  const userOffices = [REGION_02_GROUP_NY];
  const user = MockData.getCamsUser({ offices: userOffices });
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
  const includeAssignments = { includeAssignments: true };
  let searchCasesSpy: MockInstance;
  let userEvent: CamsUserEvent;

  beforeEach(async () => {
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
    searchCasesSpy = vi.spyOn(Api2, 'searchCases').mockResolvedValue(searchResponseBody);
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
    userEvent = TestingUtilities.setupUserEvent();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function renderWithFeatureFlag(enabled: boolean) {
    vi.spyOn(UseFeatureFlagsModule, 'default').mockReturnValue({
      'phonetic-search-enabled': enabled,
      'chapter-twelve-enabled': true,
      'chapter-eleven-enabled': true,
      'transfer-orders-enabled': true,
      'consolidations-enabled': true,
    });
    render(
      <BrowserRouter>
        <SearchScreen></SearchScreen>
      </BrowserRouter>,
    );
  }

  test('should show debtor name field when phonetic search feature is enabled', async () => {
    renderWithFeatureFlag(true);

    await waitFor(() => {
      const debtorNameInput = screen.queryByLabelText(/debtor name/i);
      expect(debtorNameInput).toBeInTheDocument();
    });
  });

  test('should hide debtor name field when phonetic search feature is disabled', async () => {
    renderWithFeatureFlag(false);

    await waitFor(() => {
      const debtorNameInput = screen.queryByLabelText(/debtor name/i);
      expect(debtorNameInput).not.toBeInTheDocument();
    });
  });

  test('should search by debtor name when feature is enabled', async () => {
    renderWithFeatureFlag(true);

    // Clear the default search on initial render
    searchCasesSpy.mockClear();

    const debtorNameInput = await screen.findByLabelText(/debtor name/i);
    expect(debtorNameInput).toBeInTheDocument();

    await waitFor(() => {
      expect(debtorNameInput).toBeEnabled();
    });

    const debtorName = 'John Smith';
    await userEvent.type(debtorNameInput, debtorName);

    const searchButton = screen.getByTestId('button-search-submit');
    await userEvent.click(searchButton);

    await waitFor(() => {
      expect(document.querySelector('.search-results table')).toBeVisible();
    });

    expect(searchCasesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        debtorName,
        excludeMemberConsolidations: false,
        excludeClosedCases: true,
      }),
      includeAssignments,
    );
  });

  test('should allow searching with both debtor name and case number', async () => {
    renderWithFeatureFlag(true);

    // Clear the default search on initial render
    searchCasesSpy.mockClear();

    const debtorNameInput = await screen.findByLabelText(/debtor name/i);
    const caseNumberInput = screen.getByTestId('basic-search-field');

    await waitFor(() => {
      expect(debtorNameInput).toBeEnabled();
      expect(caseNumberInput).toBeEnabled();
    });

    const debtorName = 'Jane Doe';
    const caseNumber = '00-12345';

    await userEvent.type(debtorNameInput, debtorName);
    await userEvent.type(caseNumberInput, caseNumber);

    const searchButton = screen.getByTestId('button-search-submit');
    await userEvent.click(searchButton);

    await waitFor(() => {
      expect(document.querySelector('.search-results table')).toBeVisible();
    });

    expect(searchCasesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        debtorName,
        caseNumber,
      }),
      includeAssignments,
    );
  });

  test('should allow searching by debtor name and chapter', async () => {
    renderWithFeatureFlag(true);

    // Clear the default search on initial render
    searchCasesSpy.mockClear();

    const debtorNameInput = await screen.findByLabelText(/debtor name/i);
    await waitFor(() => {
      expect(debtorNameInput).toBeEnabled();
    });

    await userEvent.type(debtorNameInput, 'Michael Johnson');

    // Select a chapter
    await TestingUtilities.toggleComboBoxItemSelection('case-chapter-search', 2);
    const expandButton = screen.getByTestId('button-case-chapter-search-expand');
    await userEvent.click(expandButton);

    const searchButton = screen.getByTestId('button-search-submit');
    await userEvent.click(searchButton);

    await waitFor(() => {
      expect(document.querySelector('.search-results table')).toBeVisible();
    });

    expect(searchCasesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        debtorName: 'Michael Johnson',
        chapters: expect.any(Array<string>),
      }),
      includeAssignments,
    );
  });

  test('should trigger search when Enter key is pressed in debtor name field', async () => {
    renderWithFeatureFlag(true);

    // Clear the default search on initial render
    searchCasesSpy.mockClear();

    const debtorNameInput = await screen.findByLabelText(/debtor name/i);
    await waitFor(() => {
      expect(debtorNameInput).toBeEnabled();
    });

    const debtorName = 'Sarah Connor';
    await userEvent.type(debtorNameInput, debtorName);

    // Trigger form submission
    const form = screen.getByTestId('filter-and-search-panel');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(document.querySelector('.search-results table')).toBeVisible();
    });

    expect(searchCasesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        debtorName,
      }),
      includeAssignments,
    );
  });

  test('should clear debtor name when search is cleared', async () => {
    renderWithFeatureFlag(true);

    const debtorNameInput = await screen.findByLabelText(/debtor name/i);
    await userEvent.type(debtorNameInput, 'Test Name');

    await waitFor(() => {
      expect((debtorNameInput as HTMLInputElement).value).toBe('Test Name');
    });

    // Clear the input
    await userEvent.clear(debtorNameInput);

    await waitFor(() => {
      expect((debtorNameInput as HTMLInputElement).value).toBe('');
    });
  });

  test('should preserve single character input while typing', async () => {
    renderWithFeatureFlag(true);

    const debtorNameInput = await screen.findByLabelText(/debtor name/i);

    // Type single character
    await userEvent.type(debtorNameInput, 'J');

    // Single character should be visible in the input
    await waitFor(() => {
      expect((debtorNameInput as HTMLInputElement).value).toBe('J');
    });

    // Type second character
    await userEvent.type(debtorNameInput, 'o');

    // Both characters should be visible
    await waitFor(() => {
      expect((debtorNameInput as HTMLInputElement).value).toBe('Jo');
    });

    // Continue typing
    await userEvent.type(debtorNameInput, 'hn');

    // Full name should be visible
    await waitFor(() => {
      expect((debtorNameInput as HTMLInputElement).value).toBe('John');
    });
  });

  test('should validate debtor name has at least 2 characters', async () => {
    renderWithFeatureFlag(true);

    const debtorNameInput = await screen.findByLabelText(/debtor name/i);

    // Type single character
    await userEvent.type(debtorNameInput, 'J');

    // Verify input shows the character
    await waitFor(() => {
      expect((debtorNameInput as HTMLInputElement).value).toBe('J');
    });

    // Verify validation state recognizes this as invalid
    const formData = { debtorName: 'J' };
    const validation = validateFormData(formData);
    expect(validation.isValid).toBe(false);
    expect(validation.fieldErrors.debtorName).toBeDefined();
  });

  test('should accept debtor name with 2+ characters', async () => {
    renderWithFeatureFlag(true);

    const debtorNameInput = await screen.findByLabelText(/debtor name/i);

    // Type 2 characters
    await userEvent.type(debtorNameInput, 'Jo');

    // Verify validation state recognizes this as valid
    const formData = { debtorName: 'Jo' };
    const validation = validateFormData(formData);
    expect(validation.isValid).toBe(true);
    expect(validation.fieldErrors.debtorName).toBeUndefined();
  });

  test('should reject empty string after whitespace trim', async () => {
    // Debtor name with only spaces should be treated as empty (valid, but not a search criterion)
    const formData = { debtorName: '   ' };
    const validation = validateFormData(formData);

    // This should fail the "at least one criterion" check
    expect(validation.isValid).toBe(false);
    expect(validation.formValidationError).toBe('Please enter at least one search criterion');
  });
});
