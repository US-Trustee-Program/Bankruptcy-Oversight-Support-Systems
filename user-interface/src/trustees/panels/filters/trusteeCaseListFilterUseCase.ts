import { ComboOption } from '@/lib/components/combobox/ComboBox';
import {
  TrusteeCaseListFilterControls,
  TrusteeCaseListFilterStore,
  TrusteeCaseListFilterUseCase,
  TrusteeCaseListFilterValue,
} from './trusteeCaseListFilter.types';

const CASE_CHAPTER_OPTIONS: ComboOption[] = [
  { value: '7', label: 'Chapter 7', selectedLabel: 'Chapter 7' },
  { value: '11', label: 'Chapter 11', selectedLabel: 'Chapter 11' },
  { value: '12', label: 'Chapter 12', selectedLabel: 'Chapter 12' },
  { value: '13', label: 'Chapter 13', selectedLabel: 'Chapter 13' },
  { value: '15', label: 'Chapter 15', selectedLabel: 'Chapter 15' },
];

const trusteeCaseListFilterUseCase = (
  store: TrusteeCaseListFilterStore,
  _controls: TrusteeCaseListFilterControls,
  onFilterChange: (filter: TrusteeCaseListFilterValue) => void,
): TrusteeCaseListFilterUseCase => {
  const chaptersToComboOptions = (): ComboOption[] => CASE_CHAPTER_OPTIONS;

  const handleStatusChange = (status: 'OPEN' | 'CLOSED' | 'ALL') => {
    store.setSelectedStatus(status);
    onFilterChange({ caseStatus: status, chapters: store.selectedChapters.map((c) => c.value) });
  };

  const handleChapterChange = (chapters: ComboOption[]) => {
    store.setSelectedChapters(chapters);
    onFilterChange({ caseStatus: store.selectedStatus, chapters: chapters.map((c) => c.value) });
  };

  const handleClearAll = () => {
    store.setSelectedStatus('ALL');
    store.setSelectedChapters([]);
    onFilterChange({ caseStatus: 'ALL', chapters: [] });
  };

  return {
    chaptersToComboOptions,
    handleStatusChange,
    handleChapterChange,
    handleClearAll,
  };
};

export default trusteeCaseListFilterUseCase;
