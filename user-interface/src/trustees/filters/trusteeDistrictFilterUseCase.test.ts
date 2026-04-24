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
    },
  ];

  const mockOnFilterDistrict = vi.fn();

  const mockStore: TrusteeDistrictFilterStore = {
    districts: mockDistricts,
    setDistricts: vi.fn(),
    districtsError: false,
    setDistrictsError: vi.fn(),
    selectedDistricts: [],
    setSelectedDistricts: vi.fn(),
    defaultDistricts: [],
    setDefaultDistricts: vi.fn(),
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
  };

  const useCase = trusteeDistrictFilterUseCase(mockStore, mockControls, mockOnFilterDistrict);

  beforeEach(() => {
    mockStore.setSelectedDistricts = vi.fn();
    setSelectedDistrictsSpy = vi.spyOn(mockStore, 'setSelectedDistricts');
    mockOnFilterDistrict.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('districtsToComboOptions', () => {
    test('should return unique districts by courtId sorted alphabetically by label', () => {
      const comboOptions = useCase.districtsToComboOptions(mockDistricts);

      expect(comboOptions).toHaveLength(2);
      expect(comboOptions[0]).toEqual({ value: 'VTB', label: 'District of Vermont' });
      expect(comboOptions[1]).toEqual({ value: 'NYSB', label: 'Southern District of New York' });
    });

    test('should handle empty districts array', () => {
      const comboOptions = useCase.districtsToComboOptions([]);

      expect(comboOptions).toEqual([]);
    });

    test('should deduplicate districts with same courtId', () => {
      const duplicateDistricts: CourtDivisionDetails[] = [
        ...mockDistricts,
        {
          ...mockDistricts[0],
          courtDivisionCode: '999',
          courtDivisionName: 'Another Division',
        },
      ];

      const comboOptions = useCase.districtsToComboOptions(duplicateDistricts);

      expect(comboOptions).toHaveLength(2);
    });
  });

  describe('getDefaultDistrictsFromSession', () => {
    test('should return empty array when user has no offices', () => {
      const session: CamsSession = {
        ...MockData.getCamsSession(),
        user: {
          ...MockData.getCamsSession().user,
          offices: [],
        },
      };

      const defaultDistricts = useCase.getDefaultDistrictsFromSession(session, mockDistricts);

      expect(defaultDistricts).toEqual([]);
    });

    test('should return empty array when session is null', () => {
      const defaultDistricts = useCase.getDefaultDistrictsFromSession(null, mockDistricts);

      expect(defaultDistricts).toEqual([]);
    });

    test('should extract courtIds from user office groups and return matching districts', () => {
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

    test('should sort default districts alphabetically and return empty for groups with no divisions', () => {
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
      expect(sorted[0].label).toBe('District of Vermont');
      expect(sorted[1].label).toBe('Southern District of New York');

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
    test('should reset selected districts to default districts and notify', () => {
      const defaultDistricts: ComboOption[] = [
        { value: 'NYSB', label: 'Southern District of New York' },
      ];
      mockStore.defaultDistricts = defaultDistricts;

      useCase.handleClearAll();

      expect(setSelectedDistrictsSpy).toHaveBeenCalledWith(defaultDistricts);
      expect(mockOnFilterDistrict).toHaveBeenCalledWith(defaultDistricts);
    });
  });

  describe('handleRemovePill', () => {
    test('should remove the specified district from selection', () => {
      const districts: ComboOption[] = [
        { value: 'NYSB', label: 'Southern District of New York' },
        { value: 'VTB', label: 'District of Vermont' },
      ];
      mockStore.selectedDistricts = districts;

      const districtToRemove = districts[0];
      useCase.handleRemovePill(districtToRemove);

      expect(setSelectedDistrictsSpy).toHaveBeenCalledWith([districts[1]]);
      expect(mockOnFilterDistrict).toHaveBeenCalledWith([districts[1]]);
    });

    test('should clear selection entirely when removing last district', () => {
      const districts: ComboOption[] = [{ value: 'NYSB', label: 'Southern District of New York' }];
      const defaultDistricts: ComboOption[] = [{ value: 'VTB', label: 'District of Vermont' }];
      mockStore.selectedDistricts = districts;
      mockStore.defaultDistricts = defaultDistricts;

      useCase.handleRemovePill(districts[0]);

      // Should clear to empty (show all trustees), not restore defaults
      expect(setSelectedDistrictsSpy).toHaveBeenCalledWith([]);
      expect(mockOnFilterDistrict).toHaveBeenCalledWith([]);
    });
  });

  describe('handleToggleExpanded', () => {
    test('should toggle isExpanded from false to true', () => {
      mockStore.isExpanded = false;
      const setIsExpandedSpy = vi.spyOn(mockStore, 'setIsExpanded');

      useCase.handleToggleExpanded();

      expect(setIsExpandedSpy).toHaveBeenCalledWith(true);
    });

    test('should toggle isExpanded from true to false', () => {
      mockStore.isExpanded = true;
      const setIsExpandedSpy = vi.spyOn(mockStore, 'setIsExpanded');

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
  });

  describe('focusOnDistrictFilter', () => {
    test('should call focusInput on combobox ref', () => {
      const focusInputSpy = vi.spyOn(comboBoxRef.current, 'focusInput');

      useCase.focusOnDistrictFilter();

      expect(focusInputSpy).toHaveBeenCalled();
    });
  });

  describe('fetchDistricts', () => {
    beforeEach(() => {
      mockStore.setDistricts = vi.fn();
      mockStore.setDistrictsError = vi.fn();
      mockStore.setDefaultDistricts = vi.fn();
      mockStore.setSelectedDistricts = vi.fn();
    });

    test('should not call onFilterDistrict when session has no matching offices', async () => {
      vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: mockDistricts });
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);

      await useCase.fetchDistricts();

      expect(mockOnFilterDistrict).not.toHaveBeenCalled();
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
  });
});
