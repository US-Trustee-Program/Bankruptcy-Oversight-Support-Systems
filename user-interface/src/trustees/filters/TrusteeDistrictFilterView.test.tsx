import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TrusteeDistrictFilterView from './TrusteeDistrictFilterView';
import { TrusteeDistrictFilterViewModel } from './trusteeDistrictFilter.types';

vi.mock('@/lib/components/DistrictDivisionComboBox', () => ({
  default: () => <div data-testid="district-division-combobox-stub" />,
}));

function buildViewModel(
  override: Partial<TrusteeDistrictFilterViewModel> = {},
): TrusteeDistrictFilterViewModel {
  return {
    districts: [],
    districtsError: false,
    selectedChapters: [],
    selectedDivisions: [],
    isExpanded: false,
    chapterFilterRef: { current: null },
    nameSearch: '',
    statusFilter: 'active',
    chaptersToComboOptions: vi.fn().mockReturnValue([]),
    handleToggleExpanded: vi.fn(),
    handleFilterChapter: vi.fn(),
    handleClearAllChapters: vi.fn(),
    handleFilterName: vi.fn(),
    handleFilterStatus: vi.fn(),
    handleFilterDivision: vi.fn(),
    ...override,
  };
}

describe('TrusteeDistrictFilterView', () => {
  test('should call handleFilterDivision with the remaining divisions when a division pill is removed', async () => {
    const user = userEvent.setup();
    const viewModel = buildViewModel({
      selectedDivisions: [{ value: '081', label: 'Manhattan (081)' }],
      selectedChapters: [{ value: '7', label: 'Chapter 7' }],
    });

    render(<TrusteeDistrictFilterView viewModel={viewModel} />);

    const divisionPill = screen.getByTestId('pill-pill-filter-pills-1');
    await user.click(divisionPill);

    expect(viewModel.handleFilterDivision).toHaveBeenCalledWith([]);
    expect(viewModel.handleFilterChapter).not.toHaveBeenCalled();
  });

  test('should call handleFilterChapter with the remaining chapters when a chapter pill is removed', async () => {
    const user = userEvent.setup();
    const viewModel = buildViewModel({
      selectedDivisions: [{ value: '081', label: 'Manhattan (081)' }],
      selectedChapters: [{ value: '7', label: 'Chapter 7' }],
    });

    render(<TrusteeDistrictFilterView viewModel={viewModel} />);

    const chapterPill = screen.getByTestId('pill-pill-filter-pills-2');
    await user.click(chapterPill);

    expect(viewModel.handleFilterChapter).toHaveBeenCalledWith([]);
    expect(viewModel.handleFilterDivision).not.toHaveBeenCalled();
  });
});
