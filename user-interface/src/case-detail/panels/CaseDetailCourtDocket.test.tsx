import { BrowserRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import CaseDetailCourtDocket, {
  fileSizeDescription,
  generateDocketFilenameDisplay,
} from '@/case-detail/panels/CaseDetailCourtDocket';
import { CaseDocket, CaseDocketEntryDocument } from '@/lib/type-declarations/chapter-15';
import { formatDate } from '@/lib/utils/datetime';

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
  const firstIndex = 0;

  test('should render loading info when isLoading is true', () => {
    render(
      <BrowserRouter>
        <CaseDetailCourtDocket caseId="081-12-12345" docketEntries={undefined} searchString="" />
      </BrowserRouter>,
    );

    const isLoading = screen.getByTestId('loading-indicator');

    expect(isLoading).toBeInTheDocument();
  });

  test('should render docket entries when provided', () => {
    const documentNumberOne = docketEntries[firstIndex].documentNumber;
    render(
      <BrowserRouter>
        <CaseDetailCourtDocket
          caseId="081-12-12345"
          docketEntries={docketEntries}
          searchString=""
          hasDocketEntries={true}
        />
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
      formatDate(docketEntries[firstIndex].dateFiled) +
        ' - ' +
        docketEntries[firstIndex].summaryText,
    );
    const docketEntry1Text = screen.getByTestId('docket-entry-0-text');
    expect(docketEntry1Text.innerHTML).toEqual(docketEntries[firstIndex].fullText);

    const docketEntry2DocumentNumber = screen.getByTestId('docket-entry-1-number');
    expect(docketEntry2DocumentNumber.innerHTML).toEqual('');
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

  describe('No docket entry alert tests', () => {
    test('should display alert when no docket entries are found', async () => {
      render(
        <BrowserRouter>
          <CaseDetailCourtDocket
            caseId="081-12-12345"
            docketEntries={[]}
            searchString=""
            hasDocketEntries={false}
          />
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
          <CaseDetailCourtDocket
            caseId="081-12-12345"
            docketEntries={docketEntries}
            searchString=""
            hasDocketEntries={true}
          />
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
