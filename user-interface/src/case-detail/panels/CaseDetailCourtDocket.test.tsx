import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import CaseDetailCourtDocket, {
  docketSorterClosure,
  fileSizeDescription,
  generateDocketFilenameDisplay,
} from '@/case-detail/panels/CaseDetailCourtDocket';
import * as FeatureFlags from '@/lib/hooks/UseFeatureFlags';
import {
  CaseDocket,
  CaseDocketEntry,
  CaseDocketEntryDocument,
} from '@/lib/type-declarations/chapter-15';

describe('court docket panel tests', () => {
  const docketEntries: CaseDocket = [
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
  ];
  const lastIndex = docketEntries.length - 1;

  test('should render loading info when isLoading is true', () => {
    render(
      <BrowserRouter>
        <CaseDetailCourtDocket caseId="081-12-12345" docketEntries={undefined} />
      </BrowserRouter>,
    );

    const isLoading = screen.getByTestId('loading-indicator');

    expect(isLoading).toBeInTheDocument();
  });

  test('should render docket entries when provided', () => {
    const documentNumberOne = docketEntries[lastIndex].documentNumber;
    render(
      <BrowserRouter>
        <CaseDetailCourtDocket caseId="081-12-12345" docketEntries={docketEntries} />
      </BrowserRouter>,
    );

    const isLoading = screen.queryByTestId('loading-indicator');
    expect(isLoading).not.toBeInTheDocument();

    const docketEntry1 = screen.getByTestId('docket-entry-0');
    const docketEntry2 = screen.getByTestId('docket-entry-1');
    expect(docketEntry1).toBeInTheDocument();
    expect(docketEntry2).toBeInTheDocument();

    const docketEntry1DocumentNumber = screen.getByTestId('docket-entry-0-number');
    expect(docketEntry1DocumentNumber).toHaveTextContent(documentNumberOne?.toString() || '');
    const docketEntry1Header = screen.getByTestId('docket-entry-0-header');
    expect(docketEntry1Header.innerHTML).toEqual(
      docketEntries[lastIndex].dateFiled + ' - ' + docketEntries[lastIndex].summaryText,
    );
    const docketEntry1Text = screen.getByTestId('docket-entry-0-text');
    expect(docketEntry1Text.innerHTML).toEqual(docketEntries[lastIndex].fullText);

    const docketEntry2DocumentNumber = screen.getByTestId('docket-entry-1-number');
    expect(docketEntry2DocumentNumber.innerHTML).toEqual('');
  });

  test('should render docket search when the feature is turned on and there are docket entries', async () => {
    vi.spyOn(FeatureFlags, 'default').mockReturnValue({ 'docket-search-enabled': true });
    render(
      <BrowserRouter>
        <CaseDetailCourtDocket caseId="081-12-12345" docketEntries={docketEntries} />
      </BrowserRouter>,
    );

    const searchInput = screen.queryByTestId('basic-search-field');
    expect(searchInput).toBeInTheDocument();
  });

  test('should filter the list of docket entries per the search text', async () => {
    vi.spyOn(FeatureFlags, 'default').mockReturnValue({ 'docket-search-enabled': true });

    render(
      <BrowserRouter>
        <CaseDetailCourtDocket caseId="081-12-12345" docketEntries={docketEntries} />
      </BrowserRouter>,
    );

    const searchableDocketId = 'searchable-docket';
    const startingDocket = screen.getByTestId(searchableDocketId);
    expect(startingDocket.childElementCount).toEqual(docketEntries.length);

    const searchInput = screen.getByTestId('basic-search-field');
    fireEvent.change(searchInput, { target: { value: 'number 2' } });

    const filteredDocket = screen.getByTestId(searchableDocketId);
    expect(filteredDocket.childElementCount).toEqual(1);
  });

  test('should highlight search text', async () => {
    vi.spyOn(FeatureFlags, 'default').mockReturnValue({ 'docket-search-enabled': true });

    render(
      <BrowserRouter>
        <CaseDetailCourtDocket caseId="081-12-12345" docketEntries={docketEntries} />
      </BrowserRouter>,
    );

    const docketEntryClassName = 'docket-entry';
    const docketEntryElements = document.getElementsByClassName(docketEntryClassName);
    expect(docketEntryElements.length).toEqual(docketEntries.length);

    const searchInput = screen.getByTestId('basic-search-field');
    fireEvent.change(searchInput, { target: { value: 'number 2' } });

    const filteredDocketEntryElements = document.getElementsByClassName(docketEntryClassName);
    expect(filteredDocketEntryElements.length).toEqual(1);
  });

  test('should sort docket entries', async () => {
    vi.spyOn(FeatureFlags, 'default').mockReturnValue({ 'docket-search-enabled': true });

    const youngestEntry = docketEntries[2];
    const middleEntry = docketEntries[1];
    const oldestEntry = docketEntries[0];
    const sortedListFromApi = [oldestEntry, middleEntry, youngestEntry];

    render(
      <BrowserRouter>
        <CaseDetailCourtDocket caseId="081-12-12345" docketEntries={sortedListFromApi} />
      </BrowserRouter>,
    );

    const sortButtonId = 'docket-entry-sort';

    // Check to make sure all the entries are in the HTML list.
    const startingDocket = screen.getByTestId('searchable-docket');
    const sortButton = screen.getByTestId(sortButtonId);
    expect(startingDocket.childElementCount).toEqual(docketEntries.length);

    // First Sort - oldest goes to the top of the list.
    fireEvent.click(sortButton);
    if (oldestEntry.documentNumber) {
      expect(screen.getByTestId('docket-entry-0-number').textContent).toEqual(
        oldestEntry.documentNumber?.toString(),
      );
    }
    expect(screen.getByTestId('docket-entry-0-header').textContent).toEqual(
      oldestEntry.dateFiled + ' - ' + oldestEntry.summaryText,
    );
    expect(screen.getByTestId('docket-entry-0-text').textContent).toEqual(oldestEntry.fullText);
    if (oldestEntry.documents) {
      expect(screen.getByTestId('document-unordered-list').childElementCount).toEqual(
        oldestEntry.documents?.length,
      );
    }

    // Second Sort - youngest returns to the top of the list.
    fireEvent.click(sortButton);
    if (youngestEntry.documentNumber) {
      expect(screen.getByTestId('docket-entry-0-number').textContent).toEqual(
        youngestEntry.documentNumber?.toString(),
      );
    }
    expect(screen.getByTestId('docket-entry-0-header').textContent).toEqual(
      youngestEntry.dateFiled + ' - ' + youngestEntry.summaryText,
    );
    expect(screen.getByTestId('docket-entry-0-text').textContent).toEqual(youngestEntry.fullText);
    if (youngestEntry.documents) {
      expect(screen.getByTestId('document-unordered-list').childElementCount).toEqual(
        youngestEntry.documents?.length,
      );
    }
  });

  describe('Link formatting', () => {
    test('should properly format a normal document', () => {
      const document: CaseDocketEntryDocument = {
        fileUri: 'http://somehost.gov/pdf/0000-111111-2-2-0.pdf',
        fileSize: 1000,
        fileLabel: '2-0',
        fileExt: 'pdf',
      };
      const expectedLinkText = 'View 2-0 [PDF, 1000 bytes]';
      const actualLinkText = generateDocketFilenameDisplay(document);
      expect(actualLinkText).toEqual(expectedLinkText);
    });
    test('should properly format a document missing an extension', () => {
      const document: CaseDocketEntryDocument = {
        fileUri: 'http://somehost.gov/pdf/0000-111111-2-2-0.pdf',
        fileSize: 1000,
        fileLabel: '2-0',
      };
      const expectedLinkText = 'View 2-0 [1000 bytes]';
      const actualLinkText = generateDocketFilenameDisplay(document);
      expect(actualLinkText).toEqual(expectedLinkText);
    });
  });

  describe('File size desciption', () => {
    test('should show byte size if less than a KB', () => {
      const expectedDescription = '1000 bytes';
      const actualDescription = fileSizeDescription(1000);
      expect(actualDescription).toEqual(expectedDescription);
    });
    test('should show KB file size if less than a MB', () => {
      const expectedDescription = '2.0 KB';
      const actualDescription = fileSizeDescription(2000);
      expect(actualDescription).toEqual(expectedDescription);
    });
    test('should show MB file size if less than a GB', () => {
      const expectedDescription = '1.0 MB';
      const actualDescription = fileSizeDescription(1100000);
      expect(actualDescription).toEqual(expectedDescription);
    });
    test('should show GB file size if greather than or equal to a GB', () => {
      const expectedDescription = '1.0 GB';
      const actualDescription = fileSizeDescription(1100000000);
      expect(actualDescription).toEqual(expectedDescription);
    });
  });

  describe('Docket entry sorter', () => {
    const left: CaseDocketEntry = {
      sequenceNumber: 0,
      dateFiled: '',
      summaryText: '',
      fullText: '',
    };
    const right: CaseDocketEntry = {
      sequenceNumber: 1,
      dateFiled: '',
      summaryText: '',
      fullText: '',
    };
    test('should return the expected sort direction for Newest sort', () => {
      const fn = docketSorterClosure('Newest');
      const expectedValue = 1;
      expect(fn(left, right)).toEqual(expectedValue);
    });
    test('should return the expected sort direction for Oldest sort', () => {
      const fn = docketSorterClosure('Oldest');
      const expectedValue = -1;
      expect(fn(left, right)).toEqual(expectedValue);
    });
  });

  describe('No docket entry alert tests', () => {
    test('should display alert when no docket entries are found', async () => {
      render(
        <BrowserRouter>
          <CaseDetailCourtDocket caseId="081-12-12345" docketEntries={[]} />
        </BrowserRouter>,
      );

      const alertContainer = await screen.findByTestId('alert-container');
      expect(alertContainer).toBeInTheDocument();
      expect(alertContainer.className).toContain('inline-alert');

      const alert = await screen.findByTestId('alert');
      expect(alert.className).toContain('usa-alert__visible');
    });

    test('should not display alert when docket entries are found', async () => {
      render(
        <BrowserRouter>
          <CaseDetailCourtDocket caseId="081-12-12345" docketEntries={docketEntries} />
        </BrowserRouter>,
      );

      const alertContainer = await screen.findByTestId('alert-container');
      expect(alertContainer).toBeInTheDocument();
      expect(alertContainer.className).not.toContain('inline-alert');

      const alert = await screen.findByTestId('alert');
      expect(alert.className).not.toContain('usa-alert__visible');
    });
  });
});
