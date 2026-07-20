import { useEffect, useState } from 'react';
import { ComboOption } from '@/lib/components/combobox/ComboBox';
import TrusteeCaseListFilterView from './TrusteeCaseListFilterView';
import trusteeCaseListFilterUseCase, { CASE_CHAPTER_OPTIONS } from './trusteeCaseListFilterUseCase';
import {
  TrusteeCaseListFilterProps,
  TrusteeCaseListFilterViewModel,
  TrusteeCaseStatus,
} from './trusteeCaseListFilter.types';
import { CourtDivisionDetails } from '@common/cams/courts';
import Api2 from '@/lib/models/api2';

export default function TrusteeCaseListFilter({
  trusteeId,
  onFilterChange,
  initialValue,
}: TrusteeCaseListFilterProps) {
  const [selectedStatus, setSelectedStatus] = useState<TrusteeCaseStatus>(
    initialValue?.caseStatus ?? 'OPEN',
  );
  const [selectedChapters, setSelectedChapters] = useState<ComboOption[]>(
    initialValue?.chapters?.length
      ? CASE_CHAPTER_OPTIONS.filter((o) => initialValue.chapters.includes(o.value))
      : [],
  );
  const [filedDateFrom, setFiledDateFrom] = useState(initialValue?.filedDateFrom ?? '');
  const [filedDateTo, setFiledDateTo] = useState(initialValue?.filedDateTo ?? '');
  const [filedDateError, setFiledDateError] = useState('');
  const [filterAnnouncement, setFilterAnnouncement] = useState('');
  const [courts, setCourts] = useState<CourtDivisionDetails[]>([]);
  const [selectedDivisions, setSelectedDivisions] = useState<ComboOption[]>([]);
  const [resolvedDivisionCodes, setResolvedDivisionCodes] = useState<string[] | undefined>(
    initialValue?.divisionCodes,
  );
  const [divisionCodeAllowList, setDivisionCodeAllowList] = useState<string[] | undefined>(
    undefined,
  );

  useEffect(() => {
    let cancelled = false;
    Api2.getTrusteeCaseDivisions(trusteeId)
      .then((response) => {
        if (!cancelled) setDivisionCodeAllowList(response.data);
      })
      .catch(() => {
        if (!cancelled) setDivisionCodeAllowList([]);
      });
    return () => {
      cancelled = true;
    };
  }, [trusteeId]);

  const useCase = trusteeCaseListFilterUseCase(
    {
      selectedStatus,
      setSelectedStatus,
      selectedChapters,
      setSelectedChapters,
      filedDateFrom,
      setFiledDateFrom,
      filedDateTo,
      setFiledDateTo,
      filedDateError,
      setFiledDateError,
      filterAnnouncement,
      setFilterAnnouncement,
      courts,
      setCourts,
      selectedDivisions,
      setSelectedDivisions,
      resolvedDivisionCodes,
      setResolvedDivisionCodes,
    },
    onFilterChange,
  );

  const viewModel: TrusteeCaseListFilterViewModel = {
    selectedStatus,
    selectedChapters,
    filedDateFrom,
    filedDateTo,
    filedDateError,
    filterAnnouncement,
    selectedDivisions,
    initialDivisionCodes: initialValue?.divisionCodes,
    divisionCodeAllowList,
    chaptersToComboOptions: useCase.chaptersToComboOptions,
    handleStatusChange: useCase.handleStatusChange,
    handleChapterChange: useCase.handleChapterChange,
    handleFiledDateChange: useCase.handleFiledDateChange,
    handleDivisionChange: useCase.handleDivisionChange,
    onCourtsLoaded: setCourts,
  };

  return <TrusteeCaseListFilterView viewModel={viewModel} />;
}
