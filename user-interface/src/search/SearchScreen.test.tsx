import MockData from '@common/cams/test-utilities/mock-data';
import { CasesPagination, SyncedCase } from '@common/cams/cases';
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
import * as courtUtils from '@/lib/utils/court-utils';
import * as UseLandingPageAnalyticsModule from '@/lib/hooks/UseLandingPageAnalytics';

const getResultsTable = () => document.querySelector('.search-results .cams-table');
const getResultRows = () =>
  document.querySelectorAll('.search-results .cams-table__body .cams-table__row');
const getSearchButton = () => screen.getByTestId('button-search-submit');
const getCaseNumberInput = (): HTMLInputElement =>
  screen.getByTestId('basic-search-field') as HTMLInputElement;

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

    const searchButton = getSearchButton();

    await waitFor(() => {
      expect(getResultsTable()).not.toBeInTheDocument();
    });
    const expandButton = screen.getByTestId('button-case-chapter-search-expand');

    await TestingUtilities.toggleComboBoxItemSelection('case-chapter-search', 2);
    await userEvent.click(expandButton!);
    await userEvent.click(searchButton);

    await waitFor(() => {
      expect(document.querySelector('#default-state-alert')).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(getResultsTable()).toBeInTheDocument();
    });

    const rows = getResultRows();

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
    const table = getResultsTable();
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

  test('should call sortByCourtLocation when loading courts', async () => {
    const sortSpy = vi.spyOn(courtUtils, 'sortByCourtLocation');

    renderWithoutProps();

    await waitFor(() => {
      expect(sortSpy).toHaveBeenCalled();
    });

    // Verify it was called with court data
    const callArgs = sortSpy.mock.calls[0];
    expect(callArgs[0]).toBeInstanceOf(Array);
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

    const searchButton = getSearchButton();
    await userEvent.click(searchButton);

    await waitFor(() => {
      expect(getResultsTable()).toBeInTheDocument();
    });

    const expandButton = screen.getByTestId('button-court-selections-search-expand');
    await waitFor(() => {
      expect(expandButton).toBeInTheDocument();
    });

    await userEvent.click(expandButton);

    let itemToSelect = userDivisions.length + 1;
    await TestingUtilities.toggleComboBoxItemSelection('court-selections-search', itemToSelect);

    await userEvent.click(expandButton);

    await waitFor(() => {
      const expandedList = document.querySelector('.item-list-container .expanded');
      expect(expandedList).not.toBeInTheDocument();
    });

    await userEvent.click(searchButton);

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
      expect(getResultsTable()).toBeVisible();
    });

    const rows = getResultRows();
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
      expect(loadingSpinner).not.toBeInTheDocument();
      expect(getResultsTable()).toBeVisible();
    });

    expect(searchCasesSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        ...divisionSearchPredicate,
        divisionCodes: [...userDivisions, expect.any(String), expect.any(String)],
      }),
      includeAssignments,
    );

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
      offset: 0,
      excludeMemberConsolidations: false,
      excludeClosedCases: true,
    };

    renderWithoutProps();

    searchCasesSpy.mockClear();

    const caseNumberInput = getCaseNumberInput();
    expect(caseNumberInput).toBeInTheDocument();

    await waitFor(() => {
      expect(caseNumberInput).toBeEnabled();
    });

    await userEvent.type(caseNumberInput, caseNumber);
    const searchButton = getSearchButton();
    await userEvent.click(searchButton);

    await waitFor(() => {
      expect(getResultsTable()).toBeVisible();
    });

    const rows = getResultRows();
    expect(rows).toHaveLength(caseList.length);

    await userEvent.type(caseNumberInput, caseNumber);
    await userEvent.click(searchButton);

    await waitFor(() => {
      expect(getResultsTable()).toBeInTheDocument();
    });

    expect(searchCasesSpy).toHaveBeenCalledWith(casesSearchPredicate, includeAssignments);
  });

  test('should only search for full case number', async () => {
    const incompleteCaseNumber = '12123';
    renderWithoutProps();

    searchCasesSpy.mockClear();

    const caseNumberInput = getCaseNumberInput();
    expect(caseNumberInput).toBeInTheDocument();

    await waitFor(() => {
      expect(caseNumberInput).toBeEnabled();
    });

    await userEvent.type(caseNumberInput, '00-00000');
    const searchButton = getSearchButton();
    await userEvent.click(searchButton);

    await waitFor(() => {
      expect(getResultsTable()).toBeVisible();
    });

    const rows = getResultRows();
    expect(rows).toHaveLength(caseList.length);

    await userEvent.type(caseNumberInput, incompleteCaseNumber);
    const numberOfCallsBefore = searchCasesSpy.mock.calls.length;
    await userEvent.click(searchButton);

    expect(searchCasesSpy.mock.calls).toHaveLength(numberOfCallsBefore);
  });

  test('should show the no results alert when no results are available', async () => {
    const emptySpy = vi.spyOn(Api2, 'searchCases').mockResolvedValue(emptySearchResponseBody);
    vi.spyOn(Api2, 'getCourts').mockResolvedValue({
      meta: { self: '' },
      data: MockData.getCourts(),
    });
    renderWithoutProps();

    let table = getResultsTable();
    expect(table).not.toBeInTheDocument();

    let searchButton = getSearchButton();
    await userEvent.click(searchButton);

    let noResultsAlert = document.querySelector('#no-results-alert');

    await waitFor(() => {
      table = getResultsTable();
      expect(table).not.toBeInTheDocument();

      noResultsAlert = document.querySelector('#no-results-alert');
      expect(noResultsAlert).toBeInTheDocument();
      expect(noResultsAlert).toBeVisible();
    });

    emptySpy.mockResolvedValue(searchResponseBody);

    const caseNumberInput = getCaseNumberInput();
    await userEvent.type(caseNumberInput, '00-11111');
    await waitFor(() => {
      expect(caseNumberInput['value']).toEqual('00-11111');
    });
    searchButton = getSearchButton();
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

    const caseNumberInput = getCaseNumberInput();
    const searchButton = getSearchButton();
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
      expect(getResultsTable()).not.toBeInTheDocument();

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
    expect(getResultsTable()).toBeInTheDocument();
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

    const searchButton = getSearchButton();
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

  test('Include Closed Cases checkbox is the first field in the search form', async () => {
    renderWithoutProps();

    const form = screen.getByTestId('filter-and-search-panel');
    await waitFor(() => {
      expect(form).toBeInTheDocument();
    });

    const formFields = form.querySelectorAll('.form-field');
    expect(formFields.length).toBeGreaterThan(0);
    expect(formFields[0]).toContainElement(document.querySelector('#checkbox-include-closed'));
  });

  test('shows closed cases hint alert after a non-case-number search returns results', async () => {
    renderWithoutProps();

    const expandButton = screen.getByTestId('button-case-chapter-search-expand');
    await TestingUtilities.toggleComboBoxItemSelection('case-chapter-search', 2);
    await userEvent.click(expandButton);

    const searchButton = getSearchButton();
    await userEvent.click(searchButton);

    await waitFor(() => {
      expect(getResultsTable()).toBeInTheDocument();
      expect(document.querySelector('#closed-cases-hint-alert')).toBeInTheDocument();
    });
  });

  test('clicking Include Closed Cases link re-runs search with excludeClosedCases: false', async () => {
    renderWithoutProps();

    const expandButton = screen.getByTestId('button-case-chapter-search-expand');
    await TestingUtilities.toggleComboBoxItemSelection('case-chapter-search', 2);
    await userEvent.click(expandButton);

    const searchButton = getSearchButton();
    await userEvent.click(searchButton);

    await waitFor(() => {
      expect(document.querySelector('#closed-cases-hint-alert')).toBeInTheDocument();
    });

    searchCasesSpy.mockClear();
    const link = screen.getByRole('button', { name: 'Include Closed Cases' });
    fireEvent.click(link);

    await waitFor(() => {
      expect(searchCasesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ excludeClosedCases: false }),
        { includeAssignments: true },
      );
    });
  });

  test('Include Closed Cases link checks the checkbox', async () => {
    renderWithoutProps();

    const expandButton = screen.getByTestId('button-case-chapter-search-expand');
    await TestingUtilities.toggleComboBoxItemSelection('case-chapter-search', 2);
    await userEvent.click(expandButton);

    await userEvent.click(getSearchButton());

    await waitFor(() => {
      expect(document.querySelector('#closed-cases-hint-alert')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Include Closed Cases' }));

    await waitFor(() => {
      expect(screen.getByTestId('checkbox-include-closed')).toBeChecked();
    });
  });

  test('shows count-specific hint when caseNumber search returns closedCasesCount > 0', async () => {
    vi.spyOn(Api2, 'searchCases').mockResolvedValue({
      ...searchResponseBody,
      pagination: {
        count: caseList.length,
        currentPage: 1,
        limit: DEFAULT_SEARCH_LIMIT,
        closedCasesCount: 3,
      } as CasesPagination,
    });

    renderWithoutProps();

    const caseNumberInput = getCaseNumberInput();
    await userEvent.type(caseNumberInput, '00-11111');
    await userEvent.click(getSearchButton());

    await waitFor(() => {
      const hint = document.querySelector('#closed-cases-hint-alert');
      expect(hint).toBeInTheDocument();
      expect(hint).toHaveTextContent('3 closed cases match your search filters.');
      expect(hint).toHaveTextContent('Include Closed Cases');
    });
  });

  test('shows singular "1 closed case" in hint when closedCasesCount is 1', async () => {
    vi.spyOn(Api2, 'searchCases').mockResolvedValue({
      ...searchResponseBody,
      pagination: {
        count: caseList.length,
        currentPage: 1,
        limit: DEFAULT_SEARCH_LIMIT,
        closedCasesCount: 1,
      } as CasesPagination,
    });

    renderWithoutProps();

    const caseNumberInput = getCaseNumberInput();
    await userEvent.type(caseNumberInput, '00-11111');
    await userEvent.click(getSearchButton());

    await waitFor(() => {
      const hint = document.querySelector('#closed-cases-hint-alert');
      expect(hint).toBeInTheDocument();
      expect(hint).toHaveTextContent('1 closed case matches your search filters.');
    });
  });

  test('does not show count-specific hint when closedCasesCount is 0', async () => {
    vi.spyOn(Api2, 'searchCases').mockResolvedValue({
      ...searchResponseBody,
      pagination: {
        count: caseList.length,
        currentPage: 1,
        limit: DEFAULT_SEARCH_LIMIT,
        closedCasesCount: 0,
      } as CasesPagination,
    });

    renderWithoutProps();

    const caseNumberInput = getCaseNumberInput();
    await userEvent.type(caseNumberInput, '00-11111');
    await userEvent.click(getSearchButton());

    await waitFor(() => {
      expect(getResultsTable()).toBeInTheDocument();
    });

    expect(document.querySelector('#closed-cases-hint-alert')).not.toBeInTheDocument();
  });

  test('shows "No Open cases found" with count when caseNumber search returns no open results but closed cases exist', async () => {
    vi.spyOn(Api2, 'searchCases').mockResolvedValue({
      meta: { self: 'self-url' },
      pagination: {
        count: 0,
        currentPage: 0,
        limit: DEFAULT_SEARCH_LIMIT,
        closedCasesCount: 4,
      } as CasesPagination,
      data: [],
    });

    renderWithoutProps();

    const caseNumberInput = getCaseNumberInput();
    await userEvent.type(caseNumberInput, '00-11111');
    await userEvent.click(getSearchButton());

    await waitFor(() => {
      const alert = document.querySelector('#no-results-alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent('No Open cases found');
      expect(alert).toHaveTextContent('4 closed cases match your search filters.');
      expect(alert).toHaveTextContent('Include Closed Cases');
    });
  });

  test('should update search predicate when Include Closed Cases checkbox is toggled', async () => {
    renderWithoutProps();
    const caseNumberInput = getCaseNumberInput();
    await userEvent.type(caseNumberInput, '1100000');

    const initialCheckbox = screen.getByTestId('checkbox-include-closed');
    expect(initialCheckbox).not.toBeChecked();

    await userEvent.click(document.querySelector('#checkbox-include-closed-click-target')!);

    const searchButton = getSearchButton();
    await userEvent.click(searchButton);

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
    });

    const checkedCheckbox = screen.getByTestId('checkbox-include-closed');
    expect(checkedCheckbox).toBeChecked();

    expect(searchCasesSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        excludeClosedCases: false,
      }),
      includeAssignments,
    );

    await userEvent.click(document.querySelector('#checkbox-include-closed-click-target')!);

    await userEvent.click(searchButton);

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
    });

    const uncheckedCheckbox = screen.getByTestId('checkbox-include-closed');
    expect(uncheckedCheckbox).not.toBeChecked();

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

    searchCasesSpy.mockClear();

    const caseNumberInput = getCaseNumberInput();
    expect(caseNumberInput).toBeInTheDocument();

    await waitFor(() => {
      expect(caseNumberInput).toBeEnabled();
    });

    await userEvent.type(caseNumberInput, caseNumber);

    const form = screen.getByTestId('filter-and-search-panel');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(getResultsTable()).toBeVisible();
    });

    const rows = getResultRows();
    expect(rows).toHaveLength(caseList.length);

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
      expect(getResultsTable()).not.toBeInTheDocument();
    });

    await TestingUtilities.toggleComboBoxItemSelection('case-chapter-search', 2);

    const expandButton = screen.getByTestId('button-case-chapter-search-expand');
    await userEvent.click(expandButton!);

    const filterAndSearchPanel = screen.getByTestId('filter-and-search-panel');
    expect(filterAndSearchPanel).toBeInTheDocument();

    fireEvent.submit(filterAndSearchPanel);

    await waitFor(() => {
      expect(document.querySelector('#default-state-alert')).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(getResultsTable()).toBeInTheDocument();
    });

    const rows = getResultRows();

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

    searchCasesSpy.mockClear();

    const caseNumberInput = getCaseNumberInput();

    await waitFor(() => {
      expect(caseNumberInput).toBeEnabled();
    });

    await userEvent.type(caseNumberInput, '12345');
    await userEvent.keyboard('{Enter}');

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

    searchCasesSpy.mockClear();

    const caseNumberInput = getCaseNumberInput();

    await waitFor(() => {
      expect(caseNumberInput).toBeEnabled();
    });

    await userEvent.type(caseNumberInput, firstCaseNumber);
    const form = screen.getByTestId('filter-and-search-panel');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(getResultsTable()).toBeVisible();
    });

    expect(searchCasesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        caseNumber: firstCaseNumber,
      }),
      includeAssignments,
    );

    const firstCallCount = searchCasesSpy.mock.calls.length;

    await userEvent.clear(caseNumberInput);
    await userEvent.type(caseNumberInput, secondCaseNumber);
    fireEvent.submit(form);

    await waitFor(() => {
      expect(searchCasesSpy.mock.calls.length).toBeGreaterThan(firstCallCount);
    });

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
    });

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

    const caseNumberInput = getCaseNumberInput();

    await waitFor(() => {
      expect(caseNumberInput).toBeEnabled();
    });

    await userEvent.type(caseNumberInput, '55');

    await waitFor(
      () => {
        const errorMessage = screen.queryByText(/Must be 7 digits/i);
        expect(errorMessage).toBeInTheDocument();
      },
      { timeout: 1000 },
    );

    const searchButton = getSearchButton();
    expect(searchButton).toBeDisabled();
  });

  test('should clear error when valid case number is entered after invalid one', async () => {
    renderWithoutProps();

    searchCasesSpy.mockClear();

    const caseNumberInput = getCaseNumberInput();

    await waitFor(() => {
      expect(caseNumberInput).toBeEnabled();
    });

    await userEvent.type(caseNumberInput, '55');

    await waitFor(
      () => {
        const errorMessage = screen.queryByText(/Must be 7 digits/i);
        expect(errorMessage).toBeInTheDocument();
      },
      { timeout: 1000 },
    );

    await userEvent.clear(caseNumberInput);
    await userEvent.type(caseNumberInput, '12-34567');

    await waitFor(
      () => {
        const errorMessage = screen.queryByText(/Must be 7 digits/i);
        expect(errorMessage).not.toBeInTheDocument();
      },
      { timeout: 1000 },
    );

    const searchButton = getSearchButton();
    expect(searchButton).not.toBeDisabled();
  });

  test('should show form validation error when trying to search with no criteria', async () => {
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(
      MockData.getCamsSession({ user: MockData.getCamsUser({ offices: [] }) }),
    );

    renderWithoutProps();
    await TestingUtilities.waitForDocumentBody();

    const searchButton = getSearchButton();

    expect(searchButton).toBeDisabled();

    expect(searchCasesSpy).not.toHaveBeenCalled();
  });

  test('should not show form validation error when at least one criterion is selected', async () => {
    renderWithoutProps();

    const searchButton = getSearchButton();

    await waitFor(() => {
      expect(searchButton).not.toBeDisabled();
    });

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

    searchCasesSpy.mockClear();

    const debtorNameInput = await screen.findByLabelText(/debtor name/i);
    expect(debtorNameInput).toBeInTheDocument();

    await waitFor(() => {
      expect(debtorNameInput).toBeEnabled();
    });

    const debtorName = 'John Smith';
    await userEvent.type(debtorNameInput, debtorName);

    const searchButton = getSearchButton();
    await userEvent.click(searchButton);

    await waitFor(() => {
      expect(getResultsTable()).toBeVisible();
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

    searchCasesSpy.mockClear();

    const debtorNameInput = await screen.findByLabelText(/debtor name/i);
    const caseNumberInput = getCaseNumberInput();

    await waitFor(() => {
      expect(debtorNameInput).toBeEnabled();
      expect(caseNumberInput).toBeEnabled();
    });

    const debtorName = 'Jane Doe';
    const caseNumber = '00-12345';

    await userEvent.type(debtorNameInput, debtorName);
    await userEvent.type(caseNumberInput, caseNumber);

    const searchButton = getSearchButton();
    await userEvent.click(searchButton);

    await waitFor(() => {
      expect(getResultsTable()).toBeVisible();
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

    searchCasesSpy.mockClear();

    const debtorNameInput = await screen.findByLabelText(/debtor name/i);
    await waitFor(() => {
      expect(debtorNameInput).toBeEnabled();
    });

    await userEvent.type(debtorNameInput, 'Michael Johnson');

    await TestingUtilities.toggleComboBoxItemSelection('case-chapter-search', 2);
    const expandButton = screen.getByTestId('button-case-chapter-search-expand');
    await userEvent.click(expandButton);

    const searchButton = getSearchButton();
    await userEvent.click(searchButton);

    await waitFor(() => {
      expect(getResultsTable()).toBeVisible();
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

    searchCasesSpy.mockClear();

    const debtorNameInput = await screen.findByLabelText(/debtor name/i);
    await waitFor(() => {
      expect(debtorNameInput).toBeEnabled();
    });

    const debtorName = 'Sarah Connor';
    await userEvent.type(debtorNameInput, debtorName);

    const form = screen.getByTestId('filter-and-search-panel');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(getResultsTable()).toBeVisible();
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

    await userEvent.clear(debtorNameInput);

    await waitFor(() => {
      expect((debtorNameInput as HTMLInputElement).value).toBe('');
    });
  });

  test('should preserve single character input while typing', async () => {
    renderWithFeatureFlag(true);

    const debtorNameInput = await screen.findByLabelText(/debtor name/i);

    await userEvent.type(debtorNameInput, 'J');

    await waitFor(() => {
      expect((debtorNameInput as HTMLInputElement).value).toBe('J');
    });

    await userEvent.type(debtorNameInput, 'o');

    await waitFor(() => {
      expect((debtorNameInput as HTMLInputElement).value).toBe('Jo');
    });

    await userEvent.type(debtorNameInput, 'hn');

    await waitFor(() => {
      expect((debtorNameInput as HTMLInputElement).value).toBe('John');
    });
  });

  test('should validate debtor name has at least 2 characters', async () => {
    renderWithFeatureFlag(true);

    const debtorNameInput = await screen.findByLabelText(/debtor name/i);

    await userEvent.type(debtorNameInput, 'J');

    await waitFor(() => {
      expect((debtorNameInput as HTMLInputElement).value).toBe('J');
    });

    const formData = { debtorName: 'J' };
    const validation = validateFormData(formData);
    expect(validation.isValid).toBe(false);
    expect(validation.fieldErrors.debtorName).toBeDefined();
  });

  test('should accept debtor name with 2+ characters', async () => {
    renderWithFeatureFlag(true);

    const debtorNameInput = await screen.findByLabelText(/debtor name/i);

    await userEvent.type(debtorNameInput, 'Jo');

    const formData = { debtorName: 'Jo' };
    const validation = validateFormData(formData);
    expect(validation.isValid).toBe(true);
    expect(validation.fieldErrors.debtorName).toBeUndefined();
  });

  test('should reject empty string after whitespace trim', async () => {
    const formData = { debtorName: '   ' };
    const validation = validateFormData(formData);

    expect(validation.isValid).toBe(false);
    expect(validation.formValidationError).toBe('Please enter at least one search criterion');
  });
});

describe('SearchScreen analytics integration', () => {
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
  let userEvent: CamsUserEvent;
  let trackNavigationMock: ReturnType<typeof vi.fn>;
  let trackFirstSearchMock: ReturnType<typeof vi.fn>;

  function renderWithoutProps() {
    render(
      <BrowserRouter>
        <SearchScreen></SearchScreen>
      </BrowserRouter>,
    );
  }

  beforeEach(async () => {
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
    vi.spyOn(Api2, 'searchCases').mockResolvedValue(searchResponseBody);
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
    userEvent = TestingUtilities.setupUserEvent();

    trackNavigationMock = vi.fn();
    trackFirstSearchMock = vi.fn();

    vi.spyOn(UseLandingPageAnalyticsModule, 'useLandingPageAnalytics').mockReturnValue({
      trackNavigation: trackNavigationMock as (toPage: string) => void,
      trackFirstSearch: trackFirstSearchMock as (
        searchType: 'case-number' | 'debtor-name' | 'ssn' | 'other',
      ) => void,
    });
  });

  test('should call analytics hook with correct landing page parameter', async () => {
    renderWithoutProps();

    await waitFor(() => {
      expect(UseLandingPageAnalyticsModule.useLandingPageAnalytics).toHaveBeenCalledWith(
        'case-search',
      );
    });
  });

  test('should track first search action regardless of navigation method', async () => {
    // After removing LandingPageContext, SearchScreen now tracks first search for any user on /search
    renderWithoutProps();

    const caseNumberInput = getCaseNumberInput();
    await waitFor(() => {
      expect(caseNumberInput).toBeEnabled();
    });

    await userEvent.type(caseNumberInput, '00-11111');
    const searchButton = getSearchButton();
    await userEvent.click(searchButton);

    await waitFor(() => {
      expect(getResultsTable()).toBeVisible();
    });

    // Should track first search action
    expect(trackFirstSearchMock).toHaveBeenCalledWith('case-number');
  });
});
