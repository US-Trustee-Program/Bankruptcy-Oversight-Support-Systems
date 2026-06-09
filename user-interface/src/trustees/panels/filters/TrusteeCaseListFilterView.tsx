import ComboBox, { ComboOption } from '@/lib/components/combobox/ComboBox';
import PillBox from '@/lib/components/PillBox';
import { Accordion, AccordionGroup } from '@/lib/components/uswds/Accordion';
import { TrusteeCaseListFilterViewProps } from './trusteeCaseListFilter.types';

function TrusteeCaseListFilterView({ viewModel }: TrusteeCaseListFilterViewProps) {
  const { selectedStatus, selectedChapters, chapterFilterRef } = viewModel;

  const isFiltered = selectedStatus !== 'ALL' || selectedChapters.length > 0;

  const statusPill: ComboOption | null =
    selectedStatus !== 'ALL'
      ? { value: selectedStatus, label: selectedStatus === 'OPEN' ? 'Open' : 'Closed' }
      : null;

  const allPills: ComboOption[] = [...(statusPill ? [statusPill] : []), ...selectedChapters];

  return (
    <section className="trustee-case-list-filter" aria-label="Case list filter controls">
      <AccordionGroup>
        <Accordion id="case-list-filter">
          <span>Filters</span>
          <div id="case-list-filter-content" className="filter-content">
            <div className="filter-controls-row">
              <div className="filter-control">
                <div className="filter-control-header">
                  <span className="filter-control-label">Status</span>
                </div>
                <select
                  id="case-status-select"
                  className="usa-select"
                  aria-label="Filter by case status"
                  value={selectedStatus}
                  onChange={(e) =>
                    viewModel.handleStatusChange(e.target.value as 'OPEN' | 'CLOSED' | 'ALL')
                  }
                >
                  <option value="ALL">All</option>
                  <option value="OPEN">Open</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>

              <div className="filter-control">
                <div className="filter-control-header">
                  <span className="filter-control-label">Chapter</span>
                </div>
                <ComboBox
                  id="case-chapter-combobox"
                  label="Chapter"
                  hideInternalLabel={true}
                  ariaLabelPrefix="Chapter"
                  options={viewModel.chaptersToComboOptions()}
                  selections={selectedChapters}
                  onUpdateSelection={viewModel.handleChapterChange}
                  multiSelect={true}
                  wrapPills={true}
                  pluralLabel="chapters"
                  singularLabel="chapter"
                  placeholder="- Select one or more -"
                  ref={chapterFilterRef}
                />
              </div>

              <div className="filter-control filter-control--actions">
                <button
                  type="button"
                  className="filter-clear-link"
                  onClick={viewModel.handleClearAll}
                  aria-label="Clear all case list filters"
                  style={{ visibility: isFiltered ? 'visible' : 'hidden' }}
                  disabled={!isFiltered}
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        </Accordion>
      </AccordionGroup>

      {allPills.length > 0 && (
        <PillBox
          id="case-list-filter-pills"
          className="filter-pills-container"
          selections={allPills}
          onSelectionChange={(updatedPills) => {
            const statusRemoved =
              statusPill && !updatedPills.find((p) => p.value === statusPill.value);
            const updatedChapters = updatedPills.filter((p) => p.value !== selectedStatus);

            if (statusRemoved) {
              viewModel.handleStatusChange('ALL');
            }
            if (updatedChapters.length !== selectedChapters.length) {
              viewModel.handleChapterChange(updatedChapters);
            }
          }}
        />
      )}
    </section>
  );
}

export default TrusteeCaseListFilterView;
