import { describe } from 'vitest';
import { render, waitFor, screen, fireEvent } from '@testing-library/react';
import { CaseDetail } from './CaseDetailScreen';
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
