import { ComboOption } from '@/lib/components/combobox/ComboBox';
import type { TrusteeCaseStatus } from '@common/api/search';
import { CourtDivisionDetails } from '@common/cams/courts';
export type { TrusteeCaseStatus };

export type TrusteeCaseListFilterValue = {
  caseStatus: TrusteeCaseStatus;
  chapters: string[];
  filedDateFrom?: string;
  filedDateTo?: string;
  divisionCodes?: string[];
};

export interface TrusteeCaseListFilterStore {
  selectedStatus: TrusteeCaseStatus;
  setSelectedStatus(val: TrusteeCaseStatus): void;
  selectedChapters: ComboOption[];
  setSelectedChapters(val: ComboOption[]): void;
  filedDateFrom: string;
  setFiledDateFrom(val: string): void;
  filedDateTo: string;
  setFiledDateTo(val: string): void;
  filedDateError: string;
  setFiledDateError(val: string): void;
  filterAnnouncement: string;
  setFilterAnnouncement(val: string): void;
  courts: CourtDivisionDetails[];
  setCourts(val: CourtDivisionDetails[]): void;
  selectedDivisions: ComboOption[];
  setSelectedDivisions(val: ComboOption[]): void;
  resolvedDivisionCodes: string[] | undefined;
  setResolvedDivisionCodes(val: string[] | undefined): void;
}

interface TrusteeCaseListFilterHandlers {
  chaptersToComboOptions(): ComboOption[];
  handleStatusChange(status: TrusteeCaseStatus): void;
  handleChapterChange(chapters: ComboOption[]): void;
  handleFiledDateChange(from: string, to: string): void;
  handleDivisionChange(divisions: ComboOption[]): void;
}

export type TrusteeCaseListFilterViewProps = {
  viewModel: TrusteeCaseListFilterViewModel;
};

export interface TrusteeCaseListFilterViewModel extends TrusteeCaseListFilterHandlers {
  selectedStatus: TrusteeCaseStatus;
  selectedChapters: ComboOption[];
  filedDateFrom: string;
  filedDateTo: string;
  filedDateError: string;
  filterAnnouncement: string;
  courts: CourtDivisionDetails[];
  selectedDivisions: ComboOption[];
}

export type TrusteeCaseListFilterProps = {
  onFilterChange(filter: TrusteeCaseListFilterValue): void;
  initialValue?: TrusteeCaseListFilterValue;
};

export type TrusteeCaseListFilterUseCase = TrusteeCaseListFilterHandlers;
