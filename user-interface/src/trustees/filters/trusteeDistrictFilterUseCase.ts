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
import {
  AppointmentChapterType,
  AppointmentStatus,
  formatChapterType,
} from '@common/cams/trustees';
import { formatAppointmentStatus } from '@common/cams/trustee-appointments';

export function autoUpgradeToAll(
  selections: ComboOption[],
  districts: CourtDivisionDetails[],
): ComboOption[] {
  const allDivisionsByDistrict = new Map<string, Set<string>>();
  const courtNameById = new Map<string, string>();
  for (const court of districts) {
    if (!allDivisionsByDistrict.has(court.courtId)) {
      allDivisionsByDistrict.set(court.courtId, new Set());
      courtNameById.set(court.courtId, court.courtName);
    }
    allDivisionsByDistrict.get(court.courtId)!.add(court.courtDivisionCode);
  }

  const selectedSpecificByDistrict = new Map<string, Set<string>>();
  for (const sel of selections) {
    const [courtId, code] = sel.value.split('|');
    if (code !== 'ALL') {
      if (!selectedSpecificByDistrict.has(courtId)) {
        selectedSpecificByDistrict.set(courtId, new Set());
      }
      selectedSpecificByDistrict.get(courtId)!.add(code);
    }
  }

  let result = [...selections];
  for (const [courtId, selectedCodes] of selectedSpecificByDistrict.entries()) {
    const allCodes = allDivisionsByDistrict.get(courtId);
    if (
      allCodes &&
      selectedCodes.size === allCodes.size &&
      [...selectedCodes].every((c) => allCodes.has(c))
    ) {
      result = result.filter((s) => {
        const [sCourt, sCode] = s.value.split('|');
        return sCourt !== courtId || sCode === 'ALL';
      });
      const courtName = courtNameById.get(courtId) ?? courtId;
      result.push({
        value: `${courtId}|ALL`,
        label: `${courtName} (All)`,
        selectedLabel: `${courtName} (All)`,
      });
    }
  }
  return result;
}

export function resolveCombinedSelections(
  previous: ComboOption[],
  next: ComboOption[],
): ComboOption[] {
  if (next.length === 0) return [];

  const previousValues = new Set(previous.map((s) => s.value));
  const added = next.filter((s) => !previousValues.has(s.value));

  if (added.length === 0) return next;

  let resolved = [...next];
  for (const newOption of added) {
    const [courtId, code] = newOption.value.split('|');
    if (code === 'ALL') {
      resolved = resolved.filter((s) => {
        const [sCourt, sCode] = s.value.split('|');
        return !(sCourt === courtId && sCode !== 'ALL');
      });
    } else {
      resolved = resolved.filter((s) => s.value !== `${courtId}|ALL`);
    }
  }

  return resolved;
}

export function getUserDivisionCodes(session: CamsSession | null): Set<string> {
  const codes = new Set<string>();
  session?.user?.offices?.forEach((office) => {
    office.groups?.forEach((group) => {
      group.divisions?.forEach((division) => {
        if (division.divisionCode) codes.add(division.divisionCode);
      });
    });
  });
  return codes;
}

const toDistrictOption = (
  district: CourtDivisionDetails,
  divisionCodes: string[],
  districtDivisionEnabled: boolean,
): ComboOption => ({
  value: districtDivisionEnabled ? district.courtId : divisionCodes.join(','),
  label: district.courtName,
});

const buildDistrictOptions = (
  districts: CourtDivisionDetails[],
  districtDivisionEnabled: boolean,
): ComboOption[] => {
  const districtMap = groupDivisionsByDistrict(districts);

  const sortedDistricts = sortByCourtLocation(
    Array.from(districtMap.values()).map((divisions) => divisions[0]),
  );

  return sortedDistricts.map((district) => {
    const divisions = districtMap.get(district.courtId)!;
    return toDistrictOption(
      district,
      divisions.map((d) => d.courtDivisionCode),
      districtDivisionEnabled,
    );
  });
};

