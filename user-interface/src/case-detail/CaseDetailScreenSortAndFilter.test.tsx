import { CaseDocket, CaseNote } from '@common/cams/cases';
import { MockData } from '@common/cams/test-utilities/mock-data';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReactRouter from 'react-router';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe } from 'vitest';
import { vi } from 'vitest';

import CaseDetailScreen, {
  applyDocketEntrySortAndFilters,
  findDocketLimits,
  getSummaryFacetList,
} from './CaseDetailScreen';

const testCaseDocketEntries: CaseDocket = [
  {
    dateFiled: '2023-05-07',
    documentNumber: 1,
    fullText: 'Docket entry number 1.',
    sequenceNumber: 2,
    summaryText: 'Add Judge',
  },
  {
    dateFiled: '2023-06-07',
    fullText: 'Docket entry number 2.',
    sequenceNumber: 3,
    summaryText: 'Motion',
  },
  {
    dateFiled: '2023-07-07',
    documentNumber: 2,
    documents: [
      {
        fileExt: 'pdf',
        fileLabel: '0-0',
        fileSize: 1000,
        fileUri: 'https://somehost.gov/pdf/0000-111111-3-0-0.pdf',
      },
    ],
    fullText: 'Docket entry number 3.',
    sequenceNumber: 4,
    summaryText: 'Add Attorney',
  },
  {
    dateFiled: '2023-08-07',
    fullText: 'Docket entry number 4.',
    sequenceNumber: 5,
    summaryText: 'Motion',
  },
];
const testCaseNotes: CaseNote[] = [];

