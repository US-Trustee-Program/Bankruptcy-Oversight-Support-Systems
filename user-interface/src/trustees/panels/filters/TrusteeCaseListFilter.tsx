import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { ComboBoxRef } from '@/lib/type-declarations/input-fields';
import { ComboOption } from '@/lib/components/combobox/ComboBox';
import TrusteeCaseListFilterView from './TrusteeCaseListFilterView';
import trusteeCaseListFilterUseCase from './trusteeCaseListFilterUseCase';
import {
  TrusteeCaseListFilterControls,
  TrusteeCaseListFilterProps,
  TrusteeCaseListFilterRef,
  TrusteeCaseListFilterStore,
  TrusteeCaseListFilterValue,
  TrusteeCaseListFilterViewModel,
} from './trusteeCaseListFilter.types';

const TrusteeCaseListFilter_ = (
  props: TrusteeCaseListFilterProps,
  ref: React.Ref<TrusteeCaseListFilterRef>,
) => {
  const { onFilterChange, initialValue } = props;

  const store: TrusteeCaseListFilterStore = useTrusteeCaseListFilterStoreReact(initialValue);
  const controls: TrusteeCaseListFilterControls = useTrusteeCaseListFilterControlsReact();

  const useCase = trusteeCaseListFilterUseCase(store, controls, onFilterChange);

  useImperativeHandle(ref, () => ({
    clearAll: useCase.handleClearAll,
  }));

  const viewModel: TrusteeCaseListFilterViewModel = {
    selectedStatus: store.selectedStatus,
    selectedChapters: store.selectedChapters,
    chapterFilterRef: controls.chapterFilterRef,
    filedDateFrom: store.filedDateFrom,
    filedDateTo: store.filedDateTo,
    appointedDateFrom: store.appointedDateFrom,
    appointedDateTo: store.appointedDateTo,
    filedDateError: store.filedDateError,
    appointedDateError: store.appointedDateError,
    chaptersToComboOptions: useCase.chaptersToComboOptions,
    handleStatusChange: useCase.handleStatusChange,
    handleChapterChange: useCase.handleChapterChange,
    handleClearAll: useCase.handleClearAll,
    handleFiledDateChange: useCase.handleFiledDateChange,
    handleAppointedDateChange: useCase.handleAppointedDateChange,
  };

  return <TrusteeCaseListFilterView viewModel={viewModel} />;
};

const TrusteeCaseListFilter = forwardRef(TrusteeCaseListFilter_);
export default TrusteeCaseListFilter;

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
    initialValue?.caseStatus ?? 'ALL',
  );
  const [selectedChapters, setSelectedChapters] = useState<ComboOption[]>(
    initialValue?.chapters?.length
      ? CASE_CHAPTER_OPTIONS.filter((o) => initialValue.chapters.includes(o.value))
      : [],
  );
  const [filedDateFrom, setFiledDateFrom] = useState(initialValue?.filedDateFrom ?? '');
  const [filedDateTo, setFiledDateTo] = useState(initialValue?.filedDateTo ?? '');
  const [appointedDateFrom, setAppointedDateFrom] = useState(initialValue?.appointedDateFrom ?? '');
  const [appointedDateTo, setAppointedDateTo] = useState(initialValue?.appointedDateTo ?? '');
  const [filedDateError, setFiledDateError] = useState('');
  const [appointedDateError, setAppointedDateError] = useState('');

  return {
    selectedStatus,
    setSelectedStatus,
    selectedChapters,
    setSelectedChapters,
    filedDateFrom,
    setFiledDateFrom,
    filedDateTo,
    setFiledDateTo,
    appointedDateFrom,
    setAppointedDateFrom,
    appointedDateTo,
    setAppointedDateTo,
    filedDateError,
    setFiledDateError,
    appointedDateError,
    setAppointedDateError,
  };
}

function useTrusteeCaseListFilterControlsReact(): TrusteeCaseListFilterControls {
  const chapterFilterRef = useRef<ComboBoxRef>(null);

  return { chapterFilterRef };
}
