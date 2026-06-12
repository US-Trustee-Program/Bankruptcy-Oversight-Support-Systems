import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import TrusteeCaseListFilter from './TrusteeCaseListFilter';
import trusteeCaseListFilterUseCase, { CASE_CHAPTER_OPTIONS } from './trusteeCaseListFilterUseCase';

describe('TrusteeCaseListFilter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  async function renderFilter(onFilterChange = vi.fn()) {
    const view = render(<TrusteeCaseListFilter onFilterChange={onFilterChange} />);
    // Expand the accordion so filter controls are visible
    const accordionButton = screen.getByRole('button', { name: 'Filters' });
    await userEvent.click(accordionButton);
    return view;
  }

  test('renders a filter controls section', async () => {
    await renderFilter();
    expect(screen.getByRole('region', { name: 'Case list filter controls' })).toBeInTheDocument();
  });

  test('renders status select with All/Open/Closed options', async () => {
    await renderFilter();
    const select = screen.getByLabelText('Filter by case status');
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Open' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Closed' })).toBeInTheDocument();
  });

  test('status select defaults to Open', async () => {
    await renderFilter();
    const select = screen.getByLabelText('Filter by case status') as HTMLSelectElement;
    expect(select.value).toBe('OPEN');
  });

  test('calls onFilterChange with caseStatus=CLOSED when Closed selected', async () => {
    const onFilterChange = vi.fn();
    await renderFilter(onFilterChange);
    const select = screen.getByLabelText('Filter by case status');
    await userEvent.selectOptions(select, 'CLOSED');
    expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({ caseStatus: 'CLOSED' }));
  });

  test('calls onFilterChange with caseStatus=ALL when All selected', async () => {
    const onFilterChange = vi.fn();
    await renderFilter(onFilterChange);
    const select = screen.getByLabelText('Filter by case status');
    await userEvent.selectOptions(select, 'ALL');
    expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({ caseStatus: 'ALL' }));
  });

  test('onFilterChange includes chapters array in callback value', async () => {
    const onFilterChange = vi.fn();
    await renderFilter(onFilterChange);
    const select = screen.getByLabelText('Filter by case status');
    await userEvent.selectOptions(select, 'OPEN');
    expect(onFilterChange).toHaveBeenCalledWith({ caseStatus: 'OPEN', chapters: [] });
  });

  test('renders Case Filed Date range inputs', async () => {
    await renderFilter();
    expect(screen.getByLabelText('Case filed date from')).toBeInTheDocument();
    expect(screen.getByLabelText('Case filed date to')).toBeInTheDocument();
  });

  test('calls onFilterChange with filedDateFrom when from date is entered', async () => {
    const onFilterChange = vi.fn();
    await renderFilter(onFilterChange);
    const fromInput = screen.getByLabelText('Case filed date from');
    await userEvent.type(fromInput, '2024-01-01');
    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ filedDateFrom: '2024-01-01' }),
    );
  });

  test('calls onFilterChange with filedDateTo when to date is entered', async () => {
    const onFilterChange = vi.fn();
    await renderFilter(onFilterChange);
    const toInput = screen.getByLabelText('Case filed date to');
    await userEvent.type(toInput, '2024-12-31');
    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ filedDateTo: '2024-12-31' }),
    );
  });

  test('calls onFilterChange when valid date range is entered', async () => {
    const onFilterChange = vi.fn();
    await renderFilter(onFilterChange);
    const fromInput = screen.getByLabelText('Case filed date from');
    const toInput = screen.getByLabelText('Case filed date to');

    await userEvent.type(fromInput, '2024-01-01');
    onFilterChange.mockClear();

    await userEvent.type(toInput, '2024-12-31');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ filedDateFrom: '2024-01-01', filedDateTo: '2024-12-31' }),
    );
  });

  test('shows validation error when filed to-date is before from-date', async () => {
    const onFilterChange = vi.fn();
    await renderFilter(onFilterChange);
    const fromInput = screen.getByLabelText('Case filed date from');
    const toInput = screen.getByLabelText('Case filed date to');

    await userEvent.type(fromInput, '2024-06-01');
    onFilterChange.mockClear();

    await userEvent.type(toInput, '2024-01-01');

    expect(screen.getByRole('alert')).toHaveTextContent('End date must be on or after start date');
    expect(onFilterChange).not.toHaveBeenCalled();
  });

  test('shows filed date pill when filedDateFrom is set', async () => {
    await renderFilter();
    const fromInput = screen.getByLabelText('Case filed date from');
    await userEvent.type(fromInput, '2024-01-01');
    await waitFor(() => {
      expect(screen.getByText(/Filed:/)).toBeInTheDocument();
    });
  });

  test('initializes status from initialValue prop', async () => {
    render(
      <TrusteeCaseListFilter
        onFilterChange={vi.fn()}
        initialValue={{ caseStatus: 'OPEN', chapters: [] }}
      />,
    );
    const accordionButton = screen.getByRole('button', { name: 'Filters' });
    await userEvent.click(accordionButton);
    const select = screen.getByLabelText('Filter by case status') as HTMLSelectElement;
    expect(select.value).toBe('OPEN');
  });

  test('initializes date fields from initialValue prop', async () => {
    render(
      <TrusteeCaseListFilter
        onFilterChange={vi.fn()}
        initialValue={{
          caseStatus: 'ALL',
          chapters: [],
          filedDateFrom: '2024-01-01',
          filedDateTo: '2024-12-31',
        }}
      />,
    );
    const accordionButton = screen.getByRole('button', { name: 'Filters' });
    await userEvent.click(accordionButton);
    expect((screen.getByLabelText('Case filed date from') as HTMLInputElement).value).toBe(
      '2024-01-01',
    );
    expect((screen.getByLabelText('Case filed date to') as HTMLInputElement).value).toBe(
      '2024-12-31',
    );
  });

  test('status change preserves active filed date filters', async () => {
    const onFilterChange = vi.fn();
    await renderFilter(onFilterChange);

    const fromInput = screen.getByLabelText('Case filed date from');
    await userEvent.type(fromInput, '2024-01-01');
    onFilterChange.mockClear();

    const select = screen.getByLabelText('Filter by case status');
    await userEvent.selectOptions(select, 'CLOSED');

    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ caseStatus: 'CLOSED', filedDateFrom: '2024-01-01' }),
    );
  });

  test('chapter change preserves active filed date filters', async () => {
    const onFilterChange = vi.fn();
    render(
      <TrusteeCaseListFilter
        onFilterChange={onFilterChange}
        initialValue={{
          caseStatus: 'OPEN',
          chapters: [],
          filedDateFrom: '2024-01-01',
          filedDateTo: '2024-12-31',
        }}
      />,
    );
    const accordionButton = screen.getByRole('button', { name: 'Filters' });
    await userEvent.click(accordionButton);
    onFilterChange.mockClear();

    const mockStore = {
      selectedStatus: 'OPEN' as const,
      setSelectedStatus: vi.fn(),
      selectedChapters: [],
      setSelectedChapters: vi.fn(),
      filedDateFrom: '2024-01-01',
      setFiledDateFrom: vi.fn(),
      filedDateTo: '2024-12-31',
      setFiledDateTo: vi.fn(),
      filedDateError: '',
      setFiledDateError: vi.fn(),
    };
    const mockOnFilterChange = vi.fn();
    const uc = trusteeCaseListFilterUseCase(
      mockStore,
      { chapterFilterRef: { current: null } as React.RefObject<null> },
      mockOnFilterChange,
    );

    uc.handleChapterChange([CASE_CHAPTER_OPTIONS[0]]);

    expect(mockOnFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ filedDateFrom: '2024-01-01', filedDateTo: '2024-12-31' }),
    );
  });
});
