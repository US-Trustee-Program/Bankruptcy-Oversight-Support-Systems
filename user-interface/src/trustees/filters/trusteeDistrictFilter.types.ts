import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { ComboBoxRef } from '@/lib/type-declarations/input-fields';
import { CourtDivisionDetails } from '@common/cams/courts';

export type StatusFilterValue = 'all' | 'active' | 'inactive';

export interface TrusteeDistrictFilterStore {
  districts: CourtDivisionDetails[];
  setDistricts(val: CourtDivisionDetails[]): void;
  districtsError: boolean;
  setDistrictsError(val: boolean): void;
  selectedChapters: ComboOption[];
  setSelectedChapters(val: ComboOption[]): void;
  selectedDivisions: ComboOption[];
  setSelectedDivisions(val: ComboOption[]): void;
  isExpanded: boolean;
  setIsExpanded(val: boolean): void;
}

export interface TrusteeDistrictFilterControls {
  chapterFilterRef: React.RefObject<ComboBoxRef | null>;
}

export type TrusteeDistrictFilterViewProps = {
  viewModel: TrusteeDistrictFilterViewModel;
};

export interface TrusteeDistrictFilterViewModel {
  districts: CourtDivisionDetails[];
  districtsError: boolean;
  selectedChapters: ComboOption[];
  selectedDivisions: ComboOption[];
  isExpanded: boolean;
  chapterFilterRef: React.RefObject<ComboBoxRef | null>;
  nameSearch: string;
  statusFilter: StatusFilterValue;
  onDivisionDefaultsApplied?: () => void;

  chaptersToComboOptions(): ComboOption[];
  handleToggleExpanded(): void;
  handleFilterChapter(chapters: ComboOption[]): void;
  handleClearAllChapters(): void;
  handleFilterName(name: string): void;
  handleFilterStatus(status: StatusFilterValue): void;
  handleFilterDivision(divisions: ComboOption[]): void;
}

export interface TrusteeDistrictFilterRef {
  refresh: () => void;
}

export type TrusteeDistrictFilterProps = {
  handleFilterChapter(chapters: ComboOption[]): void;
  handleFilterName(name: string): void;
  handleFilterDivision(divisions: ComboOption[]): void;
  handleFilterStatus(status: StatusFilterValue): void;
  statusFilter: StatusFilterValue;
  onExpandedChange?: (isExpanded: boolean) => void;
  onCourtsLoaded?: (courts: CourtDivisionDetails[]) => void;
  onDivisionDefaultsApplied?: () => void;
};

export interface TrusteeDistrictFilterUseCase {
  chaptersToComboOptions(): ComboOption[];
  fetchDistricts(): Promise<void>;
  handleToggleExpanded(): void;
  handleFilterChapter(chapters: ComboOption[]): void;
  handleClearAllChapters(): void;
  handleFilterDivision(divisions: ComboOption[]): void;
}
