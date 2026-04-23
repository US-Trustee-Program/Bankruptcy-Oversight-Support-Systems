import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { ComboBoxRef } from '@/lib/type-declarations/input-fields';
import { CourtDivisionDetails } from '@common/cams/courts';
import { CamsSession } from '@common/cams/session';

export interface TrusteeDistrictFilterStore {
  filterDistrictCallback: ((districts: ComboOption[]) => void) | null;
  setFilterDistrictCallback(val: ((districts: ComboOption[]) => void) | null): void;
  districts: CourtDivisionDetails[];
  setDistricts(val: CourtDivisionDetails[]): void;
  districtsError: boolean;
  setDistrictsError(val: boolean): void;
  selectedDistricts: ComboOption[];
  setSelectedDistricts(val: ComboOption[]): void;
  defaultDistricts: ComboOption[];
  setDefaultDistricts(val: ComboOption[]): void;
  isExpanded: boolean;
  setIsExpanded(val: boolean): void;
}

export interface TrusteeDistrictFilterControls {
  districtFilterRef: React.RefObject<ComboBoxRef | null>;
}

export type TrusteeDistrictFilterViewProps = {
  viewModel: TrusteeDistrictFilterViewModel;
};

export interface TrusteeDistrictFilterViewModel {
  districts: CourtDivisionDetails[];
  districtsError: boolean;
  selectedDistricts: ComboOption[];
  isExpanded: boolean;
  districtFilterRef: React.RefObject<ComboBoxRef | null>;

  districtsToComboOptions(districts: CourtDivisionDetails[]): ComboOption[];
  handleFilterChange(districts: ComboOption[]): void;
  handleClearAll(): void;
  handleToggleExpanded(): void;
  handleRemovePill(district: ComboOption): void;
}

export interface TrusteeDistrictFilterRef {
  refresh: () => void;
  focus: () => void;
}

export type TrusteeDistrictFilterProps = {
  handleFilterDistrict(districts: ComboOption[]): void;
};

export interface TrusteeDistrictFilterUseCase {
  districtsToComboOptions(districts: CourtDivisionDetails[]): ComboOption[];
  fetchDistricts(onDefault?: (districts: ComboOption[]) => void): void;
  focusOnDistrictFilter(): void;
  getDefaultDistrictsFromSession(
    session: CamsSession | null,
    allDistricts: CourtDivisionDetails[],
  ): ComboOption[];
  handleFilterChange(districts: ComboOption[]): void;
  handleClearAll(): void;
  handleToggleExpanded(): void;
  handleRemovePill(district: ComboOption): void;
}
