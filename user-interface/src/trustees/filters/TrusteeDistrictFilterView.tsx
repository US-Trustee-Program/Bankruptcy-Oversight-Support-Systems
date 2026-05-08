import './TrusteeDistrictFilter.scss';
import ComboBox, { ComboOption } from '@/lib/components/combobox/ComboBoxAlt';
import PillBox from '@/lib/components/PillBox';
import { Accordion, AccordionGroup } from '@/lib/components/uswds/Accordion';
import { TrusteeDistrictFilterViewProps } from './trusteeDistrictFilter.types';

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
          {viewModel.selectedDivisions.length > 0 && (
            <button
              type="button"
              className="filter-clear-link"
              onClick={viewModel.handleClearAllDivisions}
            >
              Clear
            </button>
          )}
        </div>
        <ComboBox
          id="district-division-combobox"
          label="District (Division)"
          options={viewModel.combinedDistrictDivisionOptions}
          selections={viewModel.selectedDivisions}
          onUpdateSelection={viewModel.handleFilterCombined}
          multiSelect={true}
          wrapPills={true}
          pluralLabel="divisions"
          singularLabel="division"
          placeholder="- Select one or more -"
          ref={viewModel.divisionFilterRef}
          hideClearAllButton={true}
        />
      </div>
    );
  }

  if (!showLegacyDistrictFilter) return null;

  return (
    <div className="filter-control">
      <div className="filter-control-header">
        <span className="filter-control-label">District</span>
        {viewModel.selectedDistricts.length > 0 && (
          <button type="button" className="filter-clear-link" onClick={viewModel.handleClearAll}>
            Clear
          </button>
        )}
      </div>
      <ComboBox
        id="district-combobox"
        label="District"
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
        hideClearAllButton={true}
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
              <div className="filter-control">
                <div className="filter-control-header">
                  <span className="filter-control-label">Trustee Name</span>
                  <div aria-live="off" aria-atomic="false">
                    <button
                      type="button"
                      className="filter-clear-link"
                      onClick={() => viewModel.handleFilterName('')}
                      aria-label="Clear Trustee Name filter"
                      style={{ visibility: viewModel.nameSearch.length > 0 ? 'visible' : 'hidden' }}
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

              <div className="filter-control">
                <div className="filter-control-header">
                  <span className="filter-control-label" aria-hidden="true">
                    Chapter
                  </span>
                </div>
                <ComboBox
                  id="chapter-combobox"
                  label="Chapter"
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
                  hideClearAllButton={true}
                />
                <div aria-live="off" aria-atomic="false">
                  <button
                    type="button"
                    className="filter-clear-link"
                    onClick={viewModel.handleClearAllChapters}
                    aria-label="Clear Chapter filter"
                    style={{
                      visibility: viewModel.selectedChapters.length > 0 ? 'visible' : 'hidden',
                    }}
                    disabled={viewModel.selectedChapters.length === 0}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Accordion>
      </AccordionGroup>

      {hasPills && (
        <div aria-live="off" aria-atomic="false">
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
        </div>
      )}
    </section>
  );
}

export default TrusteeDistrictFilterView;
