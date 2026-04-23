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
  const useCase = trusteeDistrictFilterUseCase(store, controls, props.handleFilterDistrict);
  const globalAlert = useGlobalAlert();

  useImperativeHandle(ref, () => {
    return {
      refresh: useCase.fetchDistricts,
      focus: useCase.focusOnDistrictFilter,
    };
  });

  useEffect(() => {
    if (store.districtsError) {
      globalAlert?.error('There was a problem loading the district filter options.');
    }
  }, [store.districtsError, globalAlert]);

  useEffect(() => {
    useCase.fetchDistricts();
  }, []);

  const viewModel: TrusteeDistrictFilterViewModel = {
    districts: store.districts,
    districtsError: store.districtsError,
    selectedDistricts: store.selectedDistricts,
    isExpanded: store.isExpanded,
    districtFilterRef: controls.districtFilterRef,
    districtsToComboOptions: useCase.districtsToComboOptions,
    handleFilterChange: useCase.handleFilterChange,
    handleClearAll: useCase.handleClearAll,
    handleToggleExpanded: useCase.handleToggleExpanded,
    handleRemovePill: useCase.handleRemovePill,
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
    isExpanded,
    setIsExpanded,
  };
}

function useTrusteeDistrictFilterControlsReact() {
  const districtFilterRef = useRef<ComboBoxRef>(null);

  return {
    districtFilterRef,
  };
}
