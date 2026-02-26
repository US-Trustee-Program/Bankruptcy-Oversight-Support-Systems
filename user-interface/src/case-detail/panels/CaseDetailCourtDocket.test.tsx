import { BrowserRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import CaseDetailCourtDocket from '@/case-detail/panels/CaseDetailCourtDocket';
import { formatDate } from '@/lib/utils/datetime';
import * as highlightModule from '@/lib/utils/highlight-api';
import { CaseDocket } from '@common/cams/cases';

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
  const secondIndex = 1;

  test('should render loading info when isDocketLoading is true', () => {
    render(
      <BrowserRouter>
        <CaseDetailCourtDocket
          caseId="081-12-12345"
          docketEntries={undefined}
          searchString=""
          hasDocketEntries={false}
          isDocketLoading={true}
        />
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
          isDocketLoading={false}
        />
      </BrowserRouter>,
    );

    const isLoading = screen.queryByTestId('loading-indicator');
    expect(isLoading).not.toBeInTheDocument();

    const docketEntry1 = screen.getByTestId('docket-entry-0');
    const docketEntry2 = screen.getByTestId('docket-entry-1');
    expect(docketEntry1).toBeInTheDocument();
    expect(docketEntry2).toBeInTheDocument();

    const documentNumberColumn = docketEntry1.querySelector('.document-number-column');
    const docketEntry1Header = screen.getByTestId('docket-entry-0-header');
    expect(documentNumberColumn).toHaveTextContent(documentNumberOne?.toString() || '');
    expect(docketEntry1Header.innerHTML).toEqual(
      formatDate(docketEntries[firstIndex].dateFiled) +
        ' - ' +
        docketEntries[firstIndex].summaryText,
    );
    const docketEntry1Text = screen.getByTestId('docket-entry-0-text');
    expect(docketEntry1Text.innerHTML).toEqual(docketEntries[firstIndex].fullText);

    const docketEntry2Header = screen.getByTestId('docket-entry-1-header');
    expect(docketEntry2Header.innerHTML).toEqual(
      formatDate(docketEntries[secondIndex].dateFiled) +
        ' - ' +
        docketEntries[secondIndex].summaryText,
    );
  });

  test('should not render docket number if no docket number exists and aria-label should only be present if there is a docket number', () => {
    const document1Number = docketEntries[firstIndex].documentNumber;
    const document3Number = docketEntries[firstIndex + 2].documentNumber;
    render(
      <BrowserRouter>
        <CaseDetailCourtDocket
          caseId="081-12-12345"
          docketEntries={docketEntries}
          searchString=""
          hasDocketEntries={true}
          isDocketLoading={false}
        />
      </BrowserRouter>,
    );

    const docketEntry1 = screen.getByTestId('docket-entry-0');
    const docketEntry2 = screen.getByTestId('docket-entry-1');
    const docketEntry3 = screen.getByTestId('docket-entry-2');
    expect(docketEntry1).toBeInTheDocument();
    expect(docketEntry2).toBeInTheDocument();
    expect(docketEntry3).toBeInTheDocument();

    const document1NumberColumn = docketEntry1.querySelector('.document-number-column');
    const document2NumberColumn = docketEntry2.querySelector('.document-number-column');
    const document3NumberColumn = docketEntry3.querySelector('.document-number-column');

    expect(document1NumberColumn).toHaveAttribute('aria-label', `Docket Number ${document1Number}`);
    expect(document2NumberColumn).not.toHaveAttribute('aria-label');
    expect(document3NumberColumn).toHaveAttribute('aria-label', `Docket Number ${document3Number}`);
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
            isDocketLoading={false}
          />
        </BrowserRouter>,
      );

      const alertContainer = await screen.findByTestId('alert-container');
      expect(alertContainer).toBeInTheDocument();
      expect(alertContainer.className).toContain('inline-alert');
      expect(alertContainer.className).toContain('visible');
    });

    test('should not display alert when docket entries are found', async () => {
      render(
        <BrowserRouter>
          <CaseDetailCourtDocket
            caseId="081-12-12345"
            docketEntries={docketEntries}
            searchString=""
            hasDocketEntries={true}
            isDocketLoading={false}
          />
        </BrowserRouter>,
      );

      const alertContainer = await screen.findByTestId('alert-container');
      expect(alertContainer).toBeInTheDocument();

      const alert = await screen.findByTestId('alert');
      expect(alert.className).not.toContain('usa-alert__visible');
    });
  });

  describe('Highlight API integration', () => {
    test('should call handleHighlight if searchWords are passed to the component', async () => {
      const handleHighlightSpy = vi.spyOn(highlightModule, 'handleHighlight');
      render(
        <BrowserRouter>
          <CaseDetailCourtDocket
            caseId="081-12-12345"
            docketEntries={[]}
            searchString="test"
            hasDocketEntries={true}
            isDocketLoading={false}
          />
        </BrowserRouter>,
      );
      expect(handleHighlightSpy).toHaveBeenCalled();
    });
  });
});
