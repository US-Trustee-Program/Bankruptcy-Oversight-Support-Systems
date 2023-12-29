import { BrowserRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import CaseDetailCourtDocket from '@/case-detail/panels/CaseDetailCourtDocket';
import { CaseDocket } from '@/lib/type-declarations/chapter-15';
import { formatDate } from '@/lib/utils/datetime';
import * as highlightModule from '@/lib/utils/highlight-api';

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
