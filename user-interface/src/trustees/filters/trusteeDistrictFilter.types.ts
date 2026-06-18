import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { ComboBoxRef } from '@/lib/type-declarations/input-fields';
import { CourtDivisionDetails } from '@common/cams/courts';
import { CamsSession } from '@common/cams/session';

export type StatusFilterValue = 'all' | 'active' | 'inactive';

export interface TrusteeDistrictFilterStore {
  districts: CourtDivisionDetails[];
  setDistricts(val: CourtDivisionDetails[]): void;
  districtsError: boolean;
  setDistrictsError(val: boolean): void;
  selectedDistricts: ComboOption[];
  setSelectedDistricts(val: ComboOption[]): void;
  defaultDistricts: ComboOption[];
  setDefaultDistricts(val: ComboOption[]): void;
  selectedChapters: ComboOption[];
  setSelectedChapters(val: ComboOption[]): void;
  selectedDivisions: ComboOption[];
  setSelectedDivisions(val: ComboOption[]): void;
  defaultDivisions: ComboOption[];
  setDefaultDivisions(val: ComboOption[]): void;
  isExpanded: boolean;
  setIsExpanded(val: boolean): void;
}

export interface TrusteeDistrictFilterControls {
  districtFilterRef: React.RefObject<ComboBoxRef | null>;
  chapterFilterRef: React.RefObject<ComboBoxRef | null>;
  divisionFilterRef: React.RefObject<ComboBoxRef | null>;
}

export type TrusteeDistrictFilterViewProps = {
  viewModel: TrusteeDistrictFilterViewModel;
};

export interface TrusteeDistrictFilterViewModel {
  districts: CourtDivisionDetails[];
  districtsError: boolean;
  selectedDistricts: ComboOption[];
  selectedChapters: ComboOption[];
  selectedDivisions: ComboOption[];
  combinedDistrictDivisionOptions: ComboOption[];
  districtDivisionEnabled: boolean;
  isExpanded: boolean;
  districtFilterRef: React.RefObject<ComboBoxRef | null>;
  chapterFilterRef: React.RefObject<ComboBoxRef | null>;
  divisionFilterRef: React.RefObject<ComboBoxRef | null>;
  nameSearch: string;
  upgradeAnnouncement: string;
  statusFilter: StatusFilterValue;

  districtsToComboOptions(districts: CourtDivisionDetails[]): ComboOption[];
  chaptersToComboOptions(): ComboOption[];
  handleFilterChange(districts: ComboOption[]): void;
  handleClearAll(): void;
  handleToggleExpanded(): void;
  handleFilterChapter(chapters: ComboOption[]): void;
  handleClearAllChapters(): void;
  handleFilterName(name: string): void;
  handleFilterStatus(status: StatusFilterValue): void;
  handleFilterDivision(divisions: ComboOption[]): void;
  handleClearAllDivisions(): void;
  handleFilterCombined(selections: ComboOption[]): void;
}

export interface TrusteeDistrictFilterRef {
  refresh: () => void;
  focus: () => void;
  clearAll: () => void;
}

export type TrusteeDistrictFilterProps = {
  handleFilterDistrict(districts: ComboOption[]): void;
  handleFilterChapter(chapters: ComboOption[]): void;
  handleFilterName(name: string): void;
  handleFilterDivision(divisions: ComboOption[]): void;
  handleFilterStatus(status: StatusFilterValue): void;
  statusFilter: StatusFilterValue;
  combinedDistrictDivisionOptions: ComboOption[];
  onExpandedChange?: (isExpanded: boolean) => void;
  onCourtsLoaded?: (courts: CourtDivisionDetails[]) => void;
};

export interface TrusteeDistrictFilterUseCase {
  districtsToComboOptions(districts: CourtDivisionDetails[]): ComboOption[];
  chaptersToComboOptions(): ComboOption[];
  fetchDistricts(): Promise<void>;
  focusOnDistrictFilter(): void;
  getDefaultDistrictsFromSession(
    session: CamsSession | null,
    allDistricts: CourtDivisionDetails[],
  ): ComboOption[];
  handleFilterChange(districts: ComboOption[]): void;
  handleClearAll(): void;
  handleToggleExpanded(): void;
  handleFilterChapter(chapters: ComboOption[]): void;
  handleClearAllChapters(): void;
  handleFilterDivision(divisions: ComboOption[]): void;
  handleClearAllDivisions(): void;
  handleFilterCombined(selections: ComboOption[]): void;
}
