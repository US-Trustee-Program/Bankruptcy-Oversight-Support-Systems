import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { TrusteeDistrictFilterStore } from './trusteeDistrictFilter.types';
import trusteeDistrictFilterUseCase from './trusteeDistrictFilterUseCase';
import { CourtDivisionDetails } from '@common/cams/courts';
import Api2 from '@/lib/models/api2';
import * as AppInsights from '@/lib/hooks/UseApplicationInsights';

const mockTrackEvent = vi.fn();

describe('trustee district filter use case tests', () => {
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
  ];

  const mockOnFilterChapter = vi.fn();
  const mockOnFilterDivision = vi.fn();

  const mockStore: TrusteeDistrictFilterStore = {
    districts: mockDistricts,
    setDistricts: vi.fn(),
    districtsError: false,
    setDistrictsError: vi.fn(),
    selectedChapters: [],
    setSelectedChapters: vi.fn(),
    selectedDivisions: [],
    setSelectedDivisions: vi.fn(),
    isExpanded: false,
    setIsExpanded: vi.fn(),
  };

  const previousChaptersRef = { current: undefined as ComboOption[] | undefined };
  const previousDivisionsRef = { current: undefined as ComboOption[] | undefined };

  const useCase = trusteeDistrictFilterUseCase(
    mockStore,
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
    mockStore.setSelectedChapters = vi.fn();
    mockStore.setSelectedDivisions = vi.fn();
    mockOnFilterChapter.mockReset();
    mockOnFilterDivision.mockReset();
    mockTrackEvent.mockReset();
    previousChaptersRef.current = undefined;
    previousDivisionsRef.current = undefined;
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
    });

    test('should set districtsError on API failure', async () => {
      vi.spyOn(Api2, 'getCourts').mockRejectedValue(new Error('API error'));
      const setDistrictsErrorSpy = vi.spyOn(mockStore, 'setDistrictsError');

      await useCase.fetchDistricts();

      expect(setDistrictsErrorSpy).toHaveBeenCalledWith(true);
    });

    test('should call store.setDistricts with fetched courts on success', async () => {
      vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: mockDistricts });
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
