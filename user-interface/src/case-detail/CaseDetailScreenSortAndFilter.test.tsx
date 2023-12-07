import { describe } from 'vitest';
import { render, waitFor, screen, fireEvent } from '@testing-library/react';
import { applySortAndFilters, CaseDetail, getSummaryFacetList } from './CaseDetailScreen';
import { CaseDetailType, CaseDocket } from '@/lib/type-declarations/chapter-15';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import * as FeatureFlags from '@/lib/hooks/UseFeatureFlags';
import { vi } from 'vitest';
import ReactRouter from 'react-router';

describe('Case Detail sort, search, and filter tests', () => {
  const testCaseId = '111-11-12345';

  const testCaseDetail: CaseDetailType = {
    caseId: testCaseId,
    chapter: '15',
    officeName: 'Redondo Beach',
    caseTitle: 'The Beach Boys',
    dateFiled: '01-04-1962',
    judgeName: 'some judge',
    debtorTypeLabel: 'Corporate Business',
    petitionLabel: 'Voluntary Petition',
    closedDate: '01-08-1963',
    dismissedDate: '01-08-1964',
    assignments: [],
    debtor: {
      name: 'Roger Rabbit',
    },
    debtorAttorney: {
      name: 'Jane Doe',
      address1: '123 Rabbithole Lane',
      cityStateZipCountry: 'Ciudad Obregón GR 25443, MX',
      phone: '234-123-1234',
    },
  };

  const testCaseDocketEntries: CaseDocket = [
    {
      sequenceNumber: 2,
      documentNumber: 1,
      dateFiled: '2023-05-07T00:00:00.0000000',
      summaryText: 'Add Judge',
      fullText: 'Docket entry number 1.',
    },
    {
      sequenceNumber: 3,
      dateFiled: '2023-05-07T00:00:00.0000000',
      summaryText: 'Motion',
      fullText: 'Docket entry number 2.',
    },
    {
      sequenceNumber: 4,
      documentNumber: 2,
      dateFiled: '2023-07-07T00:00:00.0000000',
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
      dateFiled: '2023-05-07T00:00:00.0000000',
      summaryText: 'Motion',
      fullText: 'Docket entry number 4.',
    },
  ];

  describe('display tests', () => {
    test('should display sort and filter panel when navigated to docket entries', async () => {
      const basicInfoPath = `/case-detail/${testCaseId}/`;

      render(
        <MemoryRouter initialEntries={[basicInfoPath]}>
          <Routes>
            <Route
              path="case-detail/:id/*"
              element={
                <CaseDetail caseDetail={testCaseDetail} caseDocketEntries={testCaseDocketEntries} />
              }
            />
          </Routes>
        </MemoryRouter>,
      );

      let basicInfoLink;
      let docketEntryLink;
      const sortButtonId = 'docket-entry-sort';
      let sortButton: HTMLElement | null;
      const searchInputId = 'docket-entry-search';
      let searchInput: HTMLElement | null;

      await waitFor(() => {
        sortButton = screen.queryByTestId(sortButtonId);
        expect(sortButton).not.toBeInTheDocument();
        searchInput = screen.queryByTestId(searchInputId);
        expect(searchInput).not.toBeInTheDocument();
      });

      await waitFor(() => {
        docketEntryLink = screen.getByTestId('court-docket-link');
        fireEvent.click(docketEntryLink as Element);
        sortButton = screen.queryByTestId(sortButtonId);
        expect(sortButton).toBeInTheDocument();
        searchInput = screen.queryByTestId(searchInputId);
        expect(searchInput).toBeInTheDocument();
      });

      await waitFor(() => {
        basicInfoLink = screen.getByTestId('basic-info-link');
        fireEvent.click(basicInfoLink as Element);
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
              path="case-detail/:id/court-docket"
              element={
                <CaseDetail caseDetail={testCaseDetail} caseDocketEntries={testCaseDocketEntries} />
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

      await waitFor(() => {
        const basicInfoLink = screen.getByTestId('basic-info-link');
        fireEvent.click(basicInfoLink as Element);
        sortButton = screen.queryByTestId(sortButtonId);
        expect(sortButton).not.toBeInTheDocument();
        searchInput = screen.queryByTestId(searchInputId);
        expect(searchInput).not.toBeInTheDocument();
      });
    });

    test('should display filter select when navigated to docket entries', async () => {
      vi.spyOn(FeatureFlags, 'default').mockReturnValue({ 'docket-filter-enabled': true });

      const basicInfoPath = `/case-detail/${testCaseId}/`;

      render(
        <MemoryRouter initialEntries={[basicInfoPath]}>
          <Routes>
            <Route
              path="case-detail/:id/*"
              element={
                <CaseDetail caseDetail={testCaseDetail} caseDocketEntries={testCaseDocketEntries} />
              }
            />
          </Routes>
        </MemoryRouter>,
      );

      let basicInfoLink;
      let docketEntryLink;
      const filterSelectClass = '.docket-summary-facets';
      let filterSelectElement: HTMLElement | null;

      await waitFor(() => {
        filterSelectElement = document.querySelector(filterSelectClass);
        expect(filterSelectElement).not.toBeInTheDocument();
      });

      await waitFor(() => {
        docketEntryLink = screen.getByTestId('court-docket-link');
        fireEvent.click(docketEntryLink as Element);
        filterSelectElement = document.querySelector(filterSelectClass);
        expect(filterSelectElement).toBeInTheDocument();
      });

      await waitFor(() => {
        basicInfoLink = screen.getByTestId('basic-info-link');
        fireEvent.click(basicInfoLink as Element);
        filterSelectElement = document.querySelector(filterSelectClass);
        expect(filterSelectElement).not.toBeInTheDocument();
      });
    });

    test('should not display filter select when navigated to basic info', async () => {
      vi.spyOn(ReactRouter, 'useParams').mockReturnValue({ caseId: testCaseId });
      vi.spyOn(FeatureFlags, 'default').mockReturnValue({ 'docket-filter-enabled': true });

      const docketEntryPath = `/case-detail/${testCaseId}/court-docket`;

      render(
        <MemoryRouter initialEntries={[docketEntryPath]}>
          <Routes>
            <Route
              path="case-detail/:id/court-docket"
              element={
                <CaseDetail caseDetail={testCaseDetail} caseDocketEntries={testCaseDocketEntries} />
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

      await waitFor(() => {
        const basicInfoLink = screen.getByTestId('basic-info-link');
        fireEvent.click(basicInfoLink as Element);
        filterSelectElement = document.querySelector(filterSelectClass);
        expect(filterSelectElement).not.toBeInTheDocument();
      });
    });

    test('should not display filter when feature flag is off', async () => {
      vi.spyOn(ReactRouter, 'useParams').mockReturnValue({ caseId: testCaseId });
      vi.spyOn(FeatureFlags, 'default').mockReturnValue({ 'docket-filter-enabled': false });

      const docketEntryPath = `/case-detail/${testCaseId}/court-docket`;

      render(
        <MemoryRouter initialEntries={[docketEntryPath]}>
          <Routes>
            <Route
              path="case-detail/:id/court-docket"
              element={
                <CaseDetail caseDetail={testCaseDetail} caseDocketEntries={testCaseDocketEntries} />
              }
            />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(async () => {
        const filterSelect = document.querySelector('.docket-summary-facets');
        expect(filterSelect).not.toBeInTheDocument();
      });
    });
  });

  describe('sort, search, and filter tests', () => {
    const testCaseDocketEntries: CaseDocket = [
      {
        sequenceNumber: 2,
        documentNumber: 1,
        dateFiled: '2023-05-07T00:00:00.0000000',
        summaryText: 'Add Judge',
        fullText: 'Docket entry number 1.',
      },
      {
        sequenceNumber: 3,
        dateFiled: '2023-05-07T00:00:00.0000000',
        summaryText: 'Motion',
        fullText: 'Docket entry number 2.',
      },
      {
        sequenceNumber: 4,
        documentNumber: 2,
        dateFiled: '2023-07-07T00:00:00.0000000',
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
        dateFiled: '2023-05-07T00:00:00.0000000',
        summaryText: 'Motion',
        fullText: 'Docket entry number 4.',
      },
    ];

    test('should filter the list of docket entries per the search text', async () => {
      const { filteredDocketEntries, alertOptions } = applySortAndFilters(testCaseDocketEntries, {
        searchInDocketText: 'number 2',
        selectedFacets: [],
        sortDirection: 'Oldest',
        documentNumber: null,
        selectedDateRange: {},
      });

      expect(filteredDocketEntries?.length).toEqual(1);
      const actualEntry = filteredDocketEntries ? filteredDocketEntries[0] : null;
      expect(actualEntry).toEqual(testCaseDocketEntries[1]);

      expect(alertOptions).toBeUndefined();
    });

    test('should filter the list of docket entries per the selected facets', async () => {
      const { filteredDocketEntries, alertOptions } = applySortAndFilters(testCaseDocketEntries, {
        searchInDocketText: '',
        selectedFacets: [
          testCaseDocketEntries[1].summaryText,
          testCaseDocketEntries[3].summaryText,
        ],
        sortDirection: 'Oldest',
        documentNumber: null,
        selectedDateRange: {},
      });

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
      const { filteredDocketEntries, alertOptions } = applySortAndFilters(docketEntries, {
        searchInDocketText: '',
        selectedFacets: [],
        sortDirection: 'Oldest',
        documentNumber: null,
        selectedDateRange: {},
      });

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
      const { filteredDocketEntries, alertOptions } = applySortAndFilters(docketEntries, {
        searchInDocketText: '',
        selectedFacets: [],
        sortDirection: 'Newest',
        documentNumber: null,
        selectedDateRange: {},
      });

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
});
