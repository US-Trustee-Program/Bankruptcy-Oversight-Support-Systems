import { ComboOption } from '@/lib/components/combobox/ComboBox';
import {
  TrusteeDistrictFilterControls,
  TrusteeDistrictFilterStore,
} from './trusteeDistrictFilter.types';
import MockData from '@common/cams/test-utilities/mock-data';
import trusteeDistrictFilterUseCase from './trusteeDistrictFilterUseCase';
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
    isExpanded: false,
    setIsExpanded: vi.fn(),
  };

  const comboBoxRef = {
    current: {
      setSelections: vi.fn(),
      getSelections: vi.fn(),
      clearSelections: vi.fn(),
      disable: vi.fn(),
      focusInput: vi.fn(),
      focus: vi.fn(),
    },
  };

  const mockControls: TrusteeDistrictFilterControls = {
    districtFilterRef: comboBoxRef,
    chapterFilterRef: comboBoxRef,
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

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(AppInsights, 'getAppInsights').mockReturnValue({
      appInsights: { trackEvent: mockTrackEvent },
    } as unknown as ReturnType<typeof AppInsights.getAppInsights>);
    mockStore.defaultDistricts = [];
    mockStore.setSelectedDistricts = vi.fn();
    mockStore.setSelectedChapters = vi.fn();
    mockStore.setSelectedDivisions = vi.fn();
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
    test('should return unique districts with courtId as value, sorted by state then court name', () => {
      const comboOptions = useCase.districtsToComboOptions(mockDistricts);

      expect(comboOptions).toHaveLength(2);
      // NY sorts before VT
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
      mockStore.defaultDistricts = [{ value: 'VTB', label: 'District of Vermont' }];

      const comboOptions = useCase.districtsToComboOptions(mockDistricts);

      expect(comboOptions).toHaveLength(2);
      // Default appears first with divider and isAriaDefault
      expect(comboOptions[0]).toEqual({
        value: 'VTB',
        label: 'District of Vermont',
        isAriaDefault: true,
        divider: true,
      });
      // Non-defaults follow, sorted by state (Southern District of NY)
      expect(comboOptions[1]).toEqual({
        value: 'NYSB',
        label: 'Southern District of New York',
      });
    });

    test('should handle empty districts array', () => {
      const comboOptions = useCase.districtsToComboOptions([]);

      expect(comboOptions).toEqual([]);
    });

    test('should deduplicate districts by courtId', () => {
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
      // Southern District of NY uses courtId as value regardless of division count
      expect(comboOptions[0].value).toBe('NYSB');
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
        value: 'NYSB',
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
          { value: 'NYSB', label: 'Southern District of New York' },
          { value: 'VTB', label: 'District of Vermont' },
        ]),
      );
    });

    test('should sort default districts by state', () => {
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
    });

    test('should return empty array when user has groups with no divisions', () => {
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

      expect(mockTrackEvent).not.toHaveBeenCalled();
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

    test('should set empty default districts when session has no matching offices', async () => {
      vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: mockDistricts });
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);
      const setDefaultDistrictsSpy = vi.spyOn(mockStore, 'setDefaultDistricts');

      await useCase.fetchDistricts();

      expect(setDefaultDistrictsSpy).toHaveBeenCalledWith([]);
    });

    test('should set default districts when user has matching offices', async () => {
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
      const setDefaultDistrictsSpy = vi.spyOn(mockStore, 'setDefaultDistricts');

      await useCase.fetchDistricts();

      expect(setDefaultDistrictsSpy).toHaveBeenCalledWith([
        { value: 'NYSB', label: 'Southern District of New York' },
      ]);
    });

    test('should set districtsError on API failure', async () => {
      vi.spyOn(Api2, 'getCourts').mockRejectedValue(new Error('API error'));
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);
      const setDistrictsErrorSpy = vi.spyOn(mockStore, 'setDistrictsError');

      await useCase.fetchDistricts();

      expect(setDistrictsErrorSpy).toHaveBeenCalledWith(true);
    });

    test('should call store.setDistricts with fetched courts on success', async () => {
      vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: mockDistricts });
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);
      const setDistrictsSpy = vi.spyOn(mockStore, 'setDistricts');

      await useCase.fetchDistricts();

      expect(setDistrictsSpy).toHaveBeenCalledWith(mockDistricts);
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
});
