import './TrusteeDistrictFilter.scss';
import ComboBox from '@/lib/components/combobox/ComboBox';
import PillBox from '@/lib/components/PillBox';
import { Accordion, AccordionGroup } from '@/lib/components/uswds/Accordion';
import { TrusteeDistrictFilterViewProps } from './trusteeDistrictFilter.types';

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
                  {viewModel.nameSearch.length > 0 && (
                    <button
                      type="button"
                      className="filter-clear-link"
                      onClick={() => viewModel.handleFilterName('')}
                    >
                      Clear
                    </button>
                  )}
                </div>
                <input
                  id="trustee-name-filter"
                  type="text"
                  className="usa-input"
                  aria-label="Trustee Name"
                  value={viewModel.nameSearch}
                  onChange={(e) => viewModel.handleFilterName(e.target.value)}
                  placeholder="Search by name"
                  autoComplete="off"
                />
              </div>

              {viewModel.districtDivisionEnabled ? (
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
              ) : (
                showLegacyDistrictFilter && (
                  <div className="filter-control">
                    <div className="filter-control-header">
                      <span className="filter-control-label">District</span>
                      {viewModel.selectedDistricts.length > 0 && (
                        <button
                          type="button"
                          className="filter-clear-link"
                          onClick={viewModel.handleClearAll}
                        >
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
                )
              )}

              <div className="filter-control">
                <div className="filter-control-header">
                  <span className="filter-control-label">Chapter</span>
                  {viewModel.selectedChapters.length > 0 && (
                    <button
                      type="button"
                      className="filter-clear-link"
                      onClick={viewModel.handleClearAllChapters}
                    >
                      Clear
                    </button>
                  )}
                </div>
                <ComboBox
                  id="chapter-combobox"
                  label="Chapter"
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
            ...pillDistricts,
            ...viewModel.selectedDivisions,
            ...viewModel.selectedChapters,
          ]}
          onSelectionChange={(updatedPills) => {
            const districtValues = new Set(pillDistricts.map((d) => d.value));
            const divisionValues = new Set(viewModel.selectedDivisions.map((d) => d.value));
            const chapterValues = new Set(viewModel.selectedChapters.map((c) => c.value));

            const updatedDistricts = updatedPills.filter((p) => districtValues.has(p.value));
            const updatedDivisions = updatedPills.filter((p) => divisionValues.has(p.value));
            const updatedChapters = updatedPills.filter((p) => chapterValues.has(p.value));

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