const CHAPTER_OPTIONS: AppointmentChapterType[] = ['7', '11', '11-subchapter-v', '12', '13'];

const chaptersToComboOptions = (): ComboOption[] =>
  CHAPTER_OPTIONS.map((chapter) => ({
    value: chapter,
    label: formatChapterType(chapter),
    selectedLabel: formatChapterType(chapter),
  }));

const STATUS_OPTIONS: AppointmentStatus[] = [
  'active',
  'inactive',
  'voluntarily-suspended',
  'involuntarily-suspended',
  'deceased',
  'resigned',
  'terminated',
  'removed',
];

export const DEFAULT_STATUS_OPTIONS: ComboOption[] = [
  {
    value: 'active',
    label: formatAppointmentStatus('active'),
    selectedLabel: formatAppointmentStatus('active'),
  },
];

const statusesToComboOptions = (): ComboOption[] =>
  STATUS_OPTIONS.map((status) => ({
    value: status,
    label: formatAppointmentStatus(status),
    selectedLabel: formatAppointmentStatus(status),
  }));

const trusteeDistrictFilterUseCase = (
  store: TrusteeDistrictFilterStore,
  controls: TrusteeDistrictFilterControls,
  onFilterDistrict: (districts: ComboOption[]) => void,
  previousDistrictsRef: { current: ComboOption[] | undefined },
  onFilterChapter: (chapters: ComboOption[]) => void,
  previousChaptersRef: { current: ComboOption[] | undefined },
  onFilterDivision: (divisions: ComboOption[]) => void,
  previousDivisionsRef: { current: ComboOption[] | undefined },
  districtDivisionEnabled: boolean = false,
  onFilterStatus: (statuses: ComboOption[]) => void = () => {},
  previousStatusesRef: { current: ComboOption[] | undefined } = { current: undefined },
): TrusteeDistrictFilterUseCase => {
  const getDefaultDistrictsFromSession = (
    session: CamsSession | null,
    allDistricts: CourtDivisionDetails[],
  ): ComboOption[] => {
    if (!session?.user?.offices || session.user.offices.length === 0) {
      return [];
    }

    const userDivisionCodes = getUserDivisionCodes(session);

    const userDistricts = allDistricts.filter((district) =>
      userDivisionCodes.has(district.courtDivisionCode),
    );
    const userDistrictNames = new Set(userDistricts.map((d) => d.courtName));

    const allDistrictsForUser = allDistricts.filter((district) =>
      userDistrictNames.has(district.courtName),
    );

    return buildDistrictOptions(allDistrictsForUser, districtDivisionEnabled);
  };

  const districtsToComboOptions = (districts: CourtDivisionDetails[]): ComboOption[] => {
    const allOptions = buildDistrictOptions(districts, districtDivisionEnabled);

    // Separate defaults from non-defaults and mark them
    const defaultCodesFlat = new Set(
      (store.defaultDistricts ?? []).flatMap((d) => d.value.split(',')),
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

      notifySelectionChange(defaultDistricts);
      if (defaultDistricts.length > 0) {
        if (districtDivisionEnabled) {
          const userDivisionCodes = getUserDivisionCodes(session);

          const defaultDivisions = defaultDistricts.flatMap((d) => {
            const courtId = d.value;
            return districts
              .filter(
                (court) =>
                  court.courtId === courtId && userDivisionCodes.has(court.courtDivisionCode),
              )
              .sort((a, b) => a.courtDivisionName.localeCompare(b.courtDivisionName))
              .map((court) => ({
                value: `${courtId}|${court.courtDivisionCode}`,
                label: `${court.courtName} (${court.courtDivisionName})`,
                selectedLabel: court.courtDivisionName,
              }));
          });
          store.setDefaultDivisions(defaultDivisions);
          store.setSelectedDivisions(defaultDivisions);
          onFilterDivision(defaultDivisions);
        }
      }
    } catch (_e) {
      store.setDistrictsError(true);
    }
  };

  const focusOnDistrictFilter = () => {
    controls.districtFilterRef.current?.focusInput();
  };

  const handleFilterDivision = (divisions: ComboOption[]) => {
    const wasNonEmpty = previousDivisionsRef.current && previousDivisionsRef.current.length > 0;
    const isNowEmpty = divisions.length === 0;

    if (wasNonEmpty && isNowEmpty) {
      getAppInsights().appInsights.trackEvent({ name: 'Trustee Division Filter Cleared' });
    }

    previousDivisionsRef.current = divisions;
    store.setSelectedDivisions(divisions);
    onFilterDivision(divisions);
  };

  const handleClearAllDivisions = () => {
    handleFilterDivision([]);
  };

  const handleFilterCombined = (selections: ComboOption[]) => {
    const previous = previousDivisionsRef.current ?? [];
    const resolved = resolveCombinedSelections(previous, selections);
    const upgraded = autoUpgradeToAll(resolved, store.districts);
    handleFilterDivision(upgraded);
  };

  const handleFilterChange = (districts: ComboOption[]) => {
    const wasNonEmpty = previousDistrictsRef.current && previousDistrictsRef.current.length > 0;
    const isNowEmpty = districts.length === 0;

    if (wasNonEmpty && isNowEmpty) {
      getAppInsights().appInsights.trackEvent({ name: 'Trustee District Filter Cleared' });
    }

    previousDistrictsRef.current = districts;
    store.setSelectedDistricts(districts);
    if (districtDivisionEnabled) {
      handleClearAllDivisions();
    }
    notifySelectionChange(districts);
  };

  const handleClearAll = () => {
    handleFilterChange([]);
  };

  const handleToggleExpanded = () => {
    store.setIsExpanded(!store.isExpanded);
  };

  const handleFilterChapter = (chapters: ComboOption[]) => {
    const wasNonEmpty = previousChaptersRef.current && previousChaptersRef.current.length > 0;
    const isNowEmpty = chapters.length === 0;

    if (wasNonEmpty && isNowEmpty) {
      getAppInsights().appInsights.trackEvent({ name: 'Trustee Chapter Filter Cleared' });
    }

    previousChaptersRef.current = chapters;
    store.setSelectedChapters(chapters);
    onFilterChapter(chapters);
  };

  const handleClearAllChapters = () => {
    handleFilterChapter([]);
  };

  const handleFilterStatus = (statuses: ComboOption[]) => {
    const wasNonEmpty = previousStatusesRef.current && previousStatusesRef.current.length > 0;
    const isNowEmpty = statuses.length === 0;

    if (wasNonEmpty && isNowEmpty) {
      getAppInsights().appInsights.trackEvent({ name: 'Trustee Status Filter Cleared' });
      const defaultStatuses = DEFAULT_STATUS_OPTIONS;
      previousStatusesRef.current = defaultStatuses;
      store.setSelectedStatuses(defaultStatuses);
      onFilterStatus(defaultStatuses);
      return;
    }

    previousStatusesRef.current = statuses;
    store.setSelectedStatuses(statuses);
    onFilterStatus(statuses);
  };

  const handleClearAllStatuses = () => {
    handleFilterStatus([]);
  };

  return {
    chaptersToComboOptions,
    statusesToComboOptions,
    districtsToComboOptions,
    fetchDistricts,
    focusOnDistrictFilter,
    getDefaultDistrictsFromSession,
    handleFilterChange,
    handleClearAll,
    handleToggleExpanded,
    handleFilterChapter,
    handleClearAllChapters,
    handleFilterDivision,
    handleClearAllDivisions,
    handleFilterCombined,
    handleFilterStatus,
    handleClearAllStatuses,
  };
};

export default trusteeDistrictFilterUseCase;
