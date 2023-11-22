import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import CaseDetailCourtDocket from '@/case-detail/panels/CaseDetailCourtDocket';
import * as FeatureFlags from '@/lib/hooks/UseFeatureFlags';
import { CaseDocketEntry } from '@/lib/type-declarations/chapter-15';

function toTextContent(de: CaseDocketEntry) {
  return de.documentNumber + de.dateFiled + ' - ' + de.summaryText + de.fullText;
}

describe('court docket panel tests', () => {
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
    {
      sequenceNumber: 4,
      documentNumber: 2,
      dateFiled: '2023-07-07T00:00:00.0000000',
      summaryText: 'Add Attorney',
      fullText: 'Docket entry number 3.',
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

  test('should render docket search when the feature is turned on', async () => {
    vi.spyOn(FeatureFlags, 'default').mockReturnValue({ 'docket-search-enabled': true });
    const docketEntries: CaseDocketEntry[] = [];

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

    const searchableDocketId = 'searchable-docket';
    const startingDocket = screen.getByTestId(searchableDocketId);
    expect(startingDocket.childElementCount).toEqual(docketEntries.length);

    const searchInput = screen.getByTestId('basic-search-field');
    fireEvent.change(searchInput, { target: { value: 'number 2' } });

    const filteredDocket = screen.getByTestId(searchableDocketId);
    expect(filteredDocket.childElementCount).toEqual(1);
  });

  test('should sort docket entries', async () => {
    vi.spyOn(FeatureFlags, 'default').mockReturnValue({ 'docket-search-enabled': true });

    render(
      <BrowserRouter>
        <CaseDetailCourtDocket caseId="081-12-12345" docketEntries={docketEntries} />
      </BrowserRouter>,
    );

    const searchableDocketId = 'searchable-docket';
    const sortButtonId = 'docket-entry-sort';
    const expectedFirstDocketTest = toTextContent(docketEntries[2]);
    const expectedLastDocketTest = toTextContent(docketEntries[0]);

    const startingDocket = screen.getByTestId(searchableDocketId);
    const sortButton = screen.getByTestId(sortButtonId);
    expect(startingDocket.childElementCount).toEqual(docketEntries.length);
    fireEvent.click(sortButton);
    const docket = screen.getByTestId(searchableDocketId);

    expect(docket.children[0].textContent).toBe(expectedLastDocketTest);

    fireEvent.click(sortButton);
    expect(docket.children[0].textContent).toBe(expectedFirstDocketTest);
  });
});
