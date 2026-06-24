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
import { getDistrictDivisionComboOptions } from '@/lib/utils/court-utils';
import LocalStorage from '@/lib/utils/local-storage';
import { getUserDivisionCodes } from '@/trustees/filters/trusteeDistrictFilterUseCase';
import { encodeDivisionCodes } from './trusteeCaseListFilterUseCase';

export default function TrusteeCaseListFilter({
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

  useEffect(() => {
    Api2.getCourts()
      .then((r) => {
        setCourts(r.data);
        const options = getDistrictDivisionComboOptions(r.data) as ComboOption[];

        if (initialValue?.divisionCodes?.length) {
          // Restore explicit session-stored selection
          const preSelected = options.filter((opt) => {
            const [, code] = opt.value.split('|');
            return code !== 'ALL' && initialValue.divisionCodes!.includes(code);
          });
          setSelectedDivisions(preSelected);
        } else {
          // Apply user's default divisions from session
          const userCodes = getUserDivisionCodes(LocalStorage.getSession());
          if (userCodes.size > 0) {
            const defaults = options.filter((opt) => {
              const [, code] = opt.value.split('|');
              return code !== 'ALL' && userCodes.has(code);
            });
            if (defaults.length > 0) {
              const codes = encodeDivisionCodes(defaults, r.data);
              setSelectedDivisions(defaults);
              setResolvedDivisionCodes(codes);
              onFilterChange({
                caseStatus: initialValue?.caseStatus ?? 'OPEN',
                chapters: initialValue?.chapters ?? [],
                filedDateFrom: initialValue?.filedDateFrom,
                filedDateTo: initialValue?.filedDateTo,
                ...(codes ? { divisionCodes: codes } : {}),
              });
            }
          }
        }
      })
      .catch(() => {});
    // initialValue and onFilterChange are stable — only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    courts,
    selectedDivisions,
    chaptersToComboOptions: useCase.chaptersToComboOptions,
    handleStatusChange: useCase.handleStatusChange,
    handleChapterChange: useCase.handleChapterChange,
    handleFiledDateChange: useCase.handleFiledDateChange,
    handleDivisionChange: useCase.handleDivisionChange,
  };

  return <TrusteeCaseListFilterView viewModel={viewModel} />;
}
