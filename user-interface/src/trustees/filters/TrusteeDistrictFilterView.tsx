import './TrusteeDistrictFilter.scss';
import ComboBox, { ComboOption } from '@/lib/components/combobox/ComboBox';
import PillBox from '@/lib/components/PillBox';
import { Accordion, AccordionGroup } from '@/lib/components/uswds/Accordion';
import { StatusFilterValue, TrusteeDistrictFilterViewProps } from './trusteeDistrictFilter.types';

const STATUS_OPTIONS: ComboOption[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  {
    value: 'inactive',
    label:
      'Inactive (Involuntarily Suspended, Voluntarily Suspended, Resigned, Terminated, Deceased, Removed, Inactive)',
  },
];

function statusToSelection(status: StatusFilterValue): ComboOption[] {
  const option = STATUS_OPTIONS.find((o) => o.value === status);
  return option ? [option] : [];
}

type FilterPillKind = 'district' | 'division' | 'chapter';
type FilterPill = ComboOption & { kind: FilterPillKind };

function tagPills(options: ComboOption[], kind: FilterPillKind): FilterPill[] {
  return options.map((o) => ({ ...o, kind }));
}

function renderDistrictFilter(
  viewModel: TrusteeDistrictFilterViewProps['viewModel'],
  showLegacyDistrictFilter: boolean,
) {
  if (viewModel.districtDivisionEnabled) {
    return (
      <div className="filter-control">
        <div className="filter-control-header">
          <span className="filter-control-label">District (Division)</span>
        </div>
        <ComboBox
          id="district-division-combobox"
          label="District (Division)"
          hideInternalLabel={true}
          options={viewModel.combinedDistrictDivisionOptions}
          selections={viewModel.selectedDivisions}
          onUpdateSelection={viewModel.handleFilterCombined}
          multiSelect={true}
          wrapPills={true}
          pluralLabel="divisions"
          singularLabel="division"
          placeholder="- Select one or more -"
          ref={viewModel.divisionFilterRef}
        />
      </div>
    );
  }

  if (!showLegacyDistrictFilter) return null;

  return (
    <div className="filter-control">
      <div className="filter-control-header">
        <span className="filter-control-label">District</span>
      </div>
      <ComboBox
        id="district-combobox"
        label="District"
        hideInternalLabel={true}
        options={viewModel.districtsToComboOptions(viewModel.districts)}
        selections={viewModel.selectedDistricts}
        onUpdateSelection={viewModel.handleFilterChange}
        multiSelect={true}
        wrapPills={true}
        pluralLabel="districts"
        singularLabel="district"
        placeholder="- Select one or more -"
        scrollToSelected={true}
        ref={viewModel.districtFilterRef}
      />
    </div>
  );
}

function TrusteeDistrictFilterView(props: TrusteeDistrictFilterViewProps) {
  const { viewModel } = props;

  const showLegacyDistrictFilter =
    !viewModel.districtDivisionEnabled &&
    viewModel.districts.length > 0 &&
    !viewModel.districtsError;
  const pillDistricts = viewModel.districtDivisionEnabled ? [] : viewModel.selectedDistricts;
  const hasPills =
    pillDistricts.length > 0 ||
    viewModel.selectedChapters.length > 0 ||
    viewModel.selectedDivisions.length > 0;

  return (
    <section className="trustee-district-filter" aria-label="Trustee filter controls">
      <span className="screen-reader-only" aria-live="polite" aria-atomic="true">
        {viewModel.upgradeAnnouncement}
      </span>
      <AccordionGroup>
        <Accordion id="district-filter" onExpand={() => viewModel.handleToggleExpanded()}>
          <span>Filters</span>
          <div id="district-filter-content" className="filter-content">
            {viewModel.districtsError && (
              <div className="usa-alert usa-alert--error usa-alert--slim" role="alert">
                <div className="usa-alert__body">
                  <p className="usa-alert__text">
                    Unable to load district filter options. Please try refreshing the page.
                  </p>
                </div>
              </div>
            )}

            <div className="filter-controls-row">
              <div className="filter-controls-pair">
                <div className="filter-control">
                  <div className="filter-control-header">
                    <span className="filter-control-label">Trustee Name</span>
                    <div
                      className="filter-clear-button-container"
                      aria-live="off"
                      aria-atomic="false"
                    >
                      <button
                        type="button"
                        className="filter-clear-link"
                        onClick={() => viewModel.handleFilterName('')}
                        aria-label="Clear Trustee Name filter"
                        style={{
                          visibility: viewModel.nameSearch.length > 0 ? 'visible' : 'hidden',
                        }}
                        disabled={viewModel.nameSearch.length === 0}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <input
                    id="trustee-name-filter"
                    type="text"
                    className="usa-input"
                    aria-label="Trustee Name"
                    aria-live="off"
                    aria-atomic="false"
                    value={viewModel.nameSearch}
                    onChange={(e) => viewModel.handleFilterName(e.target.value)}
                    placeholder="Search by name"
                    autoComplete="off"
                  />
                </div>

                {renderDistrictFilter(viewModel, showLegacyDistrictFilter)}
              </div>

              <div className="filter-controls-pair">
                <div className="filter-control">
                  <div className="filter-control-header">
                    <span className="filter-control-label">Chapter</span>
                  </div>
                  <ComboBox
                    id="chapter-combobox"
                    label="Chapter"
                    hideInternalLabel={true}
                    ariaLabelPrefix="Chapter"
                    options={viewModel.chaptersToComboOptions()}
                    selections={viewModel.selectedChapters}
                    onUpdateSelection={viewModel.handleFilterChapter}
                    multiSelect={true}
                    wrapPills={true}
                    pluralLabel="chapters"
                    singularLabel="chapter"
                    placeholder="- Select one or more -"
                    ref={viewModel.chapterFilterRef}
                  />
                </div>

                <div className="filter-control">
                  <div className="filter-control-header">
                    <span className="filter-control-label">Status</span>
                  </div>
                  <ComboBox
                    id="status-combobox"
                    label="Status"
                    hideInternalLabel={true}
                    ariaLabelPrefix="Status"
                    options={STATUS_OPTIONS}
                    selections={statusToSelection(viewModel.statusFilter)}
                    onUpdateSelection={(selections) => {
                      const value = (selections[0]?.value ?? 'active') as StatusFilterValue;
                      viewModel.handleFilterStatus(value);
                    }}
                    placeholder="Active"
                  />
                </div>
              </div>
            </div>
          </div>
        </Accordion>
      </AccordionGroup>

      {hasPills && (
        <PillBox
          id="filter-pills"
          className="filter-pills-container"
          selections={[
            ...tagPills(pillDistricts, 'district'),
            ...tagPills(viewModel.selectedDivisions, 'division'),
            ...tagPills(viewModel.selectedChapters, 'chapter'),
          ]}
          onSelectionChange={(updatedPills) => {
            const pills = updatedPills as FilterPill[];
            const updatedDistricts = pills.filter((p) => p.kind === 'district');
            const updatedDivisions = pills.filter((p) => p.kind === 'division');
            const updatedChapters = pills.filter((p) => p.kind === 'chapter');

            if (updatedDistricts.length !== pillDistricts.length) {
              viewModel.handleFilterChange(updatedDistricts);
            }
            if (updatedDivisions.length !== viewModel.selectedDivisions.length) {
              viewModel.handleFilterDivision(updatedDivisions);
            }
            if (updatedChapters.length !== viewModel.selectedChapters.length) {
              viewModel.handleFilterChapter(updatedChapters);
            }
          }}
        />
      )}
    </section>
  );
}

export default TrusteeDistrictFilterView;
