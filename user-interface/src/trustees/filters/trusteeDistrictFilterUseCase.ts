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
import { AppointmentChapterType, formatChapterType } from '@common/cams/trustees';

const districtsToComboOptions = (districts: CourtDivisionDetails[]): ComboOption[] => {
  // Show all divisions with format: District (Division)
  return districts
    .map((district) => {
      const divisionName = district.courtDivisionName || district.courtDivisionCode;
      const label = divisionName ? `${district.courtName} (${divisionName})` : district.courtName;

      return {
        value: district.courtDivisionCode,
        label: label,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
};

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
    .map((district) => {
      const divisionName = district.courtDivisionName || district.courtDivisionCode;
      const label = divisionName ? `${district.courtName} (${divisionName})` : district.courtName;

      return {
        value: district.courtDivisionCode,
        label: label,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
};

const CHAPTER_OPTIONS: AppointmentChapterType[] = ['7', '11', '11-subchapter-v', '12', '13'];

const chaptersToComboOptions = (): ComboOption[] =>
  CHAPTER_OPTIONS.map((chapter) => ({ value: chapter, label: formatChapterType(chapter) }));

const trusteeDistrictFilterUseCase = (
  store: TrusteeDistrictFilterStore,
  controls: TrusteeDistrictFilterControls,
  onFilterDistrict: (districts: ComboOption[]) => void,
  previousDistrictsRef: { current: ComboOption[] | undefined },
  onFilterChapter: (chapters: ComboOption[]) => void,
  previousChaptersRef: { current: ComboOption[] | undefined },
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

  const handleRemoveChapterPill = (chapter: ComboOption) => {
    const updated = store.selectedChapters.filter((c) => c.value !== chapter.value);
    handleFilterChapter(updated);
  };

  return {
    chaptersToComboOptions,
    districtsToComboOptions,
    fetchDistricts,
    focusOnDistrictFilter,
    getDefaultDistrictsFromSession,
    handleFilterChange,
    handleClearAll,
    handleToggleExpanded,
    handleRemovePill,
    handleFilterChapter,
    handleClearAllChapters,
    handleRemoveChapterPill,
  };
};

export default trusteeDistrictFilterUseCase;
