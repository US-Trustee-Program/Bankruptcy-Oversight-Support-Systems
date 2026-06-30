import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import TrusteeCaseListFilter from './TrusteeCaseListFilter';
import Api2 from '@/lib/models/api2';
import { CourtDivisionDetails } from '@common/cams/courts';
import LocalStorage from '@/lib/utils/local-storage';

const mockCourts: CourtDivisionDetails[] = [
  {
    officeName: 'Manhattan',
    officeCode: '0971',
    courtId: '097',
    courtName: 'Southern District of New York',
    courtDivisionCode: '0971',
    courtDivisionName: 'Manhattan',
    groupDesignator: 'NY',
    regionId: '02',
    regionName: 'Region 2',
  },
  {
    officeName: 'White Plains',
    officeCode: '0972',
    courtId: '097',
    courtName: 'Southern District of New York',
    courtDivisionCode: '0972',
    courtDivisionName: 'White Plains',
    groupDesignator: 'NY',
    regionId: '02',
    regionName: 'Region 2',
  },
];

describe('TrusteeCaseListFilter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: [], meta: { self: '' } });
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);
  });

  async function renderFilter(onFilterChange = vi.fn()) {
    const view = render(<TrusteeCaseListFilter onFilterChange={onFilterChange} />);
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
        initialValue={{ caseStatus: 'CLOSED', chapters: [] }}
      />,
    );
    const accordionButton = screen.getByRole('button', { name: 'Filters' });
    await userEvent.click(accordionButton);
    const select = screen.getByLabelText('Filter by case status') as HTMLSelectElement;
    expect(select.value).toBe('CLOSED');
  });

  test('initializes chapters from initialValue prop', async () => {
    render(
      <TrusteeCaseListFilter
        onFilterChange={vi.fn()}
        initialValue={{ caseStatus: 'OPEN', chapters: ['7', '13'] }}
      />,
    );
    const accordionButton = screen.getByRole('button', { name: 'Filters' });
    await userEvent.click(accordionButton);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Chapter 7 selected/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Chapter 13 selected/ })).toBeInTheDocument();
    });
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
    const user = userEvent.setup();
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
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    onFilterChange.mockClear();

    const comboInput = screen.getByRole('combobox', { name: /chapter/i });
    await user.click(comboInput);
    await user.click(await screen.findByText('Chapter 7', { selector: 'li span' }));

    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ filedDateFrom: '2024-01-01', filedDateTo: '2024-12-31' }),
    );
  });

  test('removing status pill resets status to ALL', async () => {
    const onFilterChange = vi.fn();
    await renderFilter(onFilterChange);
    const select = screen.getByLabelText('Filter by case status');
    await userEvent.selectOptions(select, 'CLOSED');
    onFilterChange.mockClear();

    const statusPill = screen.getByRole('button', { name: /Closed selected/ });
    await userEvent.click(statusPill);

    expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({ caseStatus: 'ALL' }));
  });

  test('removing filed date pill clears the date range', async () => {
    const onFilterChange = vi.fn();
    await renderFilter(onFilterChange);
    const fromInput = screen.getByLabelText('Case filed date from');
    await userEvent.type(fromInput, '2024-01-01');
    onFilterChange.mockClear();

    await screen.findByText(/Filed:/);
    const datePill = screen.getByRole('button', { name: /Filed:.*selected/ });
    await userEvent.click(datePill);

    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ filedDateFrom: undefined, filedDateTo: undefined }),
    );
  });

  describe('screen reader accessibility', () => {
    beforeEach(() => {
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      });
    });

    test('aria-live region exists and is initially empty', async () => {
      await renderFilter();
      const liveRegion = screen.getByTestId('filter-announcement');
      expect(liveRegion).toBeInTheDocument();
      expect(liveRegion).toHaveTextContent('');
    });

    test('announces status set to Closed', async () => {
      await renderFilter();
      const select = screen.getByLabelText('Filter by case status');
      await userEvent.selectOptions(select, 'CLOSED');
      await waitFor(() => {
        expect(screen.getByTestId('filter-announcement')).toHaveTextContent(
          'Case status filter set to Closed',
        );
      });
    });

    test('announces status set to Open', async () => {
      await renderFilter();
      const select = screen.getByLabelText('Filter by case status');
      await userEvent.selectOptions(select, 'ALL');
      await userEvent.selectOptions(select, 'OPEN');
      await waitFor(() => {
        expect(screen.getByTestId('filter-announcement')).toHaveTextContent(
          'Case status filter set to Open',
        );
      });
    });

    test('announces status set to All', async () => {
      await renderFilter();
      const select = screen.getByLabelText('Filter by case status');
      await userEvent.selectOptions(select, 'ALL');
      await waitFor(() => {
        expect(screen.getByTestId('filter-announcement')).toHaveTextContent(
          'Case status filter set to All',
        );
      });
    });

    test('announces chapter selection', async () => {
      const user = userEvent.setup();
      render(<TrusteeCaseListFilter onFilterChange={vi.fn()} />);
      await user.click(screen.getByRole('button', { name: 'Filters' }));
      const comboInput = screen.getByRole('combobox', { name: /chapter/i });
      await user.click(comboInput);
      await user.click(await screen.findByText('Chapter 7', { selector: 'li span' }));
      await waitFor(() => {
        expect(screen.getByTestId('filter-announcement')).toHaveTextContent(
          'Chapter filter: Chapter 7',
        );
      });
    });

    test('announces chapter filter cleared', async () => {
      const user = userEvent.setup();
      render(<TrusteeCaseListFilter onFilterChange={vi.fn()} />);
      await user.click(screen.getByRole('button', { name: 'Filters' }));
      const comboInput = screen.getByRole('combobox', { name: /chapter/i });
      await user.click(comboInput);
      await user.click(await screen.findByText('Chapter 7', { selector: 'li span' }));
      await waitFor(() =>
        expect(screen.getByTestId('filter-announcement')).toHaveTextContent('Chapter filter:'),
      );

      const clearAll = screen.getByRole('button', { name: /Clear all Chapter/i });
      await user.click(clearAll);
      await waitFor(() => {
        expect(screen.getByTestId('filter-announcement')).toHaveTextContent(
          'Chapter filter cleared',
        );
      });
    });

    test('announces filed date filter applied', async () => {
      await renderFilter();
      const fromInput = screen.getByLabelText('Case filed date from');
      await userEvent.type(fromInput, '2024-01-01');
      await waitFor(() => {
        expect(screen.getByTestId('filter-announcement')).toHaveTextContent(
          'Filed date filter applied',
        );
      });
    });

    test('announces filed date filter cleared', async () => {
      const onFilterChange = vi.fn();
      await renderFilter(onFilterChange);
      const fromInput = screen.getByLabelText('Case filed date from');
      await userEvent.type(fromInput, '2024-01-01');
      await waitFor(() =>
        expect(screen.getByTestId('filter-announcement')).toHaveTextContent(
          'Filed date filter applied',
        ),
      );

      await userEvent.clear(fromInput);
      await userEvent.type(fromInput, ' ');
      await userEvent.clear(fromInput);

      await waitFor(() => {
        expect(screen.getByTestId('filter-announcement')).toHaveTextContent(
          'Filed date filter cleared',
        );
      });
    });

    test('chapter ComboBox is reachable by accessible name', async () => {
      await renderFilter();
      expect(screen.getByRole('combobox', { name: /chapter/i })).toBeInTheDocument();
    });
  });

  describe('District (Division) filter', () => {
    beforeEach(() => {
      vi.spyOn(Api2, 'getCourts').mockResolvedValue({
        data: mockCourts,
        meta: { self: '' },
      });
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      });
    });

    test('announces district filter selection', async () => {
      const user = userEvent.setup();
      render(<TrusteeCaseListFilter onFilterChange={vi.fn()} />);
      await user.click(screen.getByRole('button', { name: 'Filters' }));
      expect(
        await screen.findByRole('combobox', { name: /district \(division\)/i }),
      ).toBeInTheDocument();
      const combo = screen.getByRole('combobox', { name: /district \(division\)/i });
      await user.click(combo);
      await user.click(
        await screen.findByText('Southern District of New York (Manhattan)', {
          selector: 'li span',
        }),
      );
      await waitFor(() => {
        expect(screen.getByTestId('filter-announcement')).toHaveTextContent(
          'District filter: 1 division(s) selected',
        );
      });
    });

    test('announces district filter cleared', async () => {
      const user = userEvent.setup();
      render(<TrusteeCaseListFilter onFilterChange={vi.fn()} />);
      await user.click(screen.getByRole('button', { name: 'Filters' }));
      expect(
        await screen.findByRole('combobox', { name: /district \(division\)/i }),
      ).toBeInTheDocument();
      const combo = screen.getByRole('combobox', { name: /district \(division\)/i });
      await user.click(combo);
      await user.click(
        await screen.findByText('Southern District of New York (Manhattan)', {
          selector: 'li span',
        }),
      );
      await waitFor(() =>
        expect(screen.getByTestId('filter-announcement')).toHaveTextContent('District filter:'),
      );
      const clearAll = screen.getByRole('button', { name: /Clear all District \(Division\)/i });
      await user.click(clearAll);
      await waitFor(() => {
        expect(screen.getByTestId('filter-announcement')).toHaveTextContent(
          'District filter cleared',
        );
      });
    });

    test('includes initialValue divisionCodes in onFilterChange when another filter changes', async () => {
      const onFilterChange = vi.fn();
      render(
        <TrusteeCaseListFilter
          onFilterChange={onFilterChange}
          initialValue={{ caseStatus: 'OPEN', chapters: [], divisionCodes: ['0971'] }}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
      const select = screen.getByLabelText('Filter by case status');
      await userEvent.selectOptions(select, 'ALL');
      expect(onFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({ caseStatus: 'ALL', divisionCodes: ['0971'] }),
      );
    });
  });
});
