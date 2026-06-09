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
  TrusteeCaseListFilterViewModel,
} from './trusteeCaseListFilter.types';

const TrusteeCaseListFilter_ = (
  props: TrusteeCaseListFilterProps,
  ref: React.Ref<TrusteeCaseListFilterRef>,
) => {
  const { onFilterChange } = props;

  const store: TrusteeCaseListFilterStore = useTrusteeCaseListFilterStoreReact();
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

function useTrusteeCaseListFilterStoreReact(): TrusteeCaseListFilterStore {
  const [selectedStatus, setSelectedStatus] = useState<'OPEN' | 'CLOSED' | 'ALL'>('ALL');
  const [selectedChapters, setSelectedChapters] = useState<ComboOption[]>([]);
  const [filedDateFrom, setFiledDateFrom] = useState('');
  const [filedDateTo, setFiledDateTo] = useState('');
  const [appointedDateFrom, setAppointedDateFrom] = useState('');
  const [appointedDateTo, setAppointedDateTo] = useState('');
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
