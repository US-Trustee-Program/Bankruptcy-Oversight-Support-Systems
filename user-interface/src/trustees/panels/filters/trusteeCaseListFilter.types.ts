import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { ComboBoxRef } from '@/lib/type-declarations/input-fields';
export type { TrusteeCaseStatus } from '@common/api/search';

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
  chapterFilterRef: React.RefObject<ComboBoxRef | null>;
  filedDateFrom: string;
  filedDateTo: string;
  filedDateError: string;
}

export function isFilterActive(filter: TrusteeCaseListFilterValue): boolean {
  return (
    filter.caseStatus === 'CLOSED' ||
    filter.chapters.length > 0 ||
    !!filter.filedDateFrom ||
    !!filter.filedDateTo
  );
}

export type TrusteeCaseListFilterProps = {
  onFilterChange(filter: TrusteeCaseListFilterValue): void;
  initialValue?: TrusteeCaseListFilterValue;
};

export type TrusteeCaseListFilterUseCase = TrusteeCaseListFilterHandlers;
