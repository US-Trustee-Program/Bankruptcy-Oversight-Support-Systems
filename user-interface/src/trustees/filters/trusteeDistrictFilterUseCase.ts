import {
  TrusteeDistrictFilterControls,
  TrusteeDistrictFilterUseCase,
  TrusteeDistrictFilterStore,
} from './trusteeDistrictFilter.types';
import { CourtDivisionDetails } from '@common/cams/courts';
import { CamsSession } from '@common/cams/session';
import Api2 from '@/lib/models/api2';
import LocalStorage from '@/lib/utils/local-storage';
import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { getAppInsights } from '@/lib/hooks/UseApplicationInsights';
import {
  sortByCourtLocation,
  groupDivisionsByDistrict,
  separateDefaultOptions,
} from '@/lib/utils/court-utils';

const toDistrictOption = (
  district: CourtDivisionDetails,
  divisionCodes: string[],
): ComboOption => ({
  value: divisionCodes.join(','),
  label: district.courtName,
});

const getDefaultDistrictsFromSession = (
  session: CamsSession | null,
  allDistricts: CourtDivisionDetails[],
): ComboOption[] => {
  if (!session?.user?.offices || session.user.offices.length === 0) {
    return [];
  }

  const userDivisionCodes = new Set<string>();
  session.user.offices.forEach((office) => {
    office.groups?.forEach((group) => {
      group.divisions?.forEach((division) => {
        if (division.divisionCode) {
          userDivisionCodes.add(division.divisionCode);
        }
      });
    });
  });

  // Group divisions by district (courtName)
  const filteredDistricts = allDistricts.filter((district) =>
    userDivisionCodes.has(district.courtDivisionCode),
  );
  const districtMap = groupDivisionsByDistrict(filteredDistricts);

  // Convert to ComboOptions, one per unique district
  const sortedDistricts = sortByCourtLocation(
    Array.from(districtMap.values()).map((divisions) => divisions[0]),
  );

  return sortedDistricts.map((district) => {
    const divisions = districtMap.get(district.courtName)!;
    return toDistrictOption(
      district,
      divisions.map((d) => d.courtDivisionCode),
    );
  });
};

const trusteeDistrictFilterUseCase = (
  store: TrusteeDistrictFilterStore,
  controls: TrusteeDistrictFilterControls,
  onFilterDistrict: (districts: ComboOption[]) => void,
  previousDistrictsRef: { current: ComboOption[] | undefined },
): TrusteeDistrictFilterUseCase => {
  const districtsToComboOptions = (districts: CourtDivisionDetails[]): ComboOption[] => {
    // Group divisions by district (courtName)
    const districtMap = groupDivisionsByDistrict(districts);

    // Convert to unique districts and sort by court location
    const sortedRepresentatives = sortByCourtLocation(
      Array.from(districtMap.values()).map((divisions) => divisions[0]),
    );

    // Convert to ComboOptions
    const allOptions = sortedRepresentatives.map((representative) => {
      const divisions = districtMap.get(representative.courtName)!;
      return toDistrictOption(
        representative,
        divisions.map((d) => d.courtDivisionCode),
      );
    });

    // Separate defaults from non-defaults and mark them
    const defaultCodesFlat = new Set(
      (store.defaultDistricts || []).flatMap((d) => d.value.split(',')),
    );
    return separateDefaultOptions(allOptions, defaultCodesFlat);
  };

  const notifySelectionChange = (districts: ComboOption[]) => {
    onFilterDistrict(districts);
  };

  const fetchDistricts = async () => {
    try {
      const courtsResponse = await Api2.getCourts();
      const districts = courtsResponse.data;
      store.setDistricts(districts);
      store.setDistrictsError(false);

      const session = LocalStorage.getSession();
      const defaultDistricts = getDefaultDistrictsFromSession(session, districts);
      store.setDefaultDistricts(defaultDistricts);
      store.setSelectedDistricts(defaultDistricts);

      if (defaultDistricts.length > 0) {
        notifySelectionChange(defaultDistricts);
      }
    } catch (_e) {
      store.setDistrictsError(true);
    }
  };

  const focusOnDistrictFilter = () => {
    controls.districtFilterRef.current?.focusInput();
  };

  const handleFilterChange = (districts: ComboOption[]) => {
    // Only track "cleared" when transitioning from non-empty to empty
    const wasNonEmpty = previousDistrictsRef.current && previousDistrictsRef.current.length > 0;
    const isNowEmpty = districts.length === 0;

    if (wasNonEmpty && isNowEmpty) {
      getAppInsights().appInsights.trackEvent({ name: 'Trustee District Filter Cleared' });
    }

    previousDistrictsRef.current = districts;
    store.setSelectedDistricts(districts);
    notifySelectionChange(districts);
  };

  const handleClearAll = () => {
    const defaultDistricts = store.defaultDistricts;
    handleFilterChange(defaultDistricts);
  };

  const handleToggleExpanded = () => {
    store.setIsExpanded(!store.isExpanded);
  };

  return {
    districtsToComboOptions,
    fetchDistricts,
    focusOnDistrictFilter,
    getDefaultDistrictsFromSession,
    handleFilterChange,
    handleClearAll,
    handleToggleExpanded,
  };
};

export default trusteeDistrictFilterUseCase;
