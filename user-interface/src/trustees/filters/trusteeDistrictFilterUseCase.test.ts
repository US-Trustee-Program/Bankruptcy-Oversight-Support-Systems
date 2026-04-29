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

const mockTrackEvent = vi.fn();
vi.mock('@/lib/hooks/UseApplicationInsights', () => ({
  getAppInsights: () => ({
    appInsights: { trackEvent: mockTrackEvent },
  }),
}));

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

  const previousDistrictsRef = { current: undefined as ComboOption[] | undefined };

  const useCase = trusteeDistrictFilterUseCase(
    mockStore,
    mockControls,
    mockOnFilterDistrict,
    previousDistrictsRef,
  );

  beforeEach(() => {
    mockStore.defaultDistricts = [];
    mockStore.setSelectedDistricts = vi.fn();
    setSelectedDistrictsSpy = vi.spyOn(mockStore, 'setSelectedDistricts');
    mockOnFilterDistrict.mockReset();
    mockTrackEvent.mockReset();
    previousDistrictsRef.current = undefined; // Reset ref state between tests
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
  });
});
