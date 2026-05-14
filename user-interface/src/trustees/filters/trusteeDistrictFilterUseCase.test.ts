import { ComboOption } from '@/lib/components/combobox/ComboBox';
import {
  TrusteeDistrictFilterControls,
  TrusteeDistrictFilterStore,
} from './trusteeDistrictFilter.types';
import MockData from '@common/cams/test-utilities/mock-data';
import trusteeDistrictFilterUseCase, {
  resolveCombinedSelections,
  autoUpgradeToAll,
  getUserDivisionCodes,
} from './trusteeDistrictFilterUseCase';
import { MockInstance } from 'vitest';
import { CourtDivisionDetails } from '@common/cams/courts';
import { CamsSession } from '@common/cams/session';
import Api2 from '@/lib/models/api2';
import LocalStorage from '@/lib/utils/local-storage';
import * as AppInsights from '@/lib/hooks/UseApplicationInsights';

const mockTrackEvent = vi.fn();

describe('trustee district filter use case tests', () => {
  let setSelectedDistrictsSpy: MockInstance<(val: ComboOption[]) => void>;

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
    {
      officeName: 'White Plains',
      officeCode: '081',
      courtId: 'NYSB',
      courtName: 'Southern District of New York',
      courtDivisionCode: '087',
      courtDivisionName: 'White Plains',
      groupDesignator: 'NY',
      regionId: '02',
      regionName: 'New York Region',
      state: 'NY',
    },
  ];

  const mockOnFilterDistrict = vi.fn();
  const mockOnFilterChapter = vi.fn();
  const mockOnFilterDivision = vi.fn();

  const mockStore: TrusteeDistrictFilterStore = {
    districts: mockDistricts,
    setDistricts: vi.fn(),
    districtsError: false,
    setDistrictsError: vi.fn(),
    selectedDistricts: [],
    setSelectedDistricts: vi.fn(),
    defaultDistricts: [],
    setDefaultDistricts: vi.fn(),
    selectedChapters: [],
    setSelectedChapters: vi.fn(),
    selectedDivisions: [],
    setSelectedDivisions: vi.fn(),
    defaultDivisions: [],
    setDefaultDivisions: vi.fn(),
    isExpanded: false,
    setIsExpanded: vi.fn(),
  };

  const comboBoxRef = {
    current: {
      setSelections: (_options: ComboOption[]) => {},
      getSelections: () => [],
      clearSelections: () => {},
      disable: (_value: boolean) => {},
      focusInput: () => {},
      focus: () => {},
    },
  };

  const mockControls: TrusteeDistrictFilterControls = {
    districtFilterRef: comboBoxRef,
    chapterFilterRef: comboBoxRef,
    divisionFilterRef: comboBoxRef,
  };

  const previousDistrictsRef = { current: undefined as ComboOption[] | undefined };
  const previousChaptersRef = { current: undefined as ComboOption[] | undefined };
  const previousDivisionsRef = { current: undefined as ComboOption[] | undefined };

  const useCase = trusteeDistrictFilterUseCase(
    mockStore,
    mockControls,
    mockOnFilterDistrict,
    previousDistrictsRef,
    mockOnFilterChapter,
    previousChaptersRef,
    mockOnFilterDivision,
    previousDivisionsRef,
  );

  const useCaseWithFlag = trusteeDistrictFilterUseCase(
    mockStore,
    mockControls,
    mockOnFilterDistrict,
    previousDistrictsRef,
    mockOnFilterChapter,
    previousChaptersRef,
    mockOnFilterDivision,
    previousDivisionsRef,
    true,
  );

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(AppInsights, 'getAppInsights').mockReturnValue({
      appInsights: { trackEvent: mockTrackEvent },
    } as unknown as ReturnType<typeof AppInsights.getAppInsights>);
    mockStore.defaultDistricts = [];
    mockStore.defaultDivisions = [];
    mockStore.setSelectedDistricts = vi.fn();
    mockStore.setSelectedChapters = vi.fn();
    mockStore.setSelectedDivisions = vi.fn();
    mockStore.setDefaultDivisions = vi.fn();
    setSelectedDistrictsSpy = vi.spyOn(mockStore, 'setSelectedDistricts');
    mockOnFilterDistrict.mockReset();
    mockOnFilterChapter.mockReset();
    mockOnFilterDivision.mockReset();
    mockTrackEvent.mockReset();
    previousDistrictsRef.current = undefined;
    previousChaptersRef.current = undefined;
    previousDivisionsRef.current = undefined;
  });

  describe('districtsToComboOptions', () => {
    test('should return unique districts with all division codes, sorted by state then court name', () => {
      const comboOptions = useCase.districtsToComboOptions(mockDistricts);

      expect(comboOptions).toHaveLength(2);
      // NY sorts before VT, and Southern District of NY includes both division codes
      expect(comboOptions[0]).toEqual({
        value: '081,087',
        label: 'Southern District of New York',
      });
      expect(comboOptions[1]).toEqual({
        value: '088',
        label: 'District of Vermont',
      });
    });

    test('flag OFF: returns options with comma-joined division codes as value', () => {
      const comboOptions = useCase.districtsToComboOptions(mockDistricts);

      expect(comboOptions[0].value).toBe('081,087');
      expect(comboOptions[1].value).toBe('088');
    });

    test('flag ON: returns options with courtId as value', () => {
      const comboOptions = useCaseWithFlag.districtsToComboOptions(mockDistricts);

      expect(comboOptions).toHaveLength(2);
      expect(comboOptions[0]).toEqual({
        value: 'NYSB',
        label: 'Southern District of New York',
      });
      expect(comboOptions[1]).toEqual({
        value: 'VTB',
        label: 'District of Vermont',
      });
    });

    test('should place default districts at the top with divider', () => {
      mockStore.defaultDistricts = [{ value: '088', label: 'District of Vermont' }];

      const comboOptions = useCase.districtsToComboOptions(mockDistricts);

      expect(comboOptions).toHaveLength(2);
      // Default appears first with divider and isAriaDefault
      expect(comboOptions[0]).toEqual({
        value: '088',
        label: 'District of Vermont',
        isAriaDefault: true,
        divider: true,
      });
      // Non-defaults follow, sorted by state (Southern District of NY with both divisions)
      expect(comboOptions[1]).toEqual({
        value: '081,087',
        label: 'Southern District of New York',
      });
    });

    test('should handle empty districts array', () => {
      const comboOptions = useCase.districtsToComboOptions([]);

      expect(comboOptions).toEqual([]);
    });

    test('should deduplicate districts and include all division codes in value', () => {
      const multiDivisionDistricts: CourtDivisionDetails[] = [
        ...mockDistricts,
        {
          ...mockDistricts[0],
          courtDivisionCode: '999',
          courtDivisionName: 'Another Division',
        },
      ];

      const comboOptions = useCase.districtsToComboOptions(multiDivisionDistricts);

      // Should have 2 unique districts (Southern District of NY and District of VT)
      expect(comboOptions).toHaveLength(2);
      // Southern District of NY should now include 3 division codes
      expect(comboOptions[0].value).toBe('081,087,999');
      expect(comboOptions[0].label).toBe('Southern District of New York');
    });
  });

  describe('getDefaultDistrictsFromSession', () => {
    test('should return empty array when session is null or user has no offices', () => {
      // Null session
      const defaultDistrictsNull = useCase.getDefaultDistrictsFromSession(null, mockDistricts);
      expect(defaultDistrictsNull).toEqual([]);

      // Empty offices
      const sessionNoOffices: CamsSession = {
        ...MockData.getCamsSession(),
        user: {
          ...MockData.getCamsSession().user,
          offices: [],
        },
      };
      const defaultDistrictsEmpty = useCase.getDefaultDistrictsFromSession(
        sessionNoOffices,
        mockDistricts,
      );
      expect(defaultDistrictsEmpty).toEqual([]);
    });

    test('should extract divisionCodes from user office groups and return matching divisions', () => {
      const session: CamsSession = {
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

      const defaultDistricts = useCase.getDefaultDistrictsFromSession(session, mockDistricts);

      expect(defaultDistricts).toHaveLength(1);
      expect(defaultDistricts[0]).toEqual({
        value: '081,087',
        label: 'Southern District of New York',
      });
    });

    test('should return multiple districts when user has multiple office groups', () => {
      const session: CamsSession = {
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
            {
              officeCode: '088',
              officeName: 'Rutland',
              idpGroupName: 'Rutland',
              regionId: '01',
              regionName: 'Boston Region',
              groups: [
                {
                  groupDesignator: 'VT',
                  divisions: [
                    {
                      divisionCode: '088',
                      court: {
                        courtId: 'VTB',
                        courtName: 'District of Vermont',
                      },
                      courtOffice: {
                        courtOfficeCode: '088',
                        courtOfficeName: 'Rutland',
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      };

      const defaultDistricts = useCase.getDefaultDistrictsFromSession(session, mockDistricts);

      expect(defaultDistricts).toHaveLength(2);
      expect(defaultDistricts).toEqual(
        expect.arrayContaining([
          { value: '081,087', label: 'Southern District of New York' },
          { value: '088', label: 'District of Vermont' },
        ]),
      );
    });

    test('should sort default districts by state and return empty for groups with no divisions', () => {
      const sessionWithDivisions: CamsSession = {
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
                      court: { courtId: 'NYSB', courtName: 'Southern District of New York' },
                      courtOffice: { courtOfficeCode: '081', courtOfficeName: 'Manhattan' },
                    },
                    {
                      divisionCode: '088',
                      court: { courtId: 'VTB', courtName: 'District of Vermont' },
                      courtOffice: { courtOfficeCode: '088', courtOfficeName: 'Rutland' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      };

      const sorted = useCase.getDefaultDistrictsFromSession(sessionWithDivisions, mockDistricts);
      // Sorted by state: NY before VT
      expect(sorted[0].label).toBe('Southern District of New York');
      expect(sorted[1].label).toBe('District of Vermont');

      const sessionNoDivisions: CamsSession = {
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
              groups: [{ groupDesignator: 'NY', divisions: [] }],
            },
          ],
        },
      };

      const empty = useCase.getDefaultDistrictsFromSession(sessionNoDivisions, mockDistricts);
      expect(empty).toEqual([]);
    });
  });

  describe('handleClearAll', () => {
    test('should clear all selected districts and notify', () => {
      mockStore.selectedDistricts = [{ value: 'NYSB', label: 'Southern District of New York' }];

      useCase.handleClearAll();

      expect(setSelectedDistrictsSpy).toHaveBeenCalledWith([]);
      expect(mockOnFilterDistrict).toHaveBeenCalledWith([]);
    });
  });

  describe('handleToggleExpanded', () => {
    test('should toggle isExpanded state between true and false', () => {
      const setIsExpandedSpy = vi.spyOn(mockStore, 'setIsExpanded');

      // Toggle from false to true
      mockStore.isExpanded = false;
      useCase.handleToggleExpanded();
      expect(setIsExpandedSpy).toHaveBeenCalledWith(true);

      // Toggle from true to false
      mockStore.isExpanded = true;
      useCase.handleToggleExpanded();
      expect(setIsExpandedSpy).toHaveBeenCalledWith(false);
    });
  });

  describe('handleFilterChange', () => {
    test('should update selected districts and trigger callback', () => {
      const newDistricts: ComboOption[] = [
        { value: 'NYSB', label: 'Southern District of New York' },
      ];

      useCase.handleFilterChange(newDistricts);

      expect(setSelectedDistrictsSpy).toHaveBeenCalledWith(newDistricts);
      expect(mockOnFilterDistrict).toHaveBeenCalledWith(newDistricts);
    });

    test('should track Trustee District Filter Cleared event only when transitioning from non-empty to empty', () => {
      // First call with non-empty selection (establishes previous state)
      useCase.handleFilterChange([{ value: 'NYSB', label: 'Southern District of New York' }]);
      expect(mockTrackEvent).not.toHaveBeenCalled();

      // Second call with empty array (user-driven clear)
      useCase.handleFilterChange([]);
      expect(mockTrackEvent).toHaveBeenCalledWith({ name: 'Trustee District Filter Cleared' });
    });

    test('should not track Trustee District Filter Cleared on initial empty call', () => {
      // First call with empty array (initial/programmatic, not user-driven)
      useCase.handleFilterChange([]);

      expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    test('should not track Trustee District Filter Cleared when districts are selected', () => {
      useCase.handleFilterChange([{ value: 'NYSB', label: 'Southern District of New York' }]);

      expect(mockTrackEvent).not.toHaveBeenCalledWith({ name: 'Trustee District Filter Cleared' });
    });
  });

  describe('focusOnDistrictFilter', () => {
    test('should call focusInput on combobox ref', () => {
      const focusInputSpy = vi.spyOn(comboBoxRef.current, 'focusInput');

      useCase.focusOnDistrictFilter();

      expect(focusInputSpy).toHaveBeenCalled();
    });
  });

  describe('chaptersToComboOptions', () => {
    test('should return all 5 chapter options with correct labels', () => {
      const options = useCase.chaptersToComboOptions();

      expect(options).toHaveLength(5);
      expect(options).toEqual([
        { value: '7', label: '7', selectedLabel: '7' },
        { value: '11', label: '11', selectedLabel: '11' },
        { value: '11-subchapter-v', label: '11 Subchapter V', selectedLabel: '11 Subchapter V' },
        { value: '12', label: '12', selectedLabel: '12' },
        { value: '13', label: '13', selectedLabel: '13' },
      ]);
    });
  });

  describe('handleFilterChapter', () => {
    test('should update selected chapters and trigger callback', () => {
      const setSelectedChaptersSpy = vi.spyOn(mockStore, 'setSelectedChapters');
      const chapters: ComboOption[] = [{ value: '7', label: '7' }];

      useCase.handleFilterChapter(chapters);

      expect(setSelectedChaptersSpy).toHaveBeenCalledWith(chapters);
      expect(mockOnFilterChapter).toHaveBeenCalledWith(chapters);
    });

    test('should fire Trustee Chapter Filter Cleared only when transitioning non-empty to empty', () => {
      useCase.handleFilterChapter([{ value: '7', label: '7' }]);
      expect(mockTrackEvent).not.toHaveBeenCalled();

      useCase.handleFilterChapter([]);
      expect(mockTrackEvent).toHaveBeenCalledWith({ name: 'Trustee Chapter Filter Cleared' });
    });

    test('should not fire Trustee Chapter Filter Cleared on initial empty call', () => {
      useCase.handleFilterChapter([]);
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });
  });

  describe('handleClearAllChapters', () => {
    test('should clear selected chapters and notify', () => {
      const setSelectedChaptersSpy = vi.spyOn(mockStore, 'setSelectedChapters');

      useCase.handleClearAllChapters();

      expect(setSelectedChaptersSpy).toHaveBeenCalledWith([]);
      expect(mockOnFilterChapter).toHaveBeenCalledWith([]);
    });
  });

  describe('fetchDistricts', () => {
    beforeEach(() => {
      mockStore.setDistricts = vi.fn();
      mockStore.setDistrictsError = vi.fn();
      mockStore.setDefaultDistricts = vi.fn();
      mockStore.setSelectedDistricts = vi.fn();
    });

    test('should call onFilterDistrict with empty array when session has no matching offices', async () => {
      vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: mockDistricts });
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);

      await useCase.fetchDistricts();

      expect(mockOnFilterDistrict).toHaveBeenCalledWith([]);
    });

    test('should call onFilterDistrict with defaults when user has matching offices', async () => {
      vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: mockDistricts });
      const session: CamsSession = {
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
                      court: { courtId: 'NYSB', courtName: 'Southern District of New York' },
                      courtOffice: { courtOfficeCode: '081', courtOfficeName: 'Manhattan' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      };
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);

      await useCase.fetchDistricts();

      expect(mockOnFilterDistrict).toHaveBeenCalledWith([
        { value: '081,087', label: 'Southern District of New York' },
      ]);
    });

    test('should set districtsError on API failure', async () => {
      vi.spyOn(Api2, 'getCourts').mockRejectedValue(new Error('API error'));
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);
      const setDistrictsErrorSpy = vi.spyOn(mockStore, 'setDistrictsError');

      await useCase.fetchDistricts();

      expect(setDistrictsErrorSpy).toHaveBeenCalledWith(true);
    });

    test('flag ON: sets default divisions from user session and calls onFilterDivision', async () => {
      vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: mockDistricts });
      const session: CamsSession = {
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
                      court: { courtId: 'NYSB', courtName: 'Southern District of New York' },
                      courtOffice: { courtOfficeCode: '081', courtOfficeName: 'Manhattan' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      };
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
      const setDefaultDivisionsSpy = vi.spyOn(mockStore, 'setDefaultDivisions');
      const setSelectedDivisionsSpy = vi.spyOn(mockStore, 'setSelectedDivisions');

      await useCaseWithFlag.fetchDistricts();

      const expectedDivisions = [
        {
          value: 'NYSB|081',
          label: 'Southern District of New York (Manhattan)',
          selectedLabel: 'Manhattan',
        },
      ];
      expect(setDefaultDivisionsSpy).toHaveBeenCalledWith(expectedDivisions);
      expect(setSelectedDivisionsSpy).toHaveBeenCalledWith(expectedDivisions);
      expect(mockOnFilterDivision).toHaveBeenCalledWith(expectedDivisions);
    });

    test('flag ON: only includes divisions the user belongs to, not all district divisions', async () => {
      vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: mockDistricts });
      const session: CamsSession = {
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
                      court: { courtId: 'NYSB', courtName: 'Southern District of New York' },
                      courtOffice: { courtOfficeCode: '081', courtOfficeName: 'Manhattan' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      };
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);

      await useCaseWithFlag.fetchDistricts();

      const divisionCall = mockOnFilterDivision.mock.calls[0][0] as ComboOption[];
      expect(divisionCall).toHaveLength(1);
      expect(divisionCall[0].value).toBe('NYSB|081');
      expect(divisionCall.find((d) => d.value === 'NYSB|087')).toBeUndefined();
    });

    test('flag ON: does not call onFilterDivision when session has no offices', async () => {
      vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: mockDistricts });
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);

      await useCaseWithFlag.fetchDistricts();

      expect(mockOnFilterDivision).not.toHaveBeenCalled();
    });
  });

  describe('handleFilterDivision', () => {
    test('should update selected divisions and trigger callback', () => {
      const setSelectedDivisionsSpy = vi.spyOn(mockStore, 'setSelectedDivisions');
      const divisions: ComboOption[] = [{ value: '081', label: 'Manhattan' }];

      useCase.handleFilterDivision(divisions);

      expect(setSelectedDivisionsSpy).toHaveBeenCalledWith(divisions);
      expect(mockOnFilterDivision).toHaveBeenCalledWith(divisions);
    });

    test('should fire Trustee Division Filter Cleared only when transitioning non-empty to empty', () => {
      useCase.handleFilterDivision([{ value: '081', label: 'Manhattan' }]);
      expect(mockTrackEvent).not.toHaveBeenCalled();

      useCase.handleFilterDivision([]);
      expect(mockTrackEvent).toHaveBeenCalledWith({ name: 'Trustee Division Filter Cleared' });
    });

    test('should not fire Trustee Division Filter Cleared on initial empty call', () => {
      useCase.handleFilterDivision([]);
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });
  });

  describe('handleClearAllDivisions', () => {
    test('should clear selected divisions and notify', () => {
      const setSelectedDivisionsSpy = vi.spyOn(mockStore, 'setSelectedDivisions');

      useCase.handleClearAllDivisions();

      expect(setSelectedDivisionsSpy).toHaveBeenCalledWith([]);
      expect(mockOnFilterDivision).toHaveBeenCalledWith([]);
    });
  });

  describe('handleFilterChange (cascading division clear)', () => {
    test('should clear divisions when district filter changes and flag is ON', () => {
      const setSelectedDivisionsSpy = vi.spyOn(mockStore, 'setSelectedDivisions');
      previousDivisionsRef.current = [{ value: '081', label: 'Manhattan' }];

      const newDistricts: ComboOption[] = [{ value: 'VTB', label: 'District of Vermont' }];
      useCaseWithFlag.handleFilterChange(newDistricts);

      expect(setSelectedDivisionsSpy).toHaveBeenCalledWith([]);
      expect(mockOnFilterDivision).toHaveBeenCalledWith([]);
    });

    test('should NOT clear divisions when district filter changes and flag is OFF', () => {
      const setSelectedDivisionsSpy = vi.spyOn(mockStore, 'setSelectedDivisions');
      previousDivisionsRef.current = [{ value: '081', label: 'Manhattan' }];

      const newDistricts: ComboOption[] = [{ value: 'VTB', label: 'District of Vermont' }];
      useCase.handleFilterChange(newDistricts);

      expect(setSelectedDivisionsSpy).not.toHaveBeenCalledWith([]);
    });
  });

  describe('handleFilterCombined', () => {
    test('should update divisions and trigger callback', () => {
      const setSelectedDivisionsSpy = vi.spyOn(mockStore, 'setSelectedDivisions');
      const selections: ComboOption[] = [
        { value: 'NYSB|081', label: 'Southern District of New York (Manhattan)' },
      ];

      useCase.handleFilterCombined(selections);

      expect(setSelectedDivisionsSpy).toHaveBeenCalledWith(selections);
      expect(mockOnFilterDivision).toHaveBeenCalledWith(selections);
    });

    test('should clear divisions when empty array passed', () => {
      const setSelectedDivisionsSpy = vi.spyOn(mockStore, 'setSelectedDivisions');

      useCase.handleFilterCombined([]);

      expect(setSelectedDivisionsSpy).toHaveBeenCalledWith([]);
      expect(mockOnFilterDivision).toHaveBeenCalledWith([]);
    });

    test('auto-upgrades to ALL when all divisions in a district are individually selected', () => {
      const setSelectedDivisionsSpy = vi.spyOn(mockStore, 'setSelectedDivisions');
      const selections: ComboOption[] = [
        { value: 'NYSB|081', label: 'Southern District of New York (Manhattan)' },
        { value: 'NYSB|087', label: 'Southern District of New York (White Plains)' },
      ];

      useCase.handleFilterCombined(selections);

      const stored = setSelectedDivisionsSpy.mock.calls[0][0];
      expect(stored).toHaveLength(1);
      expect(stored[0].value).toBe('NYSB|ALL');
      expect(mockOnFilterDivision).toHaveBeenCalledWith(stored);
    });
  });
});

