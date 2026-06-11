import { useRef, useState } from 'react';
import { ComboBoxRef } from '@/lib/type-declarations/input-fields';
import { ComboOption } from '@/lib/components/combobox/ComboBox';
import TrusteeCaseListFilterView from './TrusteeCaseListFilterView';
import trusteeCaseListFilterUseCase from './trusteeCaseListFilterUseCase';
import {
  TrusteeCaseListFilterControls,
  TrusteeCaseListFilterProps,
  TrusteeCaseListFilterStore,
  TrusteeCaseListFilterValue,
  TrusteeCaseListFilterViewModel,
} from './trusteeCaseListFilter.types';

export default function TrusteeCaseListFilter(props: TrusteeCaseListFilterProps) {
  const { onFilterChange, initialValue } = props;

  const store: TrusteeCaseListFilterStore = useTrusteeCaseListFilterStoreReact(initialValue);
  const controls: TrusteeCaseListFilterControls = useTrusteeCaseListFilterControlsReact();

  const useCase = trusteeCaseListFilterUseCase(store, controls, onFilterChange);

  const viewModel: TrusteeCaseListFilterViewModel = {
    selectedStatus: store.selectedStatus,
    selectedChapters: store.selectedChapters,
    chapterFilterRef: controls.chapterFilterRef,
    filedDateFrom: store.filedDateFrom,
    filedDateTo: store.filedDateTo,
    filedDateError: store.filedDateError,
    chaptersToComboOptions: useCase.chaptersToComboOptions,
    handleStatusChange: useCase.handleStatusChange,
    handleChapterChange: useCase.handleChapterChange,
    handleFiledDateChange: useCase.handleFiledDateChange,
  };

  return <TrusteeCaseListFilterView viewModel={viewModel} />;
}

function useTrusteeCaseListFilterStoreReact(
  initialValue?: TrusteeCaseListFilterValue,
): TrusteeCaseListFilterStore {
  const CASE_CHAPTER_OPTIONS: ComboOption[] = [
    { value: '7', label: 'Chapter 7', selectedLabel: 'Chapter 7' },
    { value: '11', label: 'Chapter 11', selectedLabel: 'Chapter 11' },
    { value: '12', label: 'Chapter 12', selectedLabel: 'Chapter 12' },
    { value: '13', label: 'Chapter 13', selectedLabel: 'Chapter 13' },
    { value: '15', label: 'Chapter 15', selectedLabel: 'Chapter 15' },
  ];

  const [selectedStatus, setSelectedStatus] = useState<'OPEN' | 'CLOSED' | 'ALL'>(
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

  return {
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
  };
}

function useTrusteeCaseListFilterControlsReact(): TrusteeCaseListFilterControls {
  const chapterFilterRef = useRef<ComboBoxRef>(null);

  return { chapterFilterRef };
}
