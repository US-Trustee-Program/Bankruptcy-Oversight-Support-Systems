import { describe } from 'vitest';
import { render, waitFor, screen, fireEvent, act } from '@testing-library/react';
import CaseDetailScreen, {
  applyDocketEntrySortAndFilters,
  findDocketLimits,
  getSummaryFacetList,
} from './CaseDetailScreen';
import * as ReactRouter from 'react-router';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MockData from '@common/cams/test-utilities/mock-data';
import { CaseDocket } from '@common/cams/cases';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';
import * as UseApplicationInsights from '@/lib/hooks/UseApplicationInsights';

vi.mock('react-router', { spy: true });

const mockTrackEvent = vi.fn();

const testCaseDocketEntries: CaseDocket = [
  {
    sequenceNumber: 2,
    documentNumber: 1,
    dateFiled: '2023-05-07',
    summaryText: 'Add Judge',
    fullText: 'Docket entry number 1.',
  },
  {
    sequenceNumber: 3,
    dateFiled: '2023-06-07',
    summaryText: 'Motion',
    fullText: 'Docket entry number 2.',
  },
  {
    sequenceNumber: 4,
    documentNumber: 2,
    dateFiled: '2023-07-07',
    summaryText: 'Add Attorney',
    fullText: 'Docket entry number 3.',
    documents: [
      {
        fileLabel: '0-0',
        fileSize: 1000,
        fileExt: 'pdf',
        fileUri: 'https://somehost.gov/pdf/0000-111111-3-0-0.pdf',
      },
    ],
  },
  {
    sequenceNumber: 5,
    dateFiled: '2023-08-07',
    summaryText: 'Motion',
    fullText: 'Docket entry number 4.',
  },
];
describe('Case Detail sort, search, and filter tests', () => {
  const testCaseId = '111-11-12345';
  const testCaseDetail = MockData.getCaseDetail({ override: { caseId: testCaseId } });

  describe('display tests', () => {
    let userEvent: CamsUserEvent;

    beforeEach(() => {
      userEvent = TestingUtilities.setupUserEvent();
    });

    test('should display sort and filter panel when navigated to docket entries', async () => {
      const basicInfoPath = `/case-detail/${testCaseId}/`;

      render(
        <MemoryRouter initialEntries={[basicInfoPath]}>
          <Routes>
            <Route
              path="case-detail/:caseId/*"
              element={
                <CaseDetailScreen
                  caseDetail={testCaseDetail}
                  caseDocketEntries={testCaseDocketEntries}
                />
              }
            />
          </Routes>
        </MemoryRouter>,
      );

      const sortButtonId = 'docket-entry-sort';
      let sortButton: HTMLElement | null;
      const searchInputId = 'docket-entry-search';
      let searchInput: HTMLElement | null;

      await waitFor(() => {
        sortButton = screen.queryByTestId(sortButtonId);
        expect(sortButton).not.toBeInTheDocument();
        searchInput = screen.queryByTestId(searchInputId);
        expect(searchInput).not.toBeInTheDocument();
        expect(screen.getByTestId('court-docket-link')).toBeInTheDocument();
      });

      const docketEntryLink = screen.getByTestId('court-docket-link');
      await userEvent.click(docketEntryLink);
      await waitFor(() => {
        sortButton = screen.queryByTestId(sortButtonId);
        expect(sortButton).toBeInTheDocument();
        searchInput = screen.queryByTestId(searchInputId);
        expect(searchInput).toBeInTheDocument();
      });

      const basicInfoLink = screen.getByTestId('case-overview-link');
      await userEvent.click(basicInfoLink);
      await waitFor(() => {
        sortButton = screen.queryByTestId(sortButtonId);
        expect(sortButton).not.toBeInTheDocument();
        searchInput = screen.queryByTestId(searchInputId);
        expect(searchInput).not.toBeInTheDocument();
      });
    });

    test('should not display sort and filter panel when navigated to basic info', async () => {
      vi.spyOn(ReactRouter, 'useParams').mockReturnValue({ caseId: testCaseId });
      const docketEntryPath = `/case-detail/${testCaseId}/court-docket`;

      render(
        <MemoryRouter initialEntries={[docketEntryPath]}>
          <Routes>
            <Route
              path="case-detail/:caseId/court-docket"
              element={
                <CaseDetailScreen
                  caseDetail={testCaseDetail}
                  caseDocketEntries={testCaseDocketEntries}
                />
              }
            />
          </Routes>
        </MemoryRouter>,
      );

      const sortButtonId = 'docket-entry-sort';
      let sortButton: HTMLElement | null;
      const searchInputId = 'docket-entry-search';
      let searchInput;

      await waitFor(async () => {
        sortButton = screen.queryByTestId(sortButtonId);
        expect(sortButton).toBeInTheDocument();
        searchInput = await screen.findByTestId(searchInputId);
        expect(searchInput).toBeInTheDocument();
      });

      const basicInfoLink = screen.getByTestId('case-overview-link');
      fireEvent.click(basicInfoLink as Element);
      await waitFor(() => {
        sortButton = screen.queryByTestId(sortButtonId);
        expect(sortButton).not.toBeInTheDocument();
        searchInput = screen.queryByTestId(searchInputId);
        expect(searchInput).not.toBeInTheDocument();
      });
    }, 5000);

    test('should display filter select when navigated to docket entries', async () => {
      const basicInfoPath = `/case-detail/${testCaseId}/`;

      render(
        <MemoryRouter initialEntries={[basicInfoPath]}>
          <Routes>
            <Route
              path="case-detail/:caseId/*"
              element={
                <CaseDetailScreen
                  caseDetail={testCaseDetail}
                  caseDocketEntries={testCaseDocketEntries}
                />
              }
            />
          </Routes>
        </MemoryRouter>,
      );

      const filterSelectClass = '.docket-summary-facets';
      let filterSelectElement: HTMLElement | null;

      await waitFor(() => {
        filterSelectElement = document.querySelector(filterSelectClass);
        expect(filterSelectElement).not.toBeInTheDocument();
      });

      const docketEntryLink = screen.getByTestId('court-docket-link');
      fireEvent.click(docketEntryLink as Element);
      await waitFor(() => {
        filterSelectElement = document.querySelector(filterSelectClass);
        expect(filterSelectElement).toBeInTheDocument();
      });

      const basicInfoLink = screen.getByTestId('case-overview-link');
      fireEvent.click(basicInfoLink as Element);
      await waitFor(() => {
        filterSelectElement = document.querySelector(filterSelectClass);
        expect(filterSelectElement).not.toBeInTheDocument();
      });
    }, 5000);

    test('should not display filter select when navigated to basic info', async () => {
      vi.spyOn(ReactRouter, 'useParams').mockReturnValue({ caseId: testCaseId });

      const docketEntryPath = `/case-detail/${testCaseId}/court-docket`;

      render(
        <MemoryRouter initialEntries={[docketEntryPath]}>
          <Routes>
            <Route
              path="case-detail/:caseId/court-docket"
              element={
                <CaseDetailScreen
                  caseDetail={testCaseDetail}
                  caseDocketEntries={testCaseDocketEntries}
                />
              }
            />
          </Routes>
        </MemoryRouter>,
      );

      const filterSelectClass = '.docket-summary-facets';
      let filterSelectElement: HTMLElement | null;

      await waitFor(async () => {
        filterSelectElement = document.querySelector(filterSelectClass);
        expect(filterSelectElement).toBeInTheDocument();
      });

      const basicInfoLink = screen.getByTestId('case-overview-link');
      fireEvent.click(basicInfoLink as Element);
      await waitFor(() => {
        filterSelectElement = document.querySelector(filterSelectClass);
        expect(filterSelectElement).not.toBeInTheDocument();
      });
    }, 5000);
  });

  describe('sort, search, and filter tests', () => {
    test('should find limits in the docket', () => {
      const limits = findDocketLimits(testCaseDocketEntries);
      expect(limits.dateRange.start).toEqual('2023-05-07');
      expect(limits.dateRange.end).toEqual('2023-08-07');
      expect(limits.documentRange.first).toEqual(1);
      expect(limits.documentRange.last).toEqual(2);
    });

    test('should return default limits if docket is empty', () => {
      const limits = findDocketLimits([]);
      expect(limits.dateRange.start).toBeUndefined();
      expect(limits.dateRange.end).toBeUndefined();
      expect(limits.documentRange.first).toEqual(0);
      expect(limits.documentRange.last).toEqual(0);
    });

    test('the document range should be 0 if the docket entries do not have a document number', () => {
      const dateFiled = '2023-05-07';
      const limits = findDocketLimits([
        {
          sequenceNumber: 2,
          dateFiled,
          summaryText: 'Add Judge',
          fullText: 'Docket entry number 1.',
        },
      ]);
      expect(limits.dateRange.start).toEqual(dateFiled);
      expect(limits.dateRange.end).toEqual(dateFiled);
      expect(limits.documentRange.first).toEqual(0);
      expect(limits.documentRange.last).toEqual(0);
    });

    test('should filter the list of docket entries per the search text', async () => {
      const { filteredDocketEntries, alertOptions } = applyDocketEntrySortAndFilters(
        testCaseDocketEntries,
        {
          searchInDocketText: 'number 2',
          selectedFacets: [],
          sortDirection: 'Oldest',
          documentNumber: null,
          selectedDateRange: {},
        },
      );

      expect(filteredDocketEntries?.length).toEqual(1);
      const actualEntry = filteredDocketEntries ? filteredDocketEntries[0] : null;
      expect(actualEntry).toEqual(testCaseDocketEntries[1]);

      expect(alertOptions).toBeUndefined();
    });

    test('should filter the list of docket entries per the selected facets', async () => {
      const { filteredDocketEntries, alertOptions } = applyDocketEntrySortAndFilters(
        testCaseDocketEntries,
        {
          searchInDocketText: '',
          selectedFacets: [
            testCaseDocketEntries[1].summaryText,
            testCaseDocketEntries[3].summaryText,
          ],
          sortDirection: 'Oldest',
          documentNumber: null,
          selectedDateRange: {},
        },
      );

      expect(filteredDocketEntries?.length).toEqual(2);
      const actualEntriesOne = filteredDocketEntries ? filteredDocketEntries[0] : null;
      expect(actualEntriesOne).toEqual(testCaseDocketEntries[1]);
      const actualEntriesTwo = filteredDocketEntries ? filteredDocketEntries[1] : null;
      expect(actualEntriesTwo).toEqual(testCaseDocketEntries[3]);

      expect(alertOptions).toBeUndefined();
    });

    test('should sort the list of docket entries oldest first', async () => {
      const youngestEntry = testCaseDocketEntries[2];
      const middleEntry = testCaseDocketEntries[1];
      const oldestEntry = testCaseDocketEntries[0];

      const docketEntries = testCaseDocketEntries.slice(0, 3);
      const { filteredDocketEntries, alertOptions } = applyDocketEntrySortAndFilters(
        docketEntries,
        {
          searchInDocketText: '',
          selectedFacets: [],
          sortDirection: 'Oldest',
          documentNumber: null,
          selectedDateRange: {},
        },
      );

      expect(filteredDocketEntries?.length).toEqual(3);
      const first = filteredDocketEntries ? filteredDocketEntries[0] : null;
      const second = filteredDocketEntries ? filteredDocketEntries[1] : null;
      const third = filteredDocketEntries ? filteredDocketEntries[2] : null;
      expect(first).toEqual(oldestEntry);
      expect(second).toEqual(middleEntry);
      expect(third).toEqual(youngestEntry);

      expect(alertOptions).toBeUndefined();
    });

    test('should sort the list of docket entries newest first', async () => {
      const youngestEntry = testCaseDocketEntries[2];
      const middleEntry = testCaseDocketEntries[1];
      const oldestEntry = testCaseDocketEntries[0];

      const docketEntries = testCaseDocketEntries.slice(0, 3);
      const { filteredDocketEntries, alertOptions } = applyDocketEntrySortAndFilters(
        docketEntries,
        {
          searchInDocketText: '',
          selectedFacets: [],
          sortDirection: 'Newest',
          documentNumber: null,
          selectedDateRange: {},
        },
      );

      expect(filteredDocketEntries?.length).toEqual(3);
      const first = filteredDocketEntries ? filteredDocketEntries[0] : null;
      const second = filteredDocketEntries ? filteredDocketEntries[1] : null;
      const third = filteredDocketEntries ? filteredDocketEntries[2] : null;
      expect(first).toEqual(youngestEntry);
      expect(second).toEqual(middleEntry);
      expect(third).toEqual(oldestEntry);

      expect(alertOptions).toBeUndefined();
    });

    test('should sort facets in call to getDocumentSummaryFacets', async () => {
      const testFacets = new Map([
        [
          'Motion for Joint Administration',
          {
            text: 'Motion for Joint Administration',
            count: 5,
          },
        ],
        [
          'Add Judge',
          {
            text: 'Add Judge',
            count: 2,
          },
        ],
        [
          'Case Association - Joint Administration',
          {
            text: 'Case Association - Joint Administration',
            count: 2,
          },
        ],
        [
          'Order Re: Motion for Joint Administration',
          {
            text: 'Order Re: Motion for Joint Administration',
            count: 1,
          },
        ],
      ]);

      const expectedFacets = [
        { value: 'Add Judge', label: 'Add Judge (2)' },
        {
          value: 'Case Association - Joint Administration',
          label: 'Case Association - Joint Administration (2)',
        },
        {
          value: 'Motion for Joint Administration',
          label: 'Motion for Joint Administration (5)',
        },
        {
          value: 'Order Re: Motion for Joint Administration',
          label: 'Order Re: Motion for Joint Administration (1)',
        },
      ];

      const resultFacets = getSummaryFacetList(testFacets);
      expect(resultFacets).toStrictEqual(expectedFacets);
    });
  });

  describe('Find document number', () => {
    test('should show an entry for a single matched document number', async () => {
      const basicInfoPath = `/case-detail/${testCaseId}/`;

      render(
        <MemoryRouter initialEntries={[basicInfoPath]}>
          <Routes>
            <Route
              path="case-detail/:caseId/*"
              element={
                <CaseDetailScreen
                  caseDetail={testCaseDetail}
                  caseDocketEntries={testCaseDocketEntries}
                />
              }
            />
          </Routes>
        </MemoryRouter>,
      );

      let dateRangePicker;
      const docketEntryLink = screen.getByTestId('court-docket-link');
      fireEvent.click(docketEntryLink as Element);
      await waitFor(() => {
        const docketListBefore = screen.getByTestId('searchable-docket');
        expect(docketListBefore.children.length).toEqual(testCaseDocketEntries.length);
        dateRangePicker = screen.queryByTestId('docket-date-range');

        expect(dateRangePicker).toBeInTheDocument();

        const docNumberInput = screen.getByTestId('document-number-search-field');
        expect(docNumberInput).toBeInTheDocument();
      });
      const docNumberInput = screen.getByTestId('document-number-search-field');
      fireEvent.change(docNumberInput, { target: { value: '1' } });

      const docketListAfter = screen.getByTestId('searchable-docket');
      expect(docketListAfter.children.length).toEqual(1);
    });

    test('should show error message if an invalid document number is entered', async () => {
      const basicInfoPath = `/case-detail/${testCaseId}/`;

      render(
        <MemoryRouter initialEntries={[basicInfoPath]}>
          <Routes>
            <Route
              path="case-detail/:caseId/*"
              element={
                <CaseDetailScreen
                  caseDetail={testCaseDetail}
                  caseDocketEntries={testCaseDocketEntries}
                />
              }
            />
          </Routes>
        </MemoryRouter>,
      );

      let dateRangePicker;
      const docketEntryLink = screen.getByTestId('court-docket-link');
      fireEvent.click(docketEntryLink as Element);
      await waitFor(() => {
        dateRangePicker = screen.queryByTestId('docket-date-range');
        expect(dateRangePicker).toBeInTheDocument();

        const docNumberInput = screen.getByTestId('document-number-search-field');
        expect(docNumberInput).toBeInTheDocument();
      });

      const docNumberInput = screen.getByTestId('document-number-search-field');
      fireEvent.change(docNumberInput, { target: { value: '100' } });
      await waitFor(() => {
        const alertMessage = screen.getByTestId('alert-message');
        expect(alertMessage).toHaveTextContent(
          'The document number you entered is not found in the docket.',
        );
      });
    });

    test('should show all docket entries if the docket number is cleared', async () => {
      const basicInfoPath = `/case-detail/${testCaseId}/`;

      render(
        <MemoryRouter initialEntries={[basicInfoPath]}>
          <Routes>
            <Route
              path="case-detail/:caseId/*"
              element={
                <CaseDetailScreen
                  caseDetail={testCaseDetail}
                  caseDocketEntries={testCaseDocketEntries}
                />
              }
            />
          </Routes>
        </MemoryRouter>,
      );

      let dateRangePicker;
      const docketEntryLink = screen.getByTestId('court-docket-link');
      fireEvent.click(docketEntryLink as Element);
      await waitFor(() => {
        const docketListBefore = screen.getByTestId('searchable-docket');
        expect(docketListBefore.children.length).toEqual(testCaseDocketEntries.length);
        dateRangePicker = screen.queryByTestId('docket-date-range');

        expect(dateRangePicker).toBeInTheDocument();

        const docNumberInput = screen.getByTestId('document-number-search-field');
        expect(docNumberInput).toBeInTheDocument();
      });

      const docNumberInput = screen.getByTestId('document-number-search-field');
      fireEvent.change(docNumberInput, { target: { value: '1' } });
      fireEvent.change(docNumberInput, { target: { value: '' } });

      const docketListAfter = screen.getByTestId('searchable-docket');
      expect(docketListAfter.children.length).toEqual(testCaseDocketEntries.length);
    });
  });

  describe('Date Picker', () => {
    test('should list proper dockets when start date changes', async () => {
      const basicInfoPath = `/case-detail/${testCaseId}/`;

      render(
        <MemoryRouter initialEntries={[basicInfoPath]}>
          <Routes>
            <Route
              path="case-detail/:caseId/*"
              element={
                <CaseDetailScreen
                  caseDetail={testCaseDetail}
                  caseDocketEntries={testCaseDocketEntries}
                />
              }
            />
          </Routes>
        </MemoryRouter>,
      );

      let dateRangePicker;
      const docketEntryLink = screen.getByTestId('court-docket-link');
      fireEvent.click(docketEntryLink as Element);
      await waitFor(() => {
        const docketListBefore = screen.getByTestId('searchable-docket');
        expect(docketListBefore.children.length).toEqual(testCaseDocketEntries.length);
        dateRangePicker = screen.queryByTestId('docket-date-range');

        expect(dateRangePicker).toBeInTheDocument();

        const startDateText = screen.getByTestId('docket-date-range-date-start');
        expect(startDateText).toBeInTheDocument();
      });

      const startDateText = screen.getByTestId('docket-date-range-date-start');
      const endDateText = screen.getByTestId('docket-date-range-date-end');

      fireEvent.change(endDateText, { target: { value: '2023-08-31' } });
      fireEvent.change(startDateText, { target: { value: '2023-07-01' } });

      await waitFor(() => {
        const docketListAfter = screen.getByTestId('searchable-docket');
        expect(docketListAfter.children.length).toEqual(2);
      });
    });

    test('should list proper dockets when end date changes', async () => {
      const basicInfoPath = `/case-detail/${testCaseId}/`;

      render(
        <MemoryRouter initialEntries={[basicInfoPath]}>
          <Routes>
            <Route
              path="case-detail/:caseId/*"
              element={
                <CaseDetailScreen
                  caseDetail={testCaseDetail}
                  caseDocketEntries={testCaseDocketEntries}
                />
              }
            />
          </Routes>
        </MemoryRouter>,
      );

      let dateRangePicker;

      const docketEntryLink = screen.getByTestId('court-docket-link');
      fireEvent.click(docketEntryLink as Element);
      await waitFor(() => {
        const docketListBefore = screen.getByTestId('searchable-docket');
        expect(docketListBefore.children.length).toEqual(testCaseDocketEntries.length);
        dateRangePicker = screen.queryByTestId('docket-date-range');

        expect(dateRangePicker).toBeInTheDocument();

        const endDateText = screen.getByTestId('docket-date-range-date-end');
        expect(endDateText).toBeInTheDocument();
      });
      const startDateText = screen.getByTestId('docket-date-range-date-start');
      const endDateText = screen.getByTestId('docket-date-range-date-end');

      fireEvent.change(startDateText, { target: { value: '2023-05-01' } });
      fireEvent.change(endDateText, { target: { value: '2023-07-01' } });

      await waitFor(() => {
        const docketListAfter = screen.getByTestId('searchable-docket');
        expect(docketListAfter.children.length).toEqual(2);
      });
    });
  });

  describe('Clear Filters', () => {
    let userEvent: CamsUserEvent;

    beforeEach(() => {
      userEvent = TestingUtilities.setupUserEvent();
    });

    test('clear filter fields when clear filters button is clicked', async () => {
      const basicInfoPath = `/case-detail/${testCaseId}/`;

      render(
        <MemoryRouter initialEntries={[basicInfoPath]}>
          <Routes>
            <Route
              path="case-detail/:caseId/*"
              element={
                <CaseDetailScreen
                  caseDetail={testCaseDetail}
                  caseDocketEntries={testCaseDocketEntries}
                />
              }
            />
          </Routes>
        </MemoryRouter>,
      );

      let sortButton;
      sortButton = screen.queryByTestId('docket-entry-sort');
      expect(sortButton).not.toBeInTheDocument();

      let docketEntryLink;
      await waitFor(() => {
        docketEntryLink = screen.getByTestId('court-docket-link');
        expect(docketEntryLink).toBeInTheDocument();
      });

      fireEvent.click(docketEntryLink! as Element);
      await waitFor(() => {
        sortButton = screen.queryByTestId('docket-entry-sort');
        expect(sortButton).toBeInTheDocument();

        const docketListBefore = screen.getByTestId('searchable-docket');
        expect(docketListBefore).toBeInTheDocument();
        expect(docketListBefore.children.length).toEqual(testCaseDocketEntries.length);
      });

      let searchInput = screen.getByTestId('basic-search-field');
      expect(searchInput).toBeInTheDocument();

      let startDateText = screen.getByTestId('docket-date-range-date-start');
      expect(startDateText).toBeInTheDocument();

      let endDateText = screen.getByTestId('docket-date-range-date-end');
      expect(endDateText).toBeInTheDocument();

      let docNumberSearchInput = screen.getByTestId('document-number-search-field');
      expect(docNumberSearchInput).toBeInTheDocument();

      const docketFacetContainer = screen.getByTestId('facet-multi-select-container-test-id');
      expect(docketFacetContainer).toBeInTheDocument();

      const clearFiltersButton = screen.getByTestId('clear-filters');
      expect(clearFiltersButton).toBeInTheDocument();

      const caseDetailScreen = screen.getByTestId('case-detail');
      expect(caseDetailScreen).toBeInTheDocument();

      fireEvent.change(searchInput, { target: { value: 'abc' } });
      fireEvent.change(startDateText, { target: { value: '2023-07-01' } });
      fireEvent.change(endDateText, { target: { value: '2023-011-01' } });
      fireEvent.change(docNumberSearchInput, { target: { value: '1' } });
      await userEvent.click(docketFacetContainer);
      const item0 = docketFacetContainer.querySelector('li');
      await userEvent.click(item0!);

      const docketListAfterInput = screen.getByTestId('searchable-docket');
      expect(docketListAfterInput.children.length).toEqual(1);

      fireEvent.click(clearFiltersButton as Element);

      const docketListAfterClear = screen.getByTestId('searchable-docket');
      expect(docketListAfterClear.children.length).toEqual(testCaseDocketEntries.length);

      searchInput = screen.getByTestId('document-number-search-field');
      expect(searchInput.textContent).toBe('');

      const selectedFacets = document.querySelector(
        '#facet-multi-select-item-list-container li.selected',
      );
      expect(selectedFacets).not.toBeInTheDocument();

      startDateText = screen.getByTestId('docket-date-range-date-start');
      expect(startDateText.textContent).toBe('');

      endDateText = screen.getByTestId('docket-date-range-date-end');
      expect(endDateText.textContent).toBe('');

      docNumberSearchInput = screen.getByTestId('document-number-search-field');
      expect(docNumberSearchInput.textContent).toBe('');
    });
  });

  describe('Filter usage telemetry', () => {
    beforeEach(() => {
      vi.useRealTimers();
      vi.unstubAllGlobals();
      mockTrackEvent.mockReset();
      vi.spyOn(UseApplicationInsights, 'getAppInsights').mockReturnValue({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reactPlugin: {} as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        appInsights: { trackEvent: mockTrackEvent } as any,
      });
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      });
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    async function renderAndNavigateToDocket() {
      const basicInfoPath = `/case-detail/${testCaseId}/`;
      render(
        <MemoryRouter initialEntries={[basicInfoPath]}>
          <Routes>
            <Route
              path="case-detail/:caseId/*"
              element={
                <CaseDetailScreen
                  caseDetail={testCaseDetail}
                  caseDocketEntries={testCaseDocketEntries}
                />
              }
            />
          </Routes>
        </MemoryRouter>,
      );

      let docketEntryLink;
      await waitFor(() => {
        docketEntryLink = screen.getByTestId('court-docket-link');
        expect(docketEntryLink).toBeInTheDocument();
      });
      fireEvent.click(docketEntryLink! as Element);
      await waitFor(() => {
        expect(screen.queryByTestId('docket-entry-sort')).toBeInTheDocument();
      });
    }

    function changedCalls(eventName: string) {
      return mockTrackEvent.mock.calls.filter((call) => call[0]?.name === eventName);
    }

    function clearedCalls(eventName: string) {
      return mockTrackEvent.mock.calls.filter((call) => call[0]?.name === eventName);
    }

    function typeAndWait(testId: string, value: string, delay = 500) {
      fireEvent.change(screen.getByTestId(testId), { target: { value } });
      act(() => vi.advanceTimersByTime(delay));
    }

    function expectSingleChanged(eventName: string, expectedProps?: Record<string, unknown>) {
      const calls = changedCalls(eventName);
      expect(calls).toHaveLength(1);
      if (expectedProps) {
        expect(calls[0][1]).toEqual(expectedProps);
      } else {
        expect(calls[0][1]).toBeUndefined();
      }
    }

    function expectSingleCleared(eventName: string) {
      const calls = clearedCalls(eventName);
      expect(calls).toHaveLength(1);
      expect(calls[0][1]).toBeUndefined();
    }

    function clearAllAndFlush(delay = 500) {
      fireEvent.click(screen.getByTestId('clear-filters'));
      act(() => vi.advanceTimersByTime(delay));
    }

    test('fires a single Docket Text Search Changed event after debounce settles', async () => {
      await renderAndNavigateToDocket();

      fireEvent.change(screen.getByTestId('basic-search-field'), { target: { value: 'motion' } });
      expect(changedCalls('Docket Text Search Filter Changed')).toHaveLength(0);

      act(() => vi.advanceTimersByTime(500));

      expectSingleChanged('Docket Text Search Filter Changed');
    });

    test('fires Docket Text Search Cleared when the text is emptied after having a value', async () => {
      await renderAndNavigateToDocket();
      typeAndWait('basic-search-field', 'motion');
      mockTrackEvent.mockReset();

      typeAndWait('basic-search-field', '');

      expectSingleCleared('Docket Text Search Filter Cleared');
    });

    test('fires a single Docket Document Number Changed event after debounce settles', async () => {
      await renderAndNavigateToDocket();

      fireEvent.change(screen.getByTestId('document-number-search-field'), {
        target: { value: '1' },
      });
      expect(changedCalls('Docket Document Number Filter Changed')).toHaveLength(0);

      act(() => vi.advanceTimersByTime(500));

      expectSingleChanged('Docket Document Number Filter Changed');
    });

    test('fires Docket Document Number Cleared when the number is emptied after having a value', async () => {
      await renderAndNavigateToDocket();
      typeAndWait('document-number-search-field', '1');
      mockTrackEvent.mockReset();

      typeAndWait('document-number-search-field', '');

      expectSingleCleared('Docket Document Number Filter Cleared');
    });

    test('fires no telemetry when an invalid (non-numeric) value is entered into an empty document number field', async () => {
      await renderAndNavigateToDocket();
      typeAndWait('document-number-search-field', 'abc');

      expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    test('fires Docket Document Number Cleared when an invalid value replaces a valid one', async () => {
      await renderAndNavigateToDocket();
      typeAndWait('document-number-search-field', '1');
      mockTrackEvent.mockReset();

      typeAndWait('document-number-search-field', 'abc');

      expectSingleCleared('Docket Document Number Filter Cleared');
    });

    test('fires a single Docket Summary Filter Changed event when a facet is selected', async () => {
      await renderAndNavigateToDocket();
      const docketFacetContainer = screen.getByTestId('facet-multi-select-container-test-id');

      const expandButton = screen.getByTestId('button-facet-multi-select-expand');
      fireEvent.click(expandButton);
      const item0 = docketFacetContainer.querySelector('li');
      fireEvent.click(item0!);
      fireEvent.click(expandButton);

      const calls = changedCalls('Docket Summary Filter Changed');
      expect(calls).toHaveLength(1);
      expect(calls[0][1]).toBeUndefined();
    });

    test('fires Docket Summary Filter Cleared when the facet ComboBox is directly cleared', async () => {
      await renderAndNavigateToDocket();
      const docketFacetContainer = screen.getByTestId('facet-multi-select-container-test-id');

      const expandButton = screen.getByTestId('button-facet-multi-select-expand');
      fireEvent.click(expandButton);
      const item0 = docketFacetContainer.querySelector('li');
      fireEvent.click(item0!);
      fireEvent.click(expandButton);
      mockTrackEvent.mockReset();

      fireEvent.click(document.getElementById('facet-multi-select-clear-all')!);

      expectSingleCleared('Docket Summary Filter Cleared');
    });

    test('fires Docket Date Range Start Only Filter Changed when the start date changes', async () => {
      await renderAndNavigateToDocket();

      fireEvent.change(screen.getByTestId('docket-date-range-date-start'), {
        target: { value: '2023-07-01' },
      });
      act(() => vi.advanceTimersByTime(500));

      expectSingleChanged('Docket Date Range Start Only Filter Changed');
    });

    test('fires Docket Date Range End Only Filter Changed when the end date changes', async () => {
      await renderAndNavigateToDocket();

      fireEvent.change(screen.getByTestId('docket-date-range-date-end'), {
        target: { value: '2023-06-30' },
      });
      act(() => vi.advanceTimersByTime(500));

      expectSingleChanged('Docket Date Range End Only Filter Changed');
    });

    test('fires exactly one Docket Complete Date Range Filter Changed event when end then start are set in quick succession', async () => {
      await renderAndNavigateToDocket();

      fireEvent.change(screen.getByTestId('docket-date-range-date-end'), {
        target: { value: '2023-08-31' },
      });
      fireEvent.change(screen.getByTestId('docket-date-range-date-start'), {
        target: { value: '2023-07-01' },
      });
      act(() => vi.advanceTimersByTime(500));

      expectSingleChanged('Docket Complete Date Range Filter Changed');
      expect(changedCalls('Docket Date Range Start Only Filter Changed')).toHaveLength(0);
      expect(changedCalls('Docket Date Range End Only Filter Changed')).toHaveLength(0);
    });

    test('fires exactly one Docket Complete Date Range Filter Changed event when start then end are set in quick succession', async () => {
      await renderAndNavigateToDocket();

      fireEvent.change(screen.getByTestId('docket-date-range-date-start'), {
        target: { value: '2023-07-01' },
      });
      fireEvent.change(screen.getByTestId('docket-date-range-date-end'), {
        target: { value: '2023-08-31' },
      });
      act(() => vi.advanceTimersByTime(500));

      expectSingleChanged('Docket Complete Date Range Filter Changed');
      expect(changedCalls('Docket Date Range Start Only Filter Changed')).toHaveLength(0);
      expect(changedCalls('Docket Date Range End Only Filter Changed')).toHaveLength(0);
    });

    test('fires Docket Date Range Start Only Filter Cleared when the start date is directly cleared', async () => {
      await renderAndNavigateToDocket();

      fireEvent.change(screen.getByTestId('docket-date-range-date-start'), {
        target: { value: '2023-07-01' },
      });
      act(() => vi.advanceTimersByTime(500));
      mockTrackEvent.mockReset();

      fireEvent.change(screen.getByTestId('docket-date-range-date-start'), {
        target: { value: '' },
      });
      act(() => vi.advanceTimersByTime(500));

      expectSingleCleared('Docket Date Range Start Only Filter Cleared');
    });

    test('fires Docket Date Range End Only Filter Cleared when the end date is directly cleared', async () => {
      await renderAndNavigateToDocket();

      fireEvent.change(screen.getByTestId('docket-date-range-date-end'), {
        target: { value: '2023-08-31' },
      });
      act(() => vi.advanceTimersByTime(500));
      mockTrackEvent.mockReset();

      fireEvent.change(screen.getByTestId('docket-date-range-date-end'), {
        target: { value: '' },
      });
      act(() => vi.advanceTimersByTime(500));

      expectSingleCleared('Docket Date Range End Only Filter Cleared');
    });

    test('fires Docket Complete Date Range Filter Cleared when both bounds are cleared', async () => {
      await renderAndNavigateToDocket();

      fireEvent.change(screen.getByTestId('docket-date-range-date-end'), {
        target: { value: '2023-08-31' },
      });
      fireEvent.change(screen.getByTestId('docket-date-range-date-start'), {
        target: { value: '2023-07-01' },
      });
      act(() => vi.advanceTimersByTime(500));
      mockTrackEvent.mockReset();

      fireEvent.change(screen.getByTestId('docket-date-range-date-start'), {
        target: { value: '' },
      });
      fireEvent.change(screen.getByTestId('docket-date-range-date-end'), {
        target: { value: '' },
      });
      act(() => vi.advanceTimersByTime(500));

      expectSingleCleared('Docket Complete Date Range Filter Cleared');
    });

    test('fires Docket Date Range End Only Filter Changed (not Cleared) when only the start date is cleared from a complete range', async () => {
      await renderAndNavigateToDocket();

      fireEvent.change(screen.getByTestId('docket-date-range-date-end'), {
        target: { value: '2023-08-31' },
      });
      fireEvent.change(screen.getByTestId('docket-date-range-date-start'), {
        target: { value: '2023-07-01' },
      });
      act(() => vi.advanceTimersByTime(500));
      mockTrackEvent.mockReset();

      fireEvent.change(screen.getByTestId('docket-date-range-date-start'), {
        target: { value: '' },
      });
      act(() => vi.advanceTimersByTime(500));

      expectSingleChanged('Docket Date Range End Only Filter Changed');
      expect(clearedCalls('Docket Date Range Start Only Filter Cleared')).toHaveLength(0);
      expect(clearedCalls('Docket Complete Date Range Filter Cleared')).toHaveLength(0);
    });

    test('fires Docket Date Range Start Only Filter Changed (not Cleared) when only the end date is cleared from a complete range', async () => {
      await renderAndNavigateToDocket();

      fireEvent.change(screen.getByTestId('docket-date-range-date-end'), {
        target: { value: '2023-08-31' },
      });
      fireEvent.change(screen.getByTestId('docket-date-range-date-start'), {
        target: { value: '2023-07-01' },
      });
      act(() => vi.advanceTimersByTime(500));
      mockTrackEvent.mockReset();

      fireEvent.change(screen.getByTestId('docket-date-range-date-end'), {
        target: { value: '' },
      });
      act(() => vi.advanceTimersByTime(500));

      expectSingleChanged('Docket Date Range Start Only Filter Changed');
      expect(clearedCalls('Docket Date Range End Only Filter Cleared')).toHaveLength(0);
      expect(clearedCalls('Docket Complete Date Range Filter Cleared')).toHaveLength(0);
    });

    describe('Date Range debounce override (temporary, CAMS-850)', () => {
      afterEach(() => {
        window.history.pushState({}, '', '/');
      });

      test('delays Date Range Changed until the overridden debounce elapses, not the default 500ms', async () => {
        window.history.pushState({}, '', '?dateRangeDebounceMs=1500');
        await renderAndNavigateToDocket();

        fireEvent.change(screen.getByTestId('docket-date-range-date-start'), {
          target: { value: '2023-07-01' },
        });
        act(() => vi.advanceTimersByTime(500));

        expect(changedCalls('Docket Date Range Start Only Filter Changed')).toHaveLength(0);

        act(() => vi.advanceTimersByTime(1000));

        expectSingleChanged('Docket Date Range Start Only Filter Changed');
      });

      test('leaves Text Search at its own 500ms debounce even when a Date Range override is present', async () => {
        window.history.pushState({}, '', '?dateRangeDebounceMs=1500');
        await renderAndNavigateToDocket();

        typeAndWait('basic-search-field', 'motion');

        expectSingleChanged('Docket Text Search Filter Changed');
      });

      test('falls back to 500ms when dateRangeDebounceMs is not a valid non-negative number', async () => {
        window.history.pushState({}, '', '?dateRangeDebounceMs=not-a-number');
        await renderAndNavigateToDocket();

        fireEvent.change(screen.getByTestId('docket-date-range-date-start'), {
          target: { value: '2023-07-01' },
        });
        act(() => vi.advanceTimersByTime(500));

        expectSingleChanged('Docket Date Range Start Only Filter Changed');
      });
    });

    test('Clear All Filters fires one Docket All Filters Cleared event and suppresses per-field Cleared when filters were active', async () => {
      await renderAndNavigateToDocket();
      const docketFacetContainer = screen.getByTestId('facet-multi-select-container-test-id');

      typeAndWait('basic-search-field', 'motion');
      const expandButton = screen.getByTestId('button-facet-multi-select-expand');
      fireEvent.click(expandButton);
      const item0 = docketFacetContainer.querySelector('li');
      fireEvent.click(item0!);
      fireEvent.click(expandButton);
      mockTrackEvent.mockReset();

      clearAllAndFlush();

      expectSingleCleared('Docket All Filters Cleared');
      expect(clearedCalls('Docket Text Search Filter Cleared')).toHaveLength(0);
      expect(clearedCalls('Docket Summary Filter Cleared')).toHaveLength(0);
      expect(clearedCalls('Docket Document Number Filter Cleared')).toHaveLength(0);
      expect(clearedCalls('Docket Date Range Start Only Filter Cleared')).toHaveLength(0);
      expect(clearedCalls('Docket Date Range End Only Filter Cleared')).toHaveLength(0);
      expect(clearedCalls('Docket Complete Date Range Filter Cleared')).toHaveLength(0);
    });

    test('Clear All Filters fires nothing when no filters were active', async () => {
      await renderAndNavigateToDocket();
      mockTrackEvent.mockReset();

      clearAllAndFlush();

      expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    test("manually clearing a field after a prior Clear-All still fires that field's own Cleared event", async () => {
      await renderAndNavigateToDocket();
      typeAndWait('basic-search-field', 'motion');
      clearAllAndFlush();
      mockTrackEvent.mockReset();

      typeAndWait('basic-search-field', 'motion');
      mockTrackEvent.mockReset();
      typeAndWait('basic-search-field', '');

      expectSingleCleared('Docket Text Search Filter Cleared');
    });

    test('fires Docket Filters Combination Changed with the active field list when one filter is used', async () => {
      await renderAndNavigateToDocket();
      const docketFacetContainer = screen.getByTestId('facet-multi-select-container-test-id');

      const expandButton = screen.getByTestId('button-facet-multi-select-expand');
      fireEvent.click(expandButton);
      const item0 = docketFacetContainer.querySelector('li');
      fireEvent.click(item0!);
      fireEvent.click(expandButton);
      act(() => vi.advanceTimersByTime(500));

      const calls = changedCalls('Docket Filters Combination Changed');
      expect(calls).toHaveLength(1);
      expect(calls[0][1]).toEqual({ filters: 'Summary' });
    });

    test('fires Docket Filters Combination Changed with a joined field list when two filters are used together', async () => {
      await renderAndNavigateToDocket();
      const docketFacetContainer = screen.getByTestId('facet-multi-select-container-test-id');

      typeAndWait('basic-search-field', 'motion');
      const expandButton = screen.getByTestId('button-facet-multi-select-expand');
      fireEvent.click(expandButton);
      const item0 = docketFacetContainer.querySelector('li');
      fireEvent.click(item0!);
      fireEvent.click(expandButton);
      act(() => vi.advanceTimersByTime(500));

      const calls = changedCalls('Docket Filters Combination Changed');
      expect(calls[calls.length - 1][1]).toEqual({ filters: 'TextSearch,Summary' });
    });

    test('fires Docket Filters Combination Cleared when the last active filter is manually cleared', async () => {
      await renderAndNavigateToDocket();
      typeAndWait('basic-search-field', 'motion');
      mockTrackEvent.mockReset();

      typeAndWait('basic-search-field', '');

      expectSingleCleared('Docket Filters Combination Cleared');
    });

    test('Clear All Filters also suppresses Docket Filters Combination Cleared when filters were active', async () => {
      await renderAndNavigateToDocket();
      typeAndWait('basic-search-field', 'motion');
      mockTrackEvent.mockReset();

      clearAllAndFlush();

      expect(clearedCalls('Docket Filters Combination Cleared')).toHaveLength(0);
      expectSingleCleared('Docket All Filters Cleared');
    });

    test('fires Docket Filters Combination Changed with DateRangeStartOnly when only the start date is set', async () => {
      await renderAndNavigateToDocket();

      fireEvent.change(screen.getByTestId('docket-date-range-date-start'), {
        target: { value: '2023-07-01' },
      });
      act(() => vi.advanceTimersByTime(500));

      const calls = changedCalls('Docket Filters Combination Changed');
      expect(calls).toHaveLength(1);
      expect(calls[0][1]).toEqual({ filters: 'DateRangeStartOnly' });
    });

    test('fires Docket Filters Combination Changed with DateRangeComplete when both start and end are set', async () => {
      await renderAndNavigateToDocket();

      fireEvent.change(screen.getByTestId('docket-date-range-date-end'), {
        target: { value: '2023-08-31' },
      });
      fireEvent.change(screen.getByTestId('docket-date-range-date-start'), {
        target: { value: '2023-07-01' },
      });
      act(() => vi.advanceTimersByTime(500));

      const calls = changedCalls('Docket Filters Combination Changed');
      expect(calls[calls.length - 1][1]).toEqual({ filters: 'DateRangeComplete' });
    });

    test('never includes raw filter values in the combination event properties', async () => {
      await renderAndNavigateToDocket();
      typeAndWait('basic-search-field', 'sensitive-debtor-name');

      const calls = changedCalls('Docket Filters Combination Changed');
      for (const call of calls) {
        expect(JSON.stringify(call)).not.toContain('sensitive-debtor-name');
      }
    });
  });
});
