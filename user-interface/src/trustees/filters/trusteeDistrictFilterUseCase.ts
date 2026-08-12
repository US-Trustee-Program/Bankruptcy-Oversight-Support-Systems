import {
  TrusteeDistrictFilterUseCase,
  TrusteeDistrictFilterStore,
} from './trusteeDistrictFilter.types';
import Api2 from '@/lib/models/api2';
import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { getAppInsights } from '@/lib/hooks/UseApplicationInsights';
import { AppointmentChapterType, formatChapterType } from '@common/cams/trustees';

const CHAPTER_OPTIONS: AppointmentChapterType[] = ['7', '11', '11-subchapter-v', '12', '13'];

const chaptersToComboOptions = (): ComboOption[] =>
  CHAPTER_OPTIONS.map((chapter) => ({
    value: chapter,
    label: formatChapterType(chapter),
    selectedLabel: formatChapterType(chapter), // Full label for both display and screen reader
  }));

const trusteeDistrictFilterUseCase = (
  store: TrusteeDistrictFilterStore,
  onFilterChapter: (chapters: ComboOption[]) => void,
  previousChaptersRef: { current: ComboOption[] | undefined },
  onFilterDivision: (divisions: ComboOption[]) => void,
  previousDivisionsRef: { current: ComboOption[] | undefined },
): TrusteeDistrictFilterUseCase => {
  const fetchDistricts = async () => {
    try {
      const courtsResponse = await Api2.getCourts();
      const districts = courtsResponse.data;
      store.setDistricts(districts);
      store.setDistrictsError(false);
    } catch (_e) {
      store.setDistrictsError(true);
    }
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

  return {
    chaptersToComboOptions,
    fetchDistricts,
    handleToggleExpanded,
    handleFilterChapter,
    handleClearAllChapters,
    handleFilterDivision,
  };
};

export default trusteeDistrictFilterUseCase;
