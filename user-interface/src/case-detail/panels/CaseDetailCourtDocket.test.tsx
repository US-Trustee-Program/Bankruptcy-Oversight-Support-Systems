import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
//import CaseDetailCourtDocket, { handleHighlight } from '@/case-detail/panels/CaseDetailCourtDocket';
import CaseDetailCourtDocket from '@/case-detail/panels/CaseDetailCourtDocket';
import { vi } from 'vitest';
import * as FeatureFlags from '@/lib/hooks/UseFeatureFlags';
import { CaseDocketEntry } from '@/lib/type-declarations/chapter-15';
//import WindowExperimental = BrowserExperimental.WindowExperimental;
//import { createRoot } from 'react-dom/client';

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
  ];

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
    const documentNumberOne = 1;
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
    expect(docketEntry1DocumentNumber).toHaveTextContent(documentNumberOne.toString());
    const docketEntry1Header = screen.getByTestId('docket-entry-0-header');
    expect(docketEntry1Header.innerHTML).toEqual(
      docketEntries[0].dateFiled + ' - ' + docketEntries[0].summaryText,
    );
    const docketEntry1Text = screen.getByTestId('docket-entry-0-text');
    expect(docketEntry1Text.innerHTML).toEqual(docketEntries[0].fullText);

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

  /*
  describe('CSS Highlight API integration', () => {
    // TODO: Test normal. API exists and search term is provided and docket exists
    // TODO: Test no API available
    test('should clear highlights if no search term is passed', () => {
      // SPY -> browserApi.CSS.highlights.clear()
    });

    test('should not add highlights if the searchable-docket node is not avaialble', () => {
      // SPY -> browserApi.CSS.highlights.set('search-results', searchResultsHighlight)
      // NOT CALLED.
    });

    // TODO: Test API available, has search term, but docket does not exist in DOM.
    test('should add highlight to the hightlight API', () => {
      // SPY -> browserApi.CSS.highlights.set('search-results', searchResultsHighlight)
      const setMock = vi.fn();
      const clearMock = vi.fn();

      // TODO: Mock the browser highlight API on the window.
      // The window variable is scoped globally and used by the handleHighlight function.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const window: WindowExperimental = {
        CSS: {
          highlights: {
            set: setMock,
            clear: clearMock,
          },
        },
      };
      // vi.spyOn(setMock);
      const caseId = '123-23-1234';

      // The document variable is scoped globally and used by the handleHighlight function.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const document: Document = new Document();
      const root = document.createElement('div');
      const reactRoot = createRoot(root);
      reactRoot.render(CaseDetailCourtDocket({ caseId, docketEntries }));

      const searchString = 'Docket ';
      handleHighlight(searchString);
      expect(setMock.mock.calls).toHaveBeenCalled();
    });
  });
  */
});
