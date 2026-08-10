import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TrusteeDistrictFilter from './TrusteeDistrictFilter';
import Api2 from '@/lib/models/api2';
import { CourtDivisionDetails } from '@common/cams/courts';
import { ResponseBody } from '@common/api/response';
import { vi } from 'vitest';
import LocalStorage from '@/lib/utils/local-storage';
import { TrusteeDistrictFilterRef } from './trusteeDistrictFilter.types';
import React from 'react';

const mockDistricts: CourtDivisionDetails[] = [
  {
    officeName: 'Manhattan',
    officeCode: '081',
    courtId: 'NYSB',
    courtName: 'Southern District of New York',
    courtDivisionCode: '081',
    courtDivisionName: 'Manhattan',
    groupDesignator: 'NY',
    regionId: '02',
    regionName: 'New York Region',
    state: 'NY',
  },
  {
    officeName: 'White Plains',
    officeCode: '087',
    courtId: 'NYSB',
    courtName: 'Southern District of New York',
    courtDivisionCode: '087',
    courtDivisionName: 'White Plains',
    groupDesignator: 'NY',
    regionId: '02',
    regionName: 'New York Region',
    state: 'NY',
  },
  {
    officeName: 'Rutland',
    officeCode: '088',
    courtId: 'VTB',
    courtName: 'District of Vermont',
    courtDivisionCode: '088',
    courtDivisionName: 'Rutland',
    groupDesignator: 'VT',
    regionId: '01',
    regionName: 'Boston Region',
    state: 'VT',
  },
];

function renderFilter(
  overrides: Partial<{
    ref: React.RefObject<TrusteeDistrictFilterRef>;
    onExpandedChange: (expanded: boolean) => void;
  }> = {},
) {
  const mockHandleFilterDistrict = vi.fn();
  const mockHandleFilterChapter = vi.fn();
  const mockHandleFilterName = vi.fn();
  const mockHandleFilterDivision = vi.fn();
  const mockHandleFilterStatus = vi.fn();
  render(
    <TrusteeDistrictFilter
      ref={overrides.ref}
      handleFilterDistrict={mockHandleFilterDistrict}
      handleFilterChapter={mockHandleFilterChapter}
      handleFilterName={mockHandleFilterName}
      handleFilterDivision={mockHandleFilterDivision}
      handleFilterStatus={mockHandleFilterStatus}
      statusFilter="active"
      onExpandedChange={overrides.onExpandedChange}
    />,
  );
  return {
    mockHandleFilterDistrict,
    mockHandleFilterChapter,
    mockHandleFilterName,
    mockHandleFilterDivision,
    mockHandleFilterStatus,
  };
}

async function openFiltersPanel(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => {
    expect(screen.getByText('Filters')).toBeInTheDocument();
  });

  const toggleButton = screen.getByRole('button', { name: /filters/i });
  await user.click(toggleButton);
}

