import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TrusteeDistrictFilter from './TrusteeDistrictFilter';
import Api2 from '@/lib/models/api2';
import { CourtDivisionDetails } from '@common/cams/courts';
import { ResponseBody } from '@common/api/response';
import { vi } from 'vitest';
import LocalStorage from '@/lib/utils/local-storage';
import MockData from '@common/cams/test-utilities/mock-data';
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
  render(
    <TrusteeDistrictFilter
      ref={overrides.ref}
      handleFilterDistrict={mockHandleFilterDistrict}
      handleFilterChapter={mockHandleFilterChapter}
      handleFilterName={mockHandleFilterName}
      onExpandedChange={overrides.onExpandedChange}
    />,
  );
  return { mockHandleFilterDistrict, mockHandleFilterChapter, mockHandleFilterName };
}

describe('TrusteeDistrictFilter Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mockResponse: ResponseBody<CourtDivisionDetails[]> = { data: mockDistricts };
    vi.spyOn(Api2, 'getCourts').mockResolvedValue(mockResponse);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should render collapsed by default and expand when toggle button clicked, loading districts from API', async () => {
    const user = userEvent.setup();
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);

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
      expect(screen.getByLabelText('District')).toBeInTheDocument();
      expect(Api2.getCourts).toHaveBeenCalled();
    });
  });

  test('should display unique districts by courtId', async () => {
    const user = userEvent.setup();
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);

    renderFilter();

    await waitFor(() => {
      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    // Expand the filter first
    const toggleButton = screen.getByRole('button', { name: /filters/i });
    await user.click(toggleButton);

    await waitFor(() => {
      expect(screen.getByLabelText('District')).toBeInTheDocument();
    });

    const combobox = screen.getByLabelText('District');
    await user.click(combobox);

    // Should show 2 unique districts (NYSB and VTB)
    await waitFor(() => {
      expect(screen.getByText('District of Vermont')).toBeInTheDocument();
      expect(screen.getByText('Southern District of New York')).toBeInTheDocument();
    });
  });

  test('should pre-populate districts based on user session', async () => {
    const user = userEvent.setup();
    const session = {
      ...MockData.getCamsSession(),
      user: {
        ...MockData.getCamsSession().user,
        offices: [
          {
            officeCode: '081',
            officeName: 'Manhattan',
            idpGroupName: 'Manhattan',
            regionId: '02',
            regionName: 'New York Region',
            groups: [
              {
                groupDesignator: 'NY',
                divisions: [
                  {
                    divisionCode: '081',
                    court: {
                      courtId: 'NYSB',
                      courtName: 'Southern District of New York',
                    },
                    courtOffice: {
                      courtOfficeCode: '081',
                      courtOfficeName: 'Manhattan',
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    };
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);

    renderFilter();

    // Wait for component to render
    await waitFor(() => {
      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    // Expand to see the district filter
    const toggleButton = screen.getByRole('button', { name: /filters/i });
    await user.click(toggleButton);

    // Verify the district is pre-selected in the UI
    await waitFor(() => {
      const description = screen.getByText(
        /1 items currently selected. Southern District of New York/,
      );
      expect(description).toBeInTheDocument();
    });
  });

  test('should call handleFilterDistrict when selection changes', async () => {
    const user = userEvent.setup();
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);

    const { mockHandleFilterDistrict } = renderFilter();

    await waitFor(() => {
      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    // Expand the filter
    const toggleButton = screen.getByRole('button', { name: /filters/i });
    await user.click(toggleButton);

    await waitFor(() => {
      expect(screen.getByLabelText('District')).toBeInTheDocument();
    });

    const combobox = screen.getByLabelText('District');
    await user.click(combobox);

    await waitFor(() => {
      expect(screen.getByText('District of Vermont')).toBeInTheDocument();
    });

    const vermontOption = screen.getByText('District of Vermont');
    await user.click(vermontOption);

    await waitFor(() => {
      expect(mockHandleFilterDistrict).toHaveBeenCalledWith(
        expect.arrayContaining([{ value: '088', label: 'District of Vermont' }]),
      );
    });
  });

  test('should show selected districts as pills when collapsed', async () => {
    const user = userEvent.setup();
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);

    renderFilter();

    await waitFor(() => {
      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    // Expand the filter
    const toggleButton = screen.getByRole('button', { name: /filters/i });
    await user.click(toggleButton);

    await waitFor(() => {
      expect(screen.getByLabelText('District')).toBeInTheDocument();
    });

    // Select a district
    const combobox = screen.getByLabelText('District');
    await user.click(combobox);

    await waitFor(() => {
      expect(screen.getByText('District of Vermont')).toBeInTheDocument();
    });

    const vermontOption = screen.getByText('District of Vermont');
    await user.click(vermontOption);

    // Collapse the filter again
    await user.click(toggleButton);

    // Pills should be visible when collapsed
    await waitFor(() => {
      const pills = screen.getAllByText('District of Vermont');
      expect(pills.length).toBeGreaterThan(0);
    });
  });

  test('should remove district when pill close button clicked', async () => {
    const user = userEvent.setup();
    const session = {
      ...MockData.getCamsSession(),
      user: {
        ...MockData.getCamsSession().user,
        offices: [
          {
            officeCode: '081',
            officeName: 'Manhattan',
            idpGroupName: 'Manhattan',
            regionId: '02',
            regionName: 'New York Region',
            groups: [
              {
                groupDesignator: 'NY',
                divisions: [
                  {
                    divisionCode: '081',
                    court: {
                      courtId: 'NYSB',
                      courtName: 'Southern District of New York',
                    },
                    courtOffice: {
                      courtOfficeCode: '081',
                      courtOfficeName: 'Manhattan',
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    };
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);

    const { mockHandleFilterDistrict } = renderFilter();

    await waitFor(() => {
      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    // Pills should be visible when collapsed (default state)
    // Wait for districts to load and pill to appear
    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: /southern district of new york selected\. click to deselect\./i,
        }),
      ).toBeInTheDocument();
    });

    // Click remove button on pill
    const removeButton = screen.getByRole('button', {
      name: /southern district of new york selected\. click to deselect\./i,
    });
    await user.click(removeButton);

    // Should return to default (which is the same district in this case, so callback called)
    await waitFor(() => {
      expect(mockHandleFilterDistrict).toHaveBeenCalled();
    });
  });

  test('should display error message when API fails', async () => {
    const user = userEvent.setup();
    vi.spyOn(Api2, 'getCourts').mockRejectedValue(new Error('API Error'));
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);

    renderFilter();

    await waitFor(() => {
      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    // Expand to see error message
    const toggleButton = screen.getByRole('button', { name: /filters/i });
    await user.click(toggleButton);

    await waitFor(() => {
      expect(
        screen.getByText('Unable to load district filter options. Please try refreshing the page.'),
      ).toBeInTheDocument();
    });
  });

  test('should handle empty user session gracefully', async () => {
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);

    const { mockHandleFilterDistrict } = renderFilter();

    await waitFor(() => {
      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    // Should not call callback with empty selection on mount (no default)
    expect(mockHandleFilterDistrict).not.toHaveBeenCalled();
  });

  test('should call onExpandedChange callback when toggling between collapsed and expanded states', async () => {
    const user = userEvent.setup();
    const mockOnExpandedChange = vi.fn();
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);

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
      expect(screen.getByLabelText('District')).toBeInTheDocument();
    });

    // Collapse
    await user.click(toggleButton);
    await waitFor(() => {
      expect(mockOnExpandedChange).toHaveBeenCalledWith(false);
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    });
  });

  test('should expose clearAll method via ref', async () => {
    const user = userEvent.setup();
    const ref = { current: null } as unknown as React.RefObject<TrusteeDistrictFilterRef>;
    const session = {
      ...MockData.getCamsSession(),
      user: {
        ...MockData.getCamsSession().user,
        offices: [
          {
            officeCode: '081',
            officeName: 'Manhattan',
            idpGroupName: 'Manhattan',
            regionId: '02',
            regionName: 'New York Region',
            groups: [
              {
                groupDesignator: 'NY',
                divisions: [
                  {
                    divisionCode: '081',
                    court: {
                      courtId: 'NYSB',
                      courtName: 'Southern District of New York',
                    },
                    courtOffice: {
                      courtOfficeCode: '081',
                      courtOfficeName: 'Manhattan',
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    };
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);

    const { mockHandleFilterDistrict } = renderFilter({ ref });

    await waitFor(() => {
      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    // Wait for pre-populated district
    await waitFor(() => {
      expect(mockHandleFilterDistrict).toHaveBeenCalledWith(
        expect.arrayContaining([{ value: '081,087', label: 'Southern District of New York' }]),
      );
    });

    mockHandleFilterDistrict.mockClear();

    // Expand and select Vermont
    const toggleButton = screen.getByRole('button', { name: /filters/i });
    await user.click(toggleButton);

    await waitFor(() => {
      expect(screen.getByLabelText('District')).toBeInTheDocument();
    });

    const combobox = screen.getByLabelText('District');
    await user.click(combobox);

    await waitFor(() => {
      expect(screen.getByText('District of Vermont')).toBeInTheDocument();
    });

    const vermontOption = screen.getByText('District of Vermont');
    await user.click(vermontOption);

    mockHandleFilterDistrict.mockClear();

    // Call clearAll via ref - should clear to empty array
    ref.current?.clearAll();

    await waitFor(() => {
      expect(mockHandleFilterDistrict).toHaveBeenCalledWith([]);
    });
  });

  describe('Name Filter', () => {
    test('renders name input inside accordion when expanded', async () => {
      const user = userEvent.setup();
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);

      renderFilter();

      const toggleButton = screen.getByRole('button', { name: /filters/i });
      await user.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /trustee name/i })).toBeInTheDocument();
      });
    });

    test('does not show Clear button when name input is empty', async () => {
      const user = userEvent.setup();
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);

      renderFilter();

      const toggleButton = screen.getByRole('button', { name: /filters/i });
      await user.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /trustee name/i })).toBeInTheDocument();
      });

      const clearButtons = screen.queryAllByRole('button', { name: /^clear$/i });
      expect(clearButtons).toHaveLength(0);
    });

    test('shows Clear button when name input has text', async () => {
      const user = userEvent.setup();
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);

      renderFilter();

      const toggleButton = screen.getByRole('button', { name: /filters/i });
      await user.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /trustee name/i })).toBeInTheDocument();
      });

      await user.type(screen.getByRole('textbox', { name: /trustee name/i }), 'Smith');

      expect(screen.getByRole('button', { name: /^clear$/i })).toBeInTheDocument();
    });

    test('Clear button click empties input and calls handleFilterName with empty string', async () => {
      const user = userEvent.setup();
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);

      const { mockHandleFilterName } = renderFilter();

      const toggleButton = screen.getByRole('button', { name: /filters/i });
      await user.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /trustee name/i })).toBeInTheDocument();
      });

      await user.type(screen.getByRole('textbox', { name: /trustee name/i }), 'Smith');
      await user.click(screen.getByRole('button', { name: /^clear$/i }));

      expect(screen.getByRole('textbox', { name: /trustee name/i })).toHaveValue('');
      expect(mockHandleFilterName).toHaveBeenLastCalledWith('');
    });

    test('typing calls handleFilterName with current value', async () => {
      const user = userEvent.setup();
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);

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
    test('should render chapter combobox when accordion is expanded', async () => {
      const user = userEvent.setup();
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);

      renderFilter();

      await waitFor(() => {
        expect(screen.getByText('Filters')).toBeInTheDocument();
      });

      const toggleButton = screen.getByRole('button', { name: /filters/i });
      await user.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByLabelText('Chapter')).toBeInTheDocument();
      });
    });

    test('should call handleFilterChapter when a chapter is selected', async () => {
      const user = userEvent.setup();
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);

      const { mockHandleFilterChapter } = renderFilter();

      expect(await screen.findByText('Filters')).toBeInTheDocument();

      const toggleButton = screen.getByRole('button', { name: /filters/i });
      await user.click(toggleButton);

      expect(await screen.findByLabelText('Chapter')).toBeInTheDocument();

      const chapterCombobox = screen.getByLabelText('Chapter');
      await user.click(chapterCombobox);

      expect(await screen.findByText('11 Subchapter V')).toBeInTheDocument();

      await user.click(screen.getByText('11 Subchapter V'));

      await waitFor(() => {
        expect(mockHandleFilterChapter).toHaveBeenCalledWith(
          expect.arrayContaining([{ value: '11-subchapter-v', label: '11 Subchapter V' }]),
        );
      });
    });

    test('should render chapter pill when chapter is selected and accordion is collapsed', async () => {
      const user = userEvent.setup();
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);

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
});
