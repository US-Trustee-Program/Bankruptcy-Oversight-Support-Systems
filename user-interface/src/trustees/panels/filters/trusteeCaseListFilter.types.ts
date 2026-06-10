import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { ComboBoxRef } from '@/lib/type-declarations/input-fields';

export type TrusteeCaseListFilterValue = {
  caseStatus: 'OPEN' | 'CLOSED' | 'ALL';
  chapters: string[];
  filedDateFrom?: string;
  filedDateTo?: string;
  appointedDateFrom?: string;
  appointedDateTo?: string;
};

export interface TrusteeCaseListFilterStore {
  selectedStatus: 'OPEN' | 'CLOSED' | 'ALL';
  setSelectedStatus(val: 'OPEN' | 'CLOSED' | 'ALL'): void;
  selectedChapters: ComboOption[];
  setSelectedChapters(val: ComboOption[]): void;
  filedDateFrom: string;
  setFiledDateFrom(val: string): void;
  filedDateTo: string;
  setFiledDateTo(val: string): void;
  appointedDateFrom: string;
  setAppointedDateFrom(val: string): void;
  appointedDateTo: string;
  setAppointedDateTo(val: string): void;
  filedDateError: string;
  setFiledDateError(val: string): void;
  appointedDateError: string;
  setAppointedDateError(val: string): void;
}

export interface TrusteeCaseListFilterControls {
  chapterFilterRef: React.RefObject<ComboBoxRef | null>;
}

export type TrusteeCaseListFilterViewProps = {
  viewModel: TrusteeCaseListFilterViewModel;
};

export interface TrusteeCaseListFilterViewModel {
  selectedStatus: 'OPEN' | 'CLOSED' | 'ALL';
  selectedChapters: ComboOption[];
  chapterFilterRef: React.RefObject<ComboBoxRef | null>;
  filedDateFrom: string;
  filedDateTo: string;
  appointedDateFrom: string;
  appointedDateTo: string;
  filedDateError: string;
  appointedDateError: string;

  chaptersToComboOptions(): ComboOption[];
  handleStatusChange(status: 'OPEN' | 'CLOSED' | 'ALL'): void;
  handleChapterChange(chapters: ComboOption[]): void;
  handleClearAll(): void;
  handleFiledDateChange(from: string, to: string): void;
  handleAppointedDateChange(from: string, to: string): void;
}

export type TrusteeCaseListFilterProps = {
  onFilterChange(filter: TrusteeCaseListFilterValue): void;
  initialValue?: TrusteeCaseListFilterValue;
};

export interface TrusteeCaseListFilterRef {
  clearAll(): void;
}

export interface TrusteeCaseListFilterUseCase {
  chaptersToComboOptions(): ComboOption[];
  handleStatusChange(status: 'OPEN' | 'CLOSED' | 'ALL'): void;
  handleChapterChange(chapters: ComboOption[]): void;
  handleClearAll(): void;
  handleFiledDateChange(from: string, to: string): void;
  handleAppointedDateChange(from: string, to: string): void;
}