describe('TrusteeDistrictFilter Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);
    const mockResponse: ResponseBody<CourtDivisionDetails[]> = { data: mockDistricts };
    vi.spyOn(Api2, 'getCourts').mockResolvedValue(mockResponse);
  });

  test('should render collapsed by default and expand when toggle button clicked', async () => {
    const user = userEvent.setup();

    renderFilter();

    await waitFor(() => {
      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    const toggleButton = screen.getByRole('button', { name: /filters/i });
    expect(toggleButton).toBeInTheDocument();
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggleButton);

    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => {
      expect(screen.getByLabelText('District (Division)')).toBeInTheDocument();
    });
  });

  test('should display error message when API fails', async () => {
    const user = userEvent.setup();
    vi.spyOn(Api2, 'getCourts').mockRejectedValue(new Error('API Error'));

    renderFilter();

    await waitFor(() => {
      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    // Expand to see error message
    const toggleButton = screen.getByRole('button', { name: /filters/i });
    await user.click(toggleButton);

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert');
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0]).toHaveTextContent(
        'Unable to load district filter options. Please try refreshing the page.',
      );
    });
  });

  test('should call onExpandedChange callback when toggling between collapsed and expanded states', async () => {
    const user = userEvent.setup();
    const mockOnExpandedChange = vi.fn();

    renderFilter({ onExpandedChange: mockOnExpandedChange });

    await waitFor(() => {
      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    const toggleButton = screen.getByRole('button', { name: /filters/i });

    // Initially collapsed
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');

    // Expand
    await user.click(toggleButton);
    await waitFor(() => {
      expect(mockOnExpandedChange).toHaveBeenCalledWith(true);
      expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByLabelText('District (Division)')).toBeInTheDocument();
    });

    // Collapse
    await user.click(toggleButton);
    await waitFor(() => {
      expect(mockOnExpandedChange).toHaveBeenCalledWith(false);
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('Name Filter', () => {
    test('renders name input inside accordion when expanded', async () => {
      const user = userEvent.setup();

      renderFilter();

      const toggleButton = screen.getByRole('button', { name: /filters/i });
      await user.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /trustee name/i })).toBeInTheDocument();
      });
    });

    test('does not show Clear button when name input is empty', async () => {
      const user = userEvent.setup();

      renderFilter();

      const toggleButton = screen.getByRole('button', { name: /filters/i });
      await user.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /trustee name/i })).toBeInTheDocument();
      });

      const clearButton = document.querySelector(
        '[aria-label="Clear Trustee Name filter"]',
      ) as HTMLElement;
      expect(clearButton).not.toBeVisible();
    });

    test('shows Clear button when name input has text', async () => {
      const user = userEvent.setup();

      renderFilter();

      const toggleButton = screen.getByRole('button', { name: /filters/i });
      await user.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /trustee name/i })).toBeInTheDocument();
      });

      await user.type(screen.getByRole('textbox', { name: /trustee name/i }), 'Smith');

      expect(
        screen.getByRole('button', { name: /clear trustee name filter/i }),
      ).toBeInTheDocument();
    });

    test('Clear button click empties input and calls handleFilterName with empty string', async () => {
      const user = userEvent.setup();

      const { mockHandleFilterName } = renderFilter();

      const toggleButton = screen.getByRole('button', { name: /filters/i });
      await user.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /trustee name/i })).toBeInTheDocument();
      });

      await user.type(screen.getByRole('textbox', { name: /trustee name/i }), 'Smith');
      await user.click(screen.getByRole('button', { name: /clear trustee name filter/i }));

      expect(screen.getByRole('textbox', { name: /trustee name/i })).toHaveValue('');
      expect(mockHandleFilterName).toHaveBeenLastCalledWith('');
    });

    test('typing calls handleFilterName with current value', async () => {
      const user = userEvent.setup();

      const { mockHandleFilterName } = renderFilter();

      const toggleButton = screen.getByRole('button', { name: /filters/i });
      await user.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /trustee name/i })).toBeInTheDocument();
      });

      await user.type(screen.getByRole('textbox', { name: /trustee name/i }), 'Smith');

      expect(mockHandleFilterName).toHaveBeenLastCalledWith('Smith');
    });
  });

  describe('Chapter Filter', () => {
    test('should call handleFilterChapter when a chapter is selected', async () => {
      const user = userEvent.setup();

      const { mockHandleFilterChapter } = renderFilter();

      expect(await screen.findByText('Filters')).toBeInTheDocument();

      const toggleButton = screen.getByRole('button', { name: /filters/i });
      await user.click(toggleButton);

      const chapterCombobox = await screen.findByRole('combobox', { name: /chapter/i });
      expect(chapterCombobox).toBeInTheDocument();

      await user.click(chapterCombobox);

      const option = await screen.findByRole('option', { name: /Chapter 11 Subchapter V/ });
      expect(option).toBeInTheDocument();

      await user.click(option);

      await waitFor(
        () => {
          expect(mockHandleFilterChapter).toHaveBeenCalledWith(
            expect.arrayContaining([
              expect.objectContaining({ value: '11-subchapter-v', label: '11 Subchapter V' }),
            ]),
          );
        },
        { timeout: 5000 },
      );
    });

    test('should render chapter pill when chapter is selected and accordion is collapsed', async () => {
      const user = userEvent.setup();

      renderFilter();

      expect(await screen.findByText('Filters')).toBeInTheDocument();

      const toggleButton = screen.getByRole('button', { name: /filters/i });
      await user.click(toggleButton);

      expect(await screen.findByLabelText('Chapter')).toBeInTheDocument();

      const chapterCombobox = screen.getByLabelText('Chapter');
      await user.click(chapterCombobox);

      expect(await screen.findByText('7')).toBeInTheDocument();
      await user.click(screen.getByText('7'));

      await user.click(toggleButton);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /7 selected.*click to deselect/i }),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility - Filter Labels', () => {
    test('should have visible external labels for screen readers', async () => {
      const user = userEvent.setup();

      renderFilter();
      await openFiltersPanel(user);

      await waitFor(() => {
        expect(screen.getByLabelText('District (Division)')).toBeInTheDocument();
      });

      // External labels should be visible to screen readers (no aria-hidden)
      const districtDivisionLabels = screen.getAllByText('District (Division)');
      const externalDistrictDivisionLabel = districtDivisionLabels.find(
        (el) => !el.hasAttribute('aria-hidden'),
      );
      expect(externalDistrictDivisionLabel).toBeInTheDocument();
      expect(externalDistrictDivisionLabel).not.toHaveAttribute('aria-hidden');

      const chapterLabels = screen.getAllByText('Chapter');
      const externalChapterLabel = chapterLabels.find((el) => !el.hasAttribute('aria-hidden'));
      expect(externalChapterLabel).toBeInTheDocument();
      expect(externalChapterLabel).not.toHaveAttribute('aria-hidden');
    });

    test('should hide internal ComboBox labels to prevent duplicate announcements', async () => {
      const user = userEvent.setup();

      renderFilter();
      await openFiltersPanel(user);

      await waitFor(() => {
        expect(screen.getByLabelText('District (Division)')).toBeInTheDocument();
      });

      // Internal DistrictDivisionComboBox label should be hidden from screen readers
      const districtDivisionInternalLabel = document.querySelector('#new-district-division-label');
      expect(districtDivisionInternalLabel).toBeInTheDocument();
      expect(districtDivisionInternalLabel).toHaveAttribute('aria-hidden', 'true');

      const chapterInternalLabel = document.querySelector('#chapter-combobox-label');
      expect(chapterInternalLabel).toBeInTheDocument();
      expect(chapterInternalLabel).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Status Filter', () => {
    test('should render Status combobox when panel is expanded', async () => {
      const user = userEvent.setup();
      renderFilter();
      await openFiltersPanel(user);

      expect(screen.getByLabelText('Status')).toBeInTheDocument();
    });

    test('should call handleFilterStatus when a status is selected', async () => {
      const user = userEvent.setup();
      const { mockHandleFilterStatus } = renderFilter();
      await openFiltersPanel(user);

      const statusCombobox = screen.getByLabelText('Status');
      await user.click(statusCombobox);

      const inactiveOption = await screen.findByRole('option', { name: /Status Inactive/i });
      await user.click(inactiveOption);

      expect(mockHandleFilterStatus).toHaveBeenCalledWith('inactive');
    });

    test('should show current selection based on statusFilter prop', async () => {
      const user = userEvent.setup();
      renderFilter();
      await openFiltersPanel(user);

      const statusCombobox = screen.getByLabelText('Status');
      expect(statusCombobox).toHaveValue('Active');
    });

    test('should display All status pill when status filter is set to all', async () => {
      render(
        <TrusteeDistrictFilter
          handleFilterDistrict={vi.fn()}
          handleFilterChapter={vi.fn()}
          handleFilterName={vi.fn()}
          handleFilterDivision={vi.fn()}
          handleFilterStatus={vi.fn()}
          statusFilter="all"
        />,
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /All selected/i })).toBeInTheDocument();
      });
    });
  });
});
