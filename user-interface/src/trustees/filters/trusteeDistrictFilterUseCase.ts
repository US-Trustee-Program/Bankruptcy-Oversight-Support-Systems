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

export const districtsToComboOptions = (districts: CourtDivisionDetails[]): ComboOption[] => {
  const uniqueDistricts = new Map<string, CourtDivisionDetails>();

  districts.forEach((district) => {
    if (!uniqueDistricts.has(district.courtId)) {
      uniqueDistricts.set(district.courtId, district);
    }
  });

  return Array.from(uniqueDistricts.values())
    .map((district) => ({
      value: district.courtId,
      label: district.courtName,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
};

export const getDefaultDistrictsFromSession = (
  session: CamsSession | null,
  allDistricts: CourtDivisionDetails[],
): ComboOption[] => {
  if (!session?.user?.offices || session.user.offices.length === 0) {
    return [];
  }

  const userCourtIds = new Set<string>();
  session.user.offices.forEach((office) => {
    office.groups?.forEach((group) => {
      group.divisions?.forEach((division) => {
        if (division.court?.courtId) {
          userCourtIds.add(division.court.courtId);
        }
      });
    });
  });

  const uniqueDistricts = new Map<string, CourtDivisionDetails>();
  allDistricts.forEach((district) => {
    if (userCourtIds.has(district.courtId) && !uniqueDistricts.has(district.courtId)) {
      uniqueDistricts.set(district.courtId, district);
    }
  });

  return Array.from(uniqueDistricts.values())
    .map((district) => ({
      value: district.courtId,
      label: district.courtName,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
};

const trusteeDistrictFilterUseCase = (
  store: TrusteeDistrictFilterStore,
  controls: TrusteeDistrictFilterControls,
  onFilterDistrict: (districts: ComboOption[]) => void,
): TrusteeDistrictFilterUseCase => {
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
    store.setSelectedDistricts(districts);
    notifySelectionChange(districts);
  };

  const handleClearAll = () => {
    const defaultDistricts = store.defaultDistricts;
    store.setSelectedDistricts(defaultDistricts);
    notifySelectionChange(defaultDistricts);
  };

  const handleToggleExpanded = () => {
    store.setIsExpanded(!store.isExpanded);
  };

  const handleRemovePill = (district: ComboOption) => {
    const updatedDistricts = store.selectedDistricts.filter((d) => d.value !== district.value);
    store.setSelectedDistricts(updatedDistricts);
    notifySelectionChange(updatedDistricts);
  };

  return {
    districtsToComboOptions,
    fetchDistricts,
    focusOnDistrictFilter,
    getDefaultDistrictsFromSession,
    handleFilterChange,
    handleClearAll,
    handleToggleExpanded,
    handleRemovePill,
  };
};

export default trusteeDistrictFilterUseCase;