describe('autoUpgradeToAll', () => {
  const nysbDistricts = [
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
  ];

  const vtbDistricts = [
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

  const allDistricts = [...nysbDistricts, ...vtbDistricts];

  test('returns selections unchanged when not all divisions are selected', () => {
    const selections: ComboOption[] = [
      { value: 'NYSB|081', label: 'Southern District of New York (Manhattan)' },
    ];
    expect(autoUpgradeToAll(selections, allDistricts)).toEqual(selections);
  });

  test('upgrades to ALL when all divisions in a district are individually selected', () => {
    const selections: ComboOption[] = [
      { value: 'NYSB|081', label: 'Southern District of New York (Manhattan)' },
      { value: 'NYSB|087', label: 'Southern District of New York (White Plains)' },
    ];
    const result = autoUpgradeToAll(selections, allDistricts);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe('NYSB|ALL');
    expect(result[0].label).toBe('Southern District of New York (All)');
    expect(result[0].selectedLabel).toBe('Southern District of New York (All)');
  });

  test('does not upgrade a district that is only partially selected', () => {
    const selections: ComboOption[] = [
      { value: 'NYSB|081', label: 'Southern District of New York (Manhattan)' },
    ];
    const result = autoUpgradeToAll(selections, allDistricts);
    expect(result).toEqual(selections);
    expect(result.find((s) => s.value === 'NYSB|ALL')).toBeUndefined();
  });

  test('upgrades only the fully-selected district, leaves others unchanged', () => {
    const selections: ComboOption[] = [
      { value: 'NYSB|081', label: 'Southern District of New York (Manhattan)' },
      { value: 'NYSB|087', label: 'Southern District of New York (White Plains)' },
      { value: 'VTB|088', label: 'District of Vermont (Rutland)' },
    ];
    const result = autoUpgradeToAll(selections, allDistricts);
    // VTB has only one division, so it gets upgraded too
    // NYSB gets upgraded since both divisions selected
    expect(result.find((s) => s.value === 'NYSB|ALL')).toBeDefined();
    expect(result.find((s) => s.value === 'VTB|ALL')).toBeDefined();
    expect(result.find((s) => s.value === 'NYSB|081')).toBeUndefined();
    expect(result.find((s) => s.value === 'NYSB|087')).toBeUndefined();
    expect(result.find((s) => s.value === 'VTB|088')).toBeUndefined();
  });

  test('returns selections unchanged when ALL already selected', () => {
    const selections: ComboOption[] = [
      { value: 'NYSB|ALL', label: 'Southern District of New York (All)' },
    ];
    expect(autoUpgradeToAll(selections, allDistricts)).toEqual(selections);
  });

  test('returns empty array when given empty selections', () => {
    expect(autoUpgradeToAll([], allDistricts)).toEqual([]);
  });

  test('returns selections unchanged when no districts provided', () => {
    const selections: ComboOption[] = [
      { value: 'NYSB|081', label: 'Southern District of New York (Manhattan)' },
    ];
    expect(autoUpgradeToAll(selections, [])).toEqual(selections);
  });
});

describe('resolveCombinedSelections', () => {
  test('returns empty array when next is empty', () => {
    const previous = [{ value: 'NYSB|081', label: 'Manhattan' }];
    expect(resolveCombinedSelections(previous, [])).toEqual([]);
  });

  test('returns next unchanged when no new options were added', () => {
    const selections = [{ value: 'NYSB|081', label: 'Manhattan' }];
    expect(resolveCombinedSelections(selections, selections)).toEqual(selections);
  });

  test('selecting ALL removes specific divisions for that court', () => {
    const previous = [{ value: 'NYSB|081', label: 'Manhattan' }];
    const next = [
      { value: 'NYSB|081', label: 'Manhattan' },
      { value: 'NYSB|ALL', label: 'Southern District of New York (All)' },
    ];
    expect(resolveCombinedSelections(previous, next)).toEqual([
      { value: 'NYSB|ALL', label: 'Southern District of New York (All)' },
    ]);
  });

  test('selecting a specific division removes ALL for that court', () => {
    const previous = [{ value: 'NYSB|ALL', label: 'Southern District of New York (All)' }];
    const next = [
      { value: 'NYSB|ALL', label: 'Southern District of New York (All)' },
      { value: 'NYSB|081', label: 'Manhattan' },
    ];
    expect(resolveCombinedSelections(previous, next)).toEqual([
      { value: 'NYSB|081', label: 'Manhattan' },
    ]);
  });

  test('mutual exclusion only applies within the same court', () => {
    const previous = [{ value: 'VTB|088', label: 'Rutland' }];
    const next = [
      { value: 'VTB|088', label: 'Rutland' },
      { value: 'NYSB|ALL', label: 'Southern District of New York (All)' },
    ];
    const result = resolveCombinedSelections(previous, next);
    expect(result).toContainEqual({ value: 'VTB|088', label: 'Rutland' });
    expect(result).toContainEqual({
      value: 'NYSB|ALL',
      label: 'Southern District of New York (All)',
    });
  });
});

describe('getUserDivisionCodes', () => {
  test('returns empty set when session is null', () => {
    expect(getUserDivisionCodes(null).size).toBe(0);
  });

  test('returns empty set when session has no offices', () => {
    const session = {
      ...MockData.getCamsSession(),
      user: { ...MockData.getCamsSession().user, offices: [] },
    };
    expect(getUserDivisionCodes(session).size).toBe(0);
  });

  test('collects division codes from all offices and groups', () => {
    const session: CamsSession = {
      ...MockData.getCamsSession(),
      user: {
        ...MockData.getCamsSession().user,
        offices: [
          {
            officeCode: '081',
            officeName: 'Manhattan',
            idpGroupName: 'Manhattan',
            regionId: '02',
            regionName: 'New York',
            groups: [
              {
                groupDesignator: 'NY',
                divisions: [
                  {
                    divisionCode: '081',
                    court: { courtId: 'NYSB', courtName: 'SDNY' },
                    courtOffice: { courtOfficeCode: '081', courtOfficeName: 'Manhattan' },
                  },
                  {
                    divisionCode: '087',
                    court: { courtId: 'NYSB', courtName: 'SDNY' },
                    courtOffice: { courtOfficeCode: '087', courtOfficeName: 'White Plains' },
                  },
                ],
              },
            ],
          },
          {
            officeCode: '088',
            officeName: 'Rutland',
            idpGroupName: 'Rutland',
            regionId: '01',
            regionName: 'Boston',
            groups: [
              {
                groupDesignator: 'VT',
                divisions: [
                  {
                    divisionCode: '088',
                    court: { courtId: 'VTB', courtName: 'Vermont' },
                    courtOffice: { courtOfficeCode: '088', courtOfficeName: 'Rutland' },
                  },
                ],
              },
            ],
          },
        ],
      },
    };
    const codes = getUserDivisionCodes(session);
    expect(codes).toEqual(new Set(['081', '087', '088']));
  });
});
