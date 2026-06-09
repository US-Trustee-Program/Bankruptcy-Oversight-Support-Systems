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
    chaptersToComboOptions: useCase.chaptersToComboOptions,
    handleStatusChange: useCase.handleStatusChange,
    handleChapterChange: useCase.handleChapterChange,
    handleClearAll: useCase.handleClearAll,
  };

  return <TrusteeCaseListFilterView viewModel={viewModel} />;
};

const TrusteeCaseListFilter = forwardRef(TrusteeCaseListFilter_);
export default TrusteeCaseListFilter;

function useTrusteeCaseListFilterStoreReact(): TrusteeCaseListFilterStore {
  const [selectedStatus, setSelectedStatus] = useState<'OPEN' | 'CLOSED' | 'ALL'>('ALL');
  const [selectedChapters, setSelectedChapters] = useState<ComboOption[]>([]);

  return {
    selectedStatus,
    setSelectedStatus,
    selectedChapters,
    setSelectedChapters,
  };
}

function useTrusteeCaseListFilterControlsReact(): TrusteeCaseListFilterControls {
  const chapterFilterRef = useRef<ComboBoxRef>(null);

  return { chapterFilterRef };
}
