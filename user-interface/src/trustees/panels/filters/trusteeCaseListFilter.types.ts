import { ComboOption } from '@/lib/components/combobox/ComboBox';
import type { TrusteeCaseStatus } from '@common/api/search';
export type { TrusteeCaseStatus };

export type TrusteeCaseListFilterValue = {
  caseStatus: TrusteeCaseStatus;
  chapters: string[];
  filedDateFrom?: string;
  filedDateTo?: string;
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
}

interface TrusteeCaseListFilterHandlers {
  chaptersToComboOptions(): ComboOption[];
  handleStatusChange(status: TrusteeCaseStatus): void;
  handleChapterChange(chapters: ComboOption[]): void;
  handleFiledDateChange(from: string, to: string): void;
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
}

export type TrusteeCaseListFilterProps = {
  onFilterChange(filter: TrusteeCaseListFilterValue): void;
  initialValue?: TrusteeCaseListFilterValue;
};

export type TrusteeCaseListFilterUseCase = TrusteeCaseListFilterHandlers;
