import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import CaseDetailCourtDocket from '@/case-detail/panels/CaseDetailCourtDocket';

describe('court docket panel tests', () => {
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
    const docketEntries = [
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
        summaryText: 'Add Judge',
        fullText: 'Docket entry number 2.',
      },
    ];
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

    const docketEntry1Number = screen.getByTestId('docket-entry-0-number');
    expect(docketEntry1Number.innerHTML).toEqual(docketEntries[0].documentNumber?.toString());
    const docketEntry1Header = screen.getByTestId('docket-entry-0-header');
    expect(docketEntry1Header.innerHTML).toEqual(
      docketEntries[0].dateFiled + ' - ' + docketEntries[0].summaryText,
    );
    const docketEntry1Text = screen.getByTestId('docket-entry-0-text');
    expect(docketEntry1Text.innerHTML).toEqual(docketEntries[0].fullText);

    const docketEntry2Number = screen.getByTestId('docket-entry-1-number');
    expect(docketEntry2Number.innerHTML).toEqual('');
  });
});
