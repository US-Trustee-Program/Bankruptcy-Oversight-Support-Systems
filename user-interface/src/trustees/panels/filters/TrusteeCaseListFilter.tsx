import { useRef, useState } from 'react';
import { ComboBoxRef } from '@/lib/type-declarations/input-fields';
import { ComboOption } from '@/lib/components/combobox/ComboBox';
import TrusteeCaseListFilterView from './TrusteeCaseListFilterView';
import trusteeCaseListFilterUseCase, { CASE_CHAPTER_OPTIONS } from './trusteeCaseListFilterUseCase';
import {
  TrusteeCaseListFilterProps,
  TrusteeCaseListFilterViewModel,
  TrusteeCaseStatus,
} from './trusteeCaseListFilter.types';

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
  const chapterFilterRef = useRef<ComboBoxRef>(null);

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
    },
    onFilterChange,
  );

  const viewModel: TrusteeCaseListFilterViewModel = {
    selectedStatus,
    selectedChapters,
    chapterFilterRef,
    filedDateFrom,
    filedDateTo,
    filedDateError,
    chaptersToComboOptions: useCase.chaptersToComboOptions,
    handleStatusChange: useCase.handleStatusChange,
    handleChapterChange: useCase.handleChapterChange,
    handleFiledDateChange: useCase.handleFiledDateChange,
  };

  return <TrusteeCaseListFilterView viewModel={viewModel} />;
}
