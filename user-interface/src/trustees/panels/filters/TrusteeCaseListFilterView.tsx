import ComboBox, { ComboOption } from '@/lib/components/combobox/ComboBox';
import PillBox from '@/lib/components/PillBox';
import { Accordion, AccordionGroup } from '@/lib/components/uswds/Accordion';
import { TrusteeCaseListFilterViewProps } from './trusteeCaseListFilter.types';
import { getDistrictDivisionComboOptions } from '@/lib/utils/court-utils';
import './TrusteeCaseListFilter.scss';

const FILED_DATE_PILL_VALUE = 'filed-date';

function formatDatePillLabel(prefix: string, from: string, to: string): string {
  const fmt = (value: string) => new Date(value + 'T00:00:00').toLocaleDateString('en-US');
  if (from && to) return `${prefix}: ${fmt(from)} – ${fmt(to)}`;
  if (from) return `${prefix}: from ${fmt(from)}`;
  return `${prefix}: until ${fmt(to)}`;
}

function TrusteeCaseListFilterView({ viewModel }: TrusteeCaseListFilterViewProps) {
  const {
    selectedStatus,
    selectedChapters,
    filedDateFrom,
    filedDateTo,
    filedDateError,
    filterAnnouncement,
    courts,
    selectedDivisions,
  } = viewModel;

  const hasFiledDate = !!(filedDateFrom || filedDateTo);

  const statusPill: ComboOption | null =
    selectedStatus !== 'ALL'
      ? { value: selectedStatus, label: selectedStatus === 'OPEN' ? 'Open' : 'Closed' }
      : null;

  const filedDatePill: ComboOption | null = hasFiledDate
    ? {
        value: FILED_DATE_PILL_VALUE,
        label: formatDatePillLabel('Filed', filedDateFrom, filedDateTo),
      }
    : null;

  const allPills: ComboOption[] = [
    ...(statusPill ? [statusPill] : []),
    ...selectedChapters,
    ...(filedDatePill ? [filedDatePill] : []),
    ...selectedDivisions,
  ];

  return (
    <section className="trustee-case-list-filter" aria-label="Case list filter controls">
      <span
        data-testid="filter-announcement"
        className="screen-reader-only"
        aria-live="polite"
        aria-atomic="true"
      >
        {filterAnnouncement}
      </span>
      <AccordionGroup>
        <Accordion id="case-list-filter">
          <span>Filters</span>
          <div id="case-list-filter-content" className="filter-content">
            <div className="filter-controls-row">
              <div className="filter-control">
                <label htmlFor="filed-date-from" className="usa-label">
                  Case Filed Date Start
                </label>
                <span className="usa-hint">mm/dd/yyyy</span>
                <input
                  id="filed-date-from"
                  type="date"
                  className="usa-input"
                  value={filedDateFrom}
                  onChange={(e) => viewModel.handleFiledDateChange(e.target.value, filedDateTo)}
                  aria-label="Case filed date from"
                  aria-live="off"
                  aria-atomic="false"
                />
              </div>

              <div className="filter-control">
                <label htmlFor="filed-date-to" className="usa-label">
                  Case Filed Date End
                </label>
                <span className="usa-hint">mm/dd/yyyy</span>
                <input
                  id="filed-date-to"
                  type="date"
                  className="usa-input"
                  value={filedDateTo}
                  onChange={(e) => viewModel.handleFiledDateChange(filedDateFrom, e.target.value)}
                  aria-label="Case filed date to"
                  aria-live="off"
                  aria-atomic="false"
                />
              </div>

              <div className="filter-control">
                <label htmlFor="case-status-select" className="usa-label">
                  Case Status
                </label>
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
                  <option value="CLOSED">Closed</option>
                  <option value="OPEN">Open</option>
                </select>
              </div>
            </div>

            {filedDateError && (
              <span className="usa-error-message" role="alert">
                {filedDateError}
              </span>
            )}

            <div className="filter-controls-row">
              <div className="filter-control filter-control--chapter">
                <ComboBox
                  id="case-chapter-combobox"
                  label="Chapter"
                  options={viewModel.chaptersToComboOptions()}
                  selections={selectedChapters}
                  onUpdateSelection={viewModel.handleChapterChange}
                  multiSelect={true}
                  wrapPills={true}
                  pluralLabel="chapters"
                  singularLabel="chapter"
                  placeholder="- Select one or more Chapters -"
                />
              </div>
              {courts.length > 0 && (
                <div className="filter-control filter-control--district">
                  <ComboBox
                    id="case-district-division-combobox"
                    label="District (Division)"
                    options={getDistrictDivisionComboOptions(courts) as ComboOption[]}
                    selections={selectedDivisions}
                    onUpdateSelection={viewModel.handleDivisionChange}
                    multiSelect={true}
                    wrapPills={true}
                    pluralLabel="divisions"
                    singularLabel="division"
                    placeholder="- Select one or more -"
                  />
                </div>
              )}
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
            const updatedValues = new Set(updatedPills.map((p) => p.value));

            const statusRemoved = statusPill && !updatedValues.has(statusPill.value);
            const filedDateRemoved = filedDatePill && !updatedValues.has(FILED_DATE_PILL_VALUE);
            const updatedChapters = selectedChapters.filter((chapter) =>
              updatedValues.has(chapter.value),
            );
            const updatedDivisions = selectedDivisions.filter((div) =>
              updatedValues.has(div.value),
            );

            if (statusRemoved) {
              viewModel.handleStatusChange('ALL');
            }
            if (filedDateRemoved) {
              viewModel.handleFiledDateChange('', '');
            }
            if (updatedChapters.length !== selectedChapters.length) {
              viewModel.handleChapterChange(updatedChapters);
            }
            if (updatedDivisions.length !== selectedDivisions.length) {
              viewModel.handleDivisionChange(updatedDivisions);
            }
          }}
        />
      )}
    </section>
  );
}

export default TrusteeCaseListFilterView;
