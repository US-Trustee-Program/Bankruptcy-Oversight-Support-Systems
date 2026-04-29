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
  },
];

describe('TrusteeDistrictFilter Component', () => {
  const mockHandleFilterDistrict = vi.fn();
  const mockHandleFilterChapter = vi.fn();

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

    render(
      <TrusteeDistrictFilter
        handleFilterDistrict={mockHandleFilterDistrict}
        handleFilterChapter={mockHandleFilterChapter}
      />,
    );

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
      expect(Api2.getCourts).toHaveBeenCalled();
    });
  });

  test('should display unique districts by courtId', async () => {
    const user = userEvent.setup();
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);

    render(
      <TrusteeDistrictFilter
        handleFilterDistrict={mockHandleFilterDistrict}
        handleFilterChapter={mockHandleFilterChapter}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    // Expand the filter first
    const toggleButton = screen.getByRole('button', { name: /filters/i });
    await user.click(toggleButton);

    await waitFor(() => {
      expect(screen.getByLabelText('District (Division)')).toBeInTheDocument();
    });

    const combobox = screen.getByLabelText('District (Division)');
    await user.click(combobox);

    // Should show 2 unique districts (NYSB and VTB), not 3 divisions
    await waitFor(() => {
      expect(screen.getByText('District of Vermont (Rutland)')).toBeInTheDocument();
      expect(screen.getByText('Southern District of New York (Manhattan)')).toBeInTheDocument();
      expect(screen.getByText('Southern District of New York (White Plains)')).toBeInTheDocument();
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

    render(
      <TrusteeDistrictFilter
        handleFilterDistrict={mockHandleFilterDistrict}
        handleFilterChapter={mockHandleFilterChapter}
      />,
    );

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

    render(
      <TrusteeDistrictFilter
        handleFilterDistrict={mockHandleFilterDistrict}
        handleFilterChapter={mockHandleFilterChapter}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    // Expand the filter
    const toggleButton = screen.getByRole('button', { name: /filters/i });
    await user.click(toggleButton);

    await waitFor(() => {
      expect(screen.getByLabelText('District (Division)')).toBeInTheDocument();
    });

    const combobox = screen.getByLabelText('District (Division)');
    await user.click(combobox);

    await waitFor(() => {
      expect(screen.getByText('District of Vermont (Rutland)')).toBeInTheDocument();
    });

    const vermontOption = screen.getByText('District of Vermont (Rutland)');
    await user.click(vermontOption);

    await waitFor(() => {
      expect(mockHandleFilterDistrict).toHaveBeenCalledWith(
        expect.arrayContaining([{ value: '088', label: 'District of Vermont (Rutland)' }]),
      );
    });
  });

  test('should show selected districts as pills when collapsed', async () => {
    const user = userEvent.setup();
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);

    render(
      <TrusteeDistrictFilter
        handleFilterDistrict={mockHandleFilterDistrict}
        handleFilterChapter={mockHandleFilterChapter}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    // Expand the filter
    const toggleButton = screen.getByRole('button', { name: /filters/i });
    await user.click(toggleButton);

    await waitFor(() => {
      expect(screen.getByLabelText('District (Division)')).toBeInTheDocument();
    });

    // Select a district
    const combobox = screen.getByLabelText('District (Division)');
    await user.click(combobox);

    await waitFor(() => {
      expect(screen.getByText('District of Vermont (Rutland)')).toBeInTheDocument();
    });

    const vermontOption = screen.getByText('District of Vermont (Rutland)');
    await user.click(vermontOption);

    // Collapse the filter again
    await user.click(toggleButton);

    // Pills should be visible when collapsed
    await waitFor(() => {
      const pills = screen.getAllByText('District of Vermont (Rutland)');
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

    render(
      <TrusteeDistrictFilter
        handleFilterDistrict={mockHandleFilterDistrict}
        handleFilterChapter={mockHandleFilterChapter}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    // Pills should be visible when collapsed (default state)
    // Wait for districts to load and pill to appear
    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: /remove southern district of new york \(manhattan\) filter/i,
        }),
      ).toBeInTheDocument();
    });

    // Click remove button on pill
    const removeButton = screen.getByRole('button', {
      name: /remove southern district of new york \(manhattan\) filter/i,
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

    render(
      <TrusteeDistrictFilter
        handleFilterDistrict={mockHandleFilterDistrict}
        handleFilterChapter={mockHandleFilterChapter}
      />,
    );

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

    render(
      <TrusteeDistrictFilter
        handleFilterDistrict={mockHandleFilterDistrict}
        handleFilterChapter={mockHandleFilterChapter}
      />,
    );

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

    render(
      <TrusteeDistrictFilter
        handleFilterDistrict={mockHandleFilterDistrict}
        handleFilterChapter={mockHandleFilterChapter}
        onExpandedChange={mockOnExpandedChange}
      />,
    );

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

  test('should expose removePill method via ref', async () => {
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

    render(
      <TrusteeDistrictFilter
        ref={ref}
        handleFilterDistrict={mockHandleFilterDistrict}
        handleFilterChapter={mockHandleFilterChapter}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    // Wait for pre-populated district
    await waitFor(() => {
      expect(mockHandleFilterDistrict).toHaveBeenCalledWith(
        expect.arrayContaining([
          { value: '081', label: 'Southern District of New York (Manhattan)' },
        ]),
      );
    });

    // Call removePill via ref
    ref.current?.removePill({ value: '081', label: 'Southern District of New York (Manhattan)' });

    // Should update selection to empty
    await waitFor(() => {
      expect(mockHandleFilterDistrict).toHaveBeenCalledWith([]);
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

    render(
      <TrusteeDistrictFilter
        ref={ref}
        handleFilterDistrict={mockHandleFilterDistrict}
        handleFilterChapter={mockHandleFilterChapter}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    // Wait for pre-populated district
    await waitFor(() => {
      expect(mockHandleFilterDistrict).toHaveBeenCalledWith(
        expect.arrayContaining([
          { value: '081', label: 'Southern District of New York (Manhattan)' },
        ]),
      );
    });

    mockHandleFilterDistrict.mockClear();

    // Expand and select Vermont
    const toggleButton = screen.getByRole('button', { name: /filters/i });
    await user.click(toggleButton);

    await waitFor(() => {
      expect(screen.getByLabelText('District (Division)')).toBeInTheDocument();
    });

    const combobox = screen.getByLabelText('District (Division)');
    await user.click(combobox);

    await waitFor(() => {
      expect(screen.getByText('District of Vermont (Rutland)')).toBeInTheDocument();
    });

    const vermontOption = screen.getByText('District of Vermont (Rutland)');
    await user.click(vermontOption);

    mockHandleFilterDistrict.mockClear();

    // Call clearAll via ref - should restore defaults (NYSB)
    ref.current?.clearAll();

    await waitFor(() => {
      expect(mockHandleFilterDistrict).toHaveBeenCalledWith(
        expect.arrayContaining([
          { value: '081', label: 'Southern District of New York (Manhattan)' },
        ]),
      );
    });
  });

  describe('Chapter Filter', () => {
    test('should render chapter combobox when accordion is expanded', async () => {
      const user = userEvent.setup();
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);

      render(
        <TrusteeDistrictFilter
          handleFilterDistrict={mockHandleFilterDistrict}
          handleFilterChapter={mockHandleFilterChapter}
        />,
      );

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

      render(
        <TrusteeDistrictFilter
          handleFilterDistrict={mockHandleFilterDistrict}
          handleFilterChapter={mockHandleFilterChapter}
        />,
      );

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

      render(
        <TrusteeDistrictFilter
          handleFilterDistrict={mockHandleFilterDistrict}
          handleFilterChapter={mockHandleFilterChapter}
        />,
      );

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
        expect(screen.getByRole('button', { name: /remove 7 filter/i })).toBeInTheDocument();
      });
    });
  });
});
