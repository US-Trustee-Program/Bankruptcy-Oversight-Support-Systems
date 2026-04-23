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

const trusteeDistrictFilterUseCase = (
  store: TrusteeDistrictFilterStore,
  controls: TrusteeDistrictFilterControls,
): TrusteeDistrictFilterUseCase => {
  /**
   * Convert CourtDivisionDetails to ComboOptions for the filter dropdown
   * Transforms to unique districts by courtId with courtName as label
   */
  const districtsToComboOptions = (districts: CourtDivisionDetails[]): ComboOption[] => {
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

  /**
   * Fetch all districts from the courts API.
   * Pass onDefault to receive the initial defaults immediately (avoids stale closure on first load).
   */
  const fetchDistricts = async (onDefault?: (districts: ComboOption[]) => void) => {
    try {
      const courtsResponse = await Api2.getCourts();
      const districts = courtsResponse.data;
      store.setDistricts(districts);
      store.setDistrictsError(false);

      // Set default districts based on user session
      const session = LocalStorage.getSession();
      const defaultDistricts = getDefaultDistrictsFromSession(session, districts);
      store.setDefaultDistricts(defaultDistricts);
      store.setSelectedDistricts(defaultDistricts);

      if (defaultDistricts.length > 0) {
        const callback = onDefault ?? store.filterDistrictCallback;
        if (callback) {
          callback(defaultDistricts);
        }
      }
    } catch (_e) {
      store.setDistrictsError(true);
    }
  };

  /**
   * Focus on the district filter input
   */
  const focusOnDistrictFilter = () => {
    controls.districtFilterRef.current?.focusInput();
  };

  /**
   * Extract default districts from user's office groups
   * Returns districts that match the user's office group divisions
   */
  const getDefaultDistrictsFromSession = (
    session: CamsSession | null,
    allDistricts: CourtDivisionDetails[],
  ): ComboOption[] => {
    if (!session?.user?.offices || session.user.offices.length === 0) {
      return []; // No pre-selection - show all trustees
    }

    // Extract court IDs from user's office groups
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

    // Match with available districts and convert to ComboOptions
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

  /**
   * Handle district filter selection changes
   */
  const handleFilterChange = (districts: ComboOption[]) => {
    store.setSelectedDistricts(districts);
    if (store.filterDistrictCallback) {
      store.filterDistrictCallback(districts);
    }
  };

  /**
   * Clear all selected districts and return to default
   * Returns to pre-populated districts based on user's office groups
   */
  const handleClearAll = () => {
    const defaultDistricts = store.defaultDistricts;
    store.setSelectedDistricts(defaultDistricts);
    if (store.filterDistrictCallback) {
      store.filterDistrictCallback(defaultDistricts);
    }
  };

  /**
   * Toggle the filter section expanded/collapsed state
   */
  const handleToggleExpanded = () => {
    store.setIsExpanded(!store.isExpanded);
  };

  /**
   * Remove a single district pill from the selection.
   * When the last pill is removed, clear the filter entirely (show all trustees).
   */
  const handleRemovePill = (district: ComboOption) => {
    const updatedDistricts = store.selectedDistricts.filter((d) => d.value !== district.value);
    store.setSelectedDistricts(updatedDistricts);
    if (store.filterDistrictCallback) {
      store.filterDistrictCallback(updatedDistricts);
    }
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
