import './TrusteeDistrictFilter.scss';
import ComboBox from '@/lib/components/combobox/ComboBox';
import Icon from '@/lib/components/uswds/Icon';
import { Accordion, AccordionGroup } from '@/lib/components/uswds/Accordion';
import { TrusteeDistrictFilterViewProps } from './trusteeDistrictFilter.types';

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="usa-tag filter-pill">
      {label}
      <button
        type="button"
        className="usa-tag__remove-button"
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
      >
        <Icon name="close" />
      </button>
    </span>
  );
}

function TrusteeDistrictFilterView(props: TrusteeDistrictFilterViewProps) {
  const { viewModel } = props;

  const showDistrictFilter = viewModel.districts.length > 0 && !viewModel.districtsError;
  const hasPills = viewModel.selectedDistricts.length > 0 || viewModel.selectedChapters.length > 0;

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
              {showDistrictFilter && (
                <div className="filter-control">
                  <div className="filter-control-header">
                    <span className="filter-control-label">District (Division)</span>
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
                    label="District (Division)"
                    options={viewModel.districtsToComboOptions(viewModel.districts)}
                    selections={viewModel.selectedDistricts}
                    onUpdateSelection={viewModel.handleFilterChange}
                    multiSelect={true}
                    wrapPills={true}
                    pluralLabel="districts"
                    singularLabel="district"
                    placeholder="- Select one or more -"
                    ref={viewModel.districtFilterRef}
                    hideClearAllButton={true}
                  />
                </div>
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
        <div className="filter-pills-container">
          {viewModel.selectedDistricts.map((district) => (
            <FilterPill
              key={district.value}
              label={district.label}
              onRemove={() => viewModel.handleRemovePill(district)}
            />
          ))}
          {viewModel.selectedChapters.map((chapter) => (
            <FilterPill
              key={chapter.value}
              label={chapter.label}
              onRemove={() => viewModel.handleRemoveChapterPill(chapter)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default TrusteeDistrictFilterView;
