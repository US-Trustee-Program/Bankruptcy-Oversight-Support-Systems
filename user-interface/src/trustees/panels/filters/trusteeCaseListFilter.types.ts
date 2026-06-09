import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { ComboBoxRef } from '@/lib/type-declarations/input-fields';

export type TrusteeCaseListFilterValue = {
  caseStatus: 'OPEN' | 'CLOSED' | 'ALL';
  chapters: string[];
};

export interface TrusteeCaseListFilterStore {
  selectedStatus: 'OPEN' | 'CLOSED' | 'ALL';
  setSelectedStatus(val: 'OPEN' | 'CLOSED' | 'ALL'): void;
  selectedChapters: ComboOption[];
  setSelectedChapters(val: ComboOption[]): void;
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

  chaptersToComboOptions(): ComboOption[];
  handleStatusChange(status: 'OPEN' | 'CLOSED' | 'ALL'): void;
  handleChapterChange(chapters: ComboOption[]): void;
  handleClearAll(): void;
}

export type TrusteeCaseListFilterProps = {
  onFilterChange(filter: TrusteeCaseListFilterValue): void;
};

export interface TrusteeCaseListFilterRef {
  clearAll(): void;
}

export interface TrusteeCaseListFilterUseCase {
  chaptersToComboOptions(): ComboOption[];
  handleStatusChange(status: 'OPEN' | 'CLOSED' | 'ALL'): void;
  handleChapterChange(chapters: ComboOption[]): void;
  handleClearAll(): void;
}
