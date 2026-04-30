import {
  TrusteeDistrictFilterControls,
  TrusteeDistrictFilterProps,
  TrusteeDistrictFilterRef,
  TrusteeDistrictFilterStore,
  TrusteeDistrictFilterViewModel,
} from './trusteeDistrictFilter.types';
import { CourtDivisionDetails } from '@common/cams/courts';
import TrusteeDistrictFilterView from './TrusteeDistrictFilterView';
import trusteeDistrictFilterUseCase from './trusteeDistrictFilterUseCase';
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { ComboBoxRef } from '@/lib/type-declarations/input-fields';
import { ComboOption } from '@/lib/components/combobox/ComboBox';

const TrusteeDistrictFilter_ = (
  props: TrusteeDistrictFilterProps,
  ref: React.Ref<TrusteeDistrictFilterRef>,
) => {
  const store: TrusteeDistrictFilterStore = useTrusteeDistrictFilterStoreReact();
  const controls: TrusteeDistrictFilterControls = useTrusteeDistrictFilterControlsReact();
  const previousDistrictsRef = useRef<ComboOption[] | undefined>(undefined);
  const previousChaptersRef = useRef<ComboOption[] | undefined>(undefined);
  const useCase = trusteeDistrictFilterUseCase(
    store,
    controls,
    props.handleFilterDistrict,
    previousDistrictsRef,
    props.handleFilterChapter,
    previousChaptersRef,
  );
  const globalAlert = useGlobalAlert();

  useImperativeHandle(ref, () => {
    return {
      refresh: useCase.fetchDistricts,
      focus: useCase.focusOnDistrictFilter,
      clearAll: useCase.handleClearAll,
    };
  });

  useEffect(() => {
    if (store.districtsError) {
      globalAlert?.error('There was a problem loading the district filter options.');
    }
  }, [store.districtsError, globalAlert]);

  // fetchDistricts should only run once on mount to avoid unnecessary API calls
  // useCase is stable across renders given the same props.handleFilterDistrict
  useEffect(() => {
    useCase.fetchDistricts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Notify parent when expanded state changes
  useEffect(() => {
    if (props.onExpandedChange) {
      props.onExpandedChange(store.isExpanded);
    }
  }, [store.isExpanded, props.onExpandedChange]);

  const viewModel: TrusteeDistrictFilterViewModel = {
    districts: store.districts,
    districtsError: store.districtsError,
    selectedDistricts: store.selectedDistricts,
    selectedChapters: store.selectedChapters,
    isExpanded: store.isExpanded,
    districtFilterRef: controls.districtFilterRef,
    chapterFilterRef: controls.chapterFilterRef,
    districtsToComboOptions: useCase.districtsToComboOptions,
    chaptersToComboOptions: useCase.chaptersToComboOptions,
    handleFilterChange: useCase.handleFilterChange,
    handleClearAll: useCase.handleClearAll,
    handleToggleExpanded: useCase.handleToggleExpanded,
    handleFilterChapter: useCase.handleFilterChapter,
    handleClearAllChapters: useCase.handleClearAllChapters,
  };

  return <TrusteeDistrictFilterView viewModel={viewModel}></TrusteeDistrictFilterView>;
};

const TrusteeDistrictFilter = forwardRef(TrusteeDistrictFilter_);
export default TrusteeDistrictFilter;

function useTrusteeDistrictFilterStoreReact() {
  const [districts, setDistricts] = useState<CourtDivisionDetails[]>([]);
  const [districtsError, setDistrictsError] = useState<boolean>(false);
  const [selectedDistricts, setSelectedDistricts] = useState<ComboOption[]>([]);
  const [defaultDistricts, setDefaultDistricts] = useState<ComboOption[]>([]);
  const [selectedChapters, setSelectedChapters] = useState<ComboOption[]>([]);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  return {
    districts,
    setDistricts,
    districtsError,
    setDistrictsError,
    selectedDistricts,
    setSelectedDistricts,
    defaultDistricts,
    setDefaultDistricts,
    selectedChapters,
    setSelectedChapters,
    isExpanded,
    setIsExpanded,
  };
}

function useTrusteeDistrictFilterControlsReact() {
  const districtFilterRef = useRef<ComboBoxRef>(null);
  const chapterFilterRef = useRef<ComboBoxRef>(null);

  return {
    districtFilterRef,
    chapterFilterRef,
  };
}
