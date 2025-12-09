import { describe } from 'vitest';
import { render, waitFor, screen, fireEvent } from '@testing-library/react';
import CaseDetailScreen, { applyCaseNoteSortAndFilters, CaseDetailProps } from './CaseDetailScreen';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import MockData from '@common/cams/test-utilities/mock-data';
import { CaseNote } from '@common/cams/cases';
import { UswdsAlertStyle } from '@/lib/components/uswds/Alert';

describe('Case Note Tests', async () => {
  const testCaseId = '111-11-12345';
  const testCaseDetail = MockData.getCaseDetail({ override: { caseId: testCaseId } });
  const testFullCaseNotes: CaseNote[] = MockData.buildArray(
    () => MockData.getCaseNote({ caseId: testCaseDetail.caseId }),
    4,
  );
  const testNotesToFilter = [
    ...testFullCaseNotes,
    MockData.getCaseNote({ caseId: testCaseId, title: 'A different test title' }),
  ];
  const basicInfoPath = `/case-detail/${testCaseDetail.caseId}/`;

  function renderWithProps(props?: Partial<CaseDetailProps>, infoPath?: string) {
    const defaultProps = {
      caseDetail: testCaseDetail,
      caseDocketEntries: [],
      caseNotes: testFullCaseNotes,
    };

    const renderProps = { ...defaultProps, ...props };

    render(
      <MemoryRouter initialEntries={[infoPath ?? basicInfoPath]}>
        <Routes>
          <Route path="case-detail/:caseId/*" element={<CaseDetailScreen {...renderProps} />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('Case Note tab should be visible', async () => {
    renderWithProps();

    await waitFor(() => {
      const notesNavLink = screen.queryByTestId('case-notes-link');
      expect(notesNavLink).toBeInTheDocument();
    });
  });

  test('Should search case notes properly', async () => {
    renderWithProps({ caseNotes: testNotesToFilter });

    await waitFor(() => {
      const notesNavLink = screen.queryByTestId('case-notes-link');
      expect(notesNavLink).toBeInTheDocument();
    });
    const notesNavLink = screen.queryByTestId('case-notes-link');
    fireEvent.click(notesNavLink!);
    await waitFor(() => {
      const notesListBefore = screen.queryByTestId('searchable-case-notes');
      expect(notesListBefore?.children.length).toEqual(testNotesToFilter.length);
    });

    let searchInput;
    await waitFor(() => {
      searchInput = screen.queryByTestId('case-note-search-input');
      expect(searchInput).toBeInTheDocument();
    });

    searchInput = screen.queryByTestId('case-note-search-input');
    fireEvent.change(searchInput!, { target: { value: 'different' } });

    await waitFor(() => {
      const notesListAfter = screen.queryByTestId('searchable-case-notes');
      expect(notesListAfter?.children.length).toEqual(1);
    });

    searchInput = screen.queryByTestId('case-note-search-input');
    fireEvent.change(searchInput!, { target: { value: 'zebra' } });
    await waitFor(() => {
      const notesListAfter = screen.queryByTestId('searchable-case-notes');
      expect(notesListAfter).not.toBeInTheDocument();
    });

    let clearButton;
    await waitFor(() => {
      clearButton = screen.queryByTestId('clear-filters');
      expect(clearButton).toBeInTheDocument();
    });

    clearButton = screen.queryByTestId('clear-filters');
    fireEvent.click(clearButton!);
    await waitFor(() => {
      searchInput = screen.queryByTestId('case-note-search-input');
      expect(searchInput?.innerText).toBe(undefined);
    });
  });

  const panelVisibleOptions = [[testFullCaseNotes], [[]]];

  test.each(panelVisibleOptions)(
    'Case note search input visibility should be conditional on presence of case notes: visible if case notes exist.',
    async (testNotes: CaseNote[]) => {
      let notesNavLink;

      renderWithProps({ caseNotes: testNotes });

      await waitFor(() => {
        notesNavLink = screen.queryByTestId('case-notes-link');
        expect(notesNavLink).toBeInTheDocument();
      });

      notesNavLink = screen.queryByTestId('case-notes-link');
      fireEvent.click(notesNavLink!);

      await waitFor(() => {
        const panel = screen.queryByTestId('case-notes-filter-and-search-panel');
        if (testNotes.length > 0) {
          expect(panel).toBeInTheDocument();
        } else {
          expect(panel).not.toBeInTheDocument();
        }
      });
    },
  );

  test('Should pass empty notes when notes are undefined', async () => {
    const { filteredCaseNotes, notesAlertOptions } = applyCaseNoteSortAndFilters([], {
      caseNoteSearchText: '',
      sortDirection: 'Newest',
    });

    expect(filteredCaseNotes).toEqual([]);
    expect(notesAlertOptions).toBeUndefined();
  });

  test('should have undefined alert options for case notes that have successfully filtered with a length', () => {
    const { filteredCaseNotes, notesAlertOptions } = applyCaseNoteSortAndFilters(
      testNotesToFilter,
      {
        caseNoteSearchText: '',
        sortDirection: 'Newest',
      },
    );

    expect(filteredCaseNotes).toEqual(filteredCaseNotes);
    expect(notesAlertOptions).toBeUndefined();
  });

  test('should have alert when no notes match criteria', () => {
    const expectedAlertOptions = {
      message: "The search criteria didn't match any notes in this case",
      title: 'Case Note Not Found',
      type: UswdsAlertStyle.Warning,
    };
    const { filteredCaseNotes, notesAlertOptions } = applyCaseNoteSortAndFilters(
      testNotesToFilter,
      {
        caseNoteSearchText: 'zebra',
        sortDirection: 'Newest',
      },
    );

    expect(filteredCaseNotes).toEqual(filteredCaseNotes);
    expect(notesAlertOptions).toEqual(expectedAlertOptions);
  });
});