describe('Case Detail sort, search, and filter tests', () => {
  const testCaseId = '111-11-12345';

  const testCaseDetail = MockData.getCaseDetail({ override: { caseId: testCaseId } });

  describe('display tests', () => {
    test('should display sort and filter panel when navigated to docket entries', async () => {
      const basicInfoPath = `/case-detail/${testCaseId}/`;

      render(
        <MemoryRouter initialEntries={[basicInfoPath]}>
          <Routes>
            <Route
              element={
                <CaseDetailScreen
                  caseDetail={testCaseDetail}
                  caseDocketEntries={testCaseDocketEntries}
                  caseNotes={testCaseNotes}
                />
              }
              path="case-detail/:caseId/*"
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
        const docketEntryLink = screen.getByTestId('court-docket-link');
        expect(docketEntryLink).toBeInTheDocument();
      });

      const docketEntryLink = screen.getByTestId('court-docket-link');
      expect(docketEntryLink).toBeInTheDocument();
      await userEvent.click(docketEntryLink);
      await waitFor(() => {
        sortButton = screen.queryByTestId(sortButtonId);
        expect(sortButton).toBeInTheDocument();
        searchInput = screen.queryByTestId(searchInputId);
        expect(searchInput).toBeInTheDocument();
      });

      const basicInfoLink = screen.getByTestId('case-overview-link');
      await userEvent.click(basicInfoLink as Element);
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
              element={
                <CaseDetailScreen
                  caseDetail={testCaseDetail}
                  caseDocketEntries={testCaseDocketEntries}
                  caseNotes={testCaseNotes}
                />
              }
              path="case-detail/:caseId/court-docket"
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
              element={
                <CaseDetailScreen
                  caseDetail={testCaseDetail}
                  caseDocketEntries={testCaseDocketEntries}
                  caseNotes={testCaseNotes}
                />
              }
              path="case-detail/:caseId/*"
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
              element={
                <CaseDetailScreen
                  caseDetail={testCaseDetail}
                  caseDocketEntries={testCaseDocketEntries}
                  caseNotes={testCaseNotes}
                />
              }
              path="case-detail/:caseId/court-docket"
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
          dateFiled,
          fullText: 'Docket entry number 1.',
          sequenceNumber: 2,
          summaryText: 'Add Judge',
        },
      ]);
      expect(limits.dateRange.start).toEqual(dateFiled);
      expect(limits.dateRange.end).toEqual(dateFiled);
      expect(limits.documentRange.first).toEqual(0);
      expect(limits.documentRange.last).toEqual(0);
    });

    test('should filter the list of docket entries per the search text', async () => {
      const { alertOptions, filteredDocketEntries } = applyDocketEntrySortAndFilters(
        testCaseDocketEntries,
        {
          documentNumber: null,
          searchInDocketText: 'number 2',
          selectedDateRange: {},
          selectedFacets: [],
          sortDirection: 'Oldest',
        },
      );

      expect(filteredDocketEntries?.length).toEqual(1);
      const actualEntry = filteredDocketEntries ? filteredDocketEntries[0] : null;
      expect(actualEntry).toEqual(testCaseDocketEntries[1]);

      expect(alertOptions).toBeUndefined();
    });

    test('should filter the list of docket entries per the selected facets', async () => {
      const { alertOptions, filteredDocketEntries } = applyDocketEntrySortAndFilters(
        testCaseDocketEntries,
        {
          documentNumber: null,
          searchInDocketText: '',
          selectedDateRange: {},
          selectedFacets: [
            testCaseDocketEntries[1].summaryText,
            testCaseDocketEntries[3].summaryText,
          ],
          sortDirection: 'Oldest',
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
      const { alertOptions, filteredDocketEntries } = applyDocketEntrySortAndFilters(
        docketEntries,
        {
          documentNumber: null,
          searchInDocketText: '',
          selectedDateRange: {},
          selectedFacets: [],
          sortDirection: 'Oldest',
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
      const { alertOptions, filteredDocketEntries } = applyDocketEntrySortAndFilters(
        docketEntries,
        {
          documentNumber: null,
          searchInDocketText: '',
          selectedDateRange: {},
          selectedFacets: [],
          sortDirection: 'Newest',
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
          'Add Judge',
          {
            count: 2,
            text: 'Add Judge',
          },
        ],
        [
          'Case Association - Joint Administration',
          {
            count: 2,
            text: 'Case Association - Joint Administration',
          },
        ],
        [
          'Motion for Joint Administration',
          {
            count: 5,
            text: 'Motion for Joint Administration',
          },
        ],
        [
          'Order Re: Motion for Joint Administration',
          {
            count: 1,
            text: 'Order Re: Motion for Joint Administration',
          },
        ],
      ]);

      const expectedFacets = [
        { label: 'Add Judge (2)', value: 'Add Judge' },
        {
          label: 'Case Association - Joint Administration (2)',
          value: 'Case Association - Joint Administration',
        },
        {
          label: 'Motion for Joint Administration (5)',
          value: 'Motion for Joint Administration',
        },
        {
          label: 'Order Re: Motion for Joint Administration (1)',
          value: 'Order Re: Motion for Joint Administration',
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
              element={
                <CaseDetailScreen
                  caseDetail={testCaseDetail}
                  caseDocketEntries={testCaseDocketEntries}
                  caseNotes={testCaseNotes}
                />
              }
              path="case-detail/:caseId/*"
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
              element={
                <CaseDetailScreen
                  caseDetail={testCaseDetail}
                  caseDocketEntries={testCaseDocketEntries}
                  caseNotes={testCaseNotes}
                />
              }
              path="case-detail/:caseId/*"
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
              element={
                <CaseDetailScreen
                  caseDetail={testCaseDetail}
                  caseDocketEntries={testCaseDocketEntries}
                  caseNotes={testCaseNotes}
                />
              }
              path="case-detail/:caseId/*"
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
              element={
                <CaseDetailScreen
                  caseDetail={testCaseDetail}
                  caseDocketEntries={testCaseDocketEntries}
                  caseNotes={testCaseNotes}
                />
              }
              path="case-detail/:caseId/*"
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
      fireEvent.change(startDateText, { target: { value: '2023-07-01' } });

      const docketListAfter = screen.getByTestId('searchable-docket');
      expect(docketListAfter.children.length).toEqual(2);
    });

    test('should list proper dockets when start date changes', async () => {
      const basicInfoPath = `/case-detail/${testCaseId}/`;

      render(
        <MemoryRouter initialEntries={[basicInfoPath]}>
          <Routes>
            <Route
              element={
                <CaseDetailScreen
                  caseDetail={testCaseDetail}
                  caseDocketEntries={testCaseDocketEntries}
                  caseNotes={testCaseNotes}
                />
              }
              path="case-detail/:caseId/*"
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
      const endDateText = screen.getByTestId('docket-date-range-date-end');
      fireEvent.change(endDateText, { target: { value: '2023-07-01' } });

      const docketListAfter = screen.getByTestId('searchable-docket');
      expect(docketListAfter.children.length).toEqual(2);
    });
  });

  describe('Clear Filters', () => {
    test('clear filter fields when clear filters button is clicked', async () => {
      const basicInfoPath = `/case-detail/${testCaseId}/`;

      render(
        <MemoryRouter initialEntries={[basicInfoPath]}>
          <Routes>
            <Route
              element={
                <CaseDetailScreen
                  caseDetail={testCaseDetail}
                  caseDocketEntries={testCaseDocketEntries}
                  caseNotes={testCaseNotes}
                />
              }
              path="case-detail/:caseId/*"
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
});
