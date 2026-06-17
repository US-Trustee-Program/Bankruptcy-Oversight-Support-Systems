import { ComboOption } from '@/lib/components/combobox/ComboBox';
import {
  TrusteeCaseListFilterStore,
  TrusteeCaseListFilterUseCase,
  TrusteeCaseListFilterValue,
  TrusteeCaseStatus,
} from './trusteeCaseListFilter.types';

export const CASE_CHAPTER_OPTIONS: ComboOption[] = [
  { value: '7', label: 'Chapter 7', selectedLabel: 'Chapter 7' },
  { value: '11', label: 'Chapter 11', selectedLabel: 'Chapter 11' },
  { value: '12', label: 'Chapter 12', selectedLabel: 'Chapter 12' },
  { value: '13', label: 'Chapter 13', selectedLabel: 'Chapter 13' },
  { value: '15', label: 'Chapter 15', selectedLabel: 'Chapter 15' },
];

const buildFilterFromStore = (
  store: TrusteeCaseListFilterStore,
  overrides?: Partial<TrusteeCaseListFilterValue>,
): TrusteeCaseListFilterValue => ({
  caseStatus: store.selectedStatus,
  chapters: store.selectedChapters.map((c) => c.value),
  filedDateFrom: store.filedDateFrom || undefined,
  filedDateTo: store.filedDateTo || undefined,
  ...overrides,
});

const trusteeCaseListFilterUseCase = (
  store: TrusteeCaseListFilterStore,
  onFilterChange: (filter: TrusteeCaseListFilterValue) => void,
): TrusteeCaseListFilterUseCase => {
  const chaptersToComboOptions = (): ComboOption[] => CASE_CHAPTER_OPTIONS;

  const announce = (message: string) => {
    store.setFilterAnnouncement('');
    requestAnimationFrame(() => store.setFilterAnnouncement(message));
  };

  const handleStatusChange = (status: TrusteeCaseStatus) => {
    store.setSelectedStatus(status);
    onFilterChange(buildFilterFromStore(store, { caseStatus: status }));
    const label = status === 'ALL' ? 'All' : status === 'OPEN' ? 'Open' : 'Closed';
    announce(`Case status filter set to ${label}`);
  };

  const handleChapterChange = (chapters: ComboOption[]) => {
    store.setSelectedChapters(chapters);
    onFilterChange(buildFilterFromStore(store, { chapters: chapters.map((c) => c.value) }));
    if (chapters.length === 0) {
      announce('Chapter filter cleared');
    } else {
      announce(`Chapter filter: ${chapters.map((c) => c.label).join(', ')}`);
    }
  };

  const handleFiledDateChange = (from: string, to: string) => {
    if (from && to && to < from) {
      store.setFiledDateError('End date must be on or after start date');
      return;
    }
    store.setFiledDateError('');
    store.setFiledDateFrom(from);
    store.setFiledDateTo(to);
    onFilterChange(
      buildFilterFromStore(store, {
        filedDateFrom: from || undefined,
        filedDateTo: to || undefined,
      }),
    );
    if (from || to) {
      announce(`Filed date filter applied`);
    } else {
      announce('Filed date filter cleared');
    }
  };

  return {
    chaptersToComboOptions,
    handleStatusChange,
    handleChapterChange,
    handleFiledDateChange,
  };
};

export default trusteeCaseListFilterUseCase;
