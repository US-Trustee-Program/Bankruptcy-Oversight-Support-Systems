import trusteeCaseListFilterUseCase from './trusteeCaseListFilterUseCase';
import { TrusteeCaseListFilterStore } from './trusteeCaseListFilter.types';

function buildStore(
  overrides: Partial<TrusteeCaseListFilterStore> = {},
): TrusteeCaseListFilterStore {
  return {
    selectedStatus: 'OPEN',
    setSelectedStatus: vi.fn(),
    selectedChapters: [],
    setSelectedChapters: vi.fn(),
    filedDateFrom: '',
    setFiledDateFrom: vi.fn(),
    filedDateTo: '',
    setFiledDateTo: vi.fn(),
    filterAnnouncement: '',
    setFilterAnnouncement: vi.fn(),
    courts: [],
    setCourts: vi.fn(),
    selectedDivisions: [],
    setSelectedDivisions: vi.fn(),
    resolvedDivisionCodes: undefined,
    setResolvedDivisionCodes: vi.fn(),
    ...overrides,
  };
}

describe('trusteeCaseListFilterUseCase handleFiledDateChange', () => {
  test('does not call onFilterChange or mutate the store when to-date is before from-date', () => {
    const store = buildStore();
    const onFilterChange = vi.fn();
    const useCase = trusteeCaseListFilterUseCase(store, onFilterChange);

    useCase.handleFiledDateChange('2024-06-01', '2024-01-01');

    expect(onFilterChange).not.toHaveBeenCalled();
    expect(store.setFiledDateFrom).not.toHaveBeenCalled();
    expect(store.setFiledDateTo).not.toHaveBeenCalled();
  });

  test('calls onFilterChange and updates the store for a valid range', () => {
    const store = buildStore();
    const onFilterChange = vi.fn();
    const useCase = trusteeCaseListFilterUseCase(store, onFilterChange);

    useCase.handleFiledDateChange('2024-01-01', '2024-06-01');

    expect(store.setFiledDateFrom).toHaveBeenCalledWith('2024-01-01');
    expect(store.setFiledDateTo).toHaveBeenCalledWith('2024-06-01');
    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ filedDateFrom: '2024-01-01', filedDateTo: '2024-06-01' }),
    );
  });

  test('allows a single-sided date (only from, or only to) with nothing to compare against', () => {
    const store = buildStore();
    const onFilterChange = vi.fn();
    const useCase = trusteeCaseListFilterUseCase(store, onFilterChange);

    useCase.handleFiledDateChange('2024-01-01', '');

    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ filedDateFrom: '2024-01-01', filedDateTo: undefined }),
    );
  });

  test('allows clearing both dates', () => {
    const store = buildStore({ filedDateFrom: '2024-01-01', filedDateTo: '2024-06-01' });
    const onFilterChange = vi.fn();
    const useCase = trusteeCaseListFilterUseCase(store, onFilterChange);

    useCase.handleFiledDateChange('', '');

    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ filedDateFrom: undefined, filedDateTo: undefined }),
    );
  });
});
