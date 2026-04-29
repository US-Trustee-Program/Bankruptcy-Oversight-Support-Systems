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

const sortByState = (a: CourtDivisionDetails, b: CourtDivisionDetails) =>
  (a.state || '').localeCompare(b.state || '') || a.courtName.localeCompare(b.courtName);

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

  return allDistricts
    .filter((district) => userDivisionCodes.has(district.courtDivisionCode))
    .sort(sortByState)
    .map((district) => ({
      value: district.courtDivisionCode,
      label: district.courtName,
    }));
};

const trusteeDistrictFilterUseCase = (
  store: TrusteeDistrictFilterStore,
  controls: TrusteeDistrictFilterControls,
  onFilterDistrict: (districts: ComboOption[]) => void,
  previousDistrictsRef: { current: ComboOption[] | undefined },
): TrusteeDistrictFilterUseCase => {
  const districtsToComboOptions = (districts: CourtDivisionDetails[]): ComboOption[] => {
    const defaultCodes = new Set(store.defaultDistricts.map((d) => d.value));
    const sorted = [...districts].sort(sortByState);

    const defaults = sorted.filter((d) => defaultCodes.has(d.courtDivisionCode));
    const nonDefaults = sorted.filter((d) => !defaultCodes.has(d.courtDivisionCode));

    const result: ComboOption[] = [];
    defaults.forEach((district, i) => {
      result.push({
        value: district.courtDivisionCode,
        label: district.courtName,
        isAriaDefault: true,
        divider: i === defaults.length - 1 && nonDefaults.length > 0,
      });
    });
    nonDefaults.forEach((district) => {
      result.push({
        value: district.courtDivisionCode,
        label: district.courtName,
      });
    });

    return result;
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

  const handleRemovePill = (district: ComboOption) => {
    const updatedDistricts = store.selectedDistricts.filter((d) => d.value !== district.value);
    handleFilterChange(updatedDistricts);
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
