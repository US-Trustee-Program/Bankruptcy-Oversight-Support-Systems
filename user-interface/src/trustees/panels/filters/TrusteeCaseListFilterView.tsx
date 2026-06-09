import ComboBox, { ComboOption } from '@/lib/components/combobox/ComboBox';
import PillBox from '@/lib/components/PillBox';
import { Accordion, AccordionGroup } from '@/lib/components/uswds/Accordion';
import { TrusteeCaseListFilterViewProps } from './trusteeCaseListFilter.types';

function formatDatePillLabel(prefix: string, from: string, to: string): string {
  const fmt = (d: string) => {
    const [y, m, day] = d.split('-');
    return `${m}/${day}/${y}`;
  };
  if (from && to) return `${prefix}: ${fmt(from)} – ${fmt(to)}`;
  if (from) return `${prefix}: from ${fmt(from)}`;
  return `${prefix}: until ${fmt(to)}`;
}

function TrusteeCaseListFilterView({ viewModel }: TrusteeCaseListFilterViewProps) {
  const {
    selectedStatus,
    selectedChapters,
    chapterFilterRef,
    filedDateFrom,
    filedDateTo,
    appointedDateFrom,
    appointedDateTo,
    filedDateError,
    appointedDateError,
  } = viewModel;

  const hasFiledDate = !!(filedDateFrom || filedDateTo);
  const hasAppointedDate = !!(appointedDateFrom || appointedDateTo);

  const isFiltered =
    selectedStatus !== 'ALL' || selectedChapters.length > 0 || hasFiledDate || hasAppointedDate;

  const statusPill: ComboOption | null =
    selectedStatus !== 'ALL'
      ? { value: selectedStatus, label: selectedStatus === 'OPEN' ? 'Open' : 'Closed' }
      : null;

  const filedDatePill: ComboOption | null = hasFiledDate
    ? {
        value: 'filed-date',
        label: formatDatePillLabel('Filed', filedDateFrom, filedDateTo),
      }
    : null;

  const appointedDatePill: ComboOption | null = hasAppointedDate
    ? {
        value: 'appointed-date',
        label: formatDatePillLabel('Appointed', appointedDateFrom, appointedDateTo),
      }
    : null;

  const allPills: ComboOption[] = [
    ...(statusPill ? [statusPill] : []),
    ...selectedChapters,
    ...(filedDatePill ? [filedDatePill] : []),
    ...(appointedDatePill ? [appointedDatePill] : []),
  ];

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

            <div className="filter-controls-row filter-controls-row--dates">
              <div className="filter-control filter-control--date-range">
                <div className="filter-control-header">
                  <span className="filter-control-label">Case Filed Date</span>
                </div>
                <div className="date-range-inputs">
                  <label htmlFor="filed-date-from" className="usa-label">
                    From
                  </label>
                  <input
                    id="filed-date-from"
                    type="date"
                    className="usa-input"
                    value={filedDateFrom}
                    onChange={(e) => viewModel.handleFiledDateChange(e.target.value, filedDateTo)}
                    aria-label="Case filed date from"
                  />
                  <label htmlFor="filed-date-to" className="usa-label">
                    To
                  </label>
                  <input
                    id="filed-date-to"
                    type="date"
                    className="usa-input"
                    value={filedDateTo}
                    onChange={(e) => viewModel.handleFiledDateChange(filedDateFrom, e.target.value)}
                    aria-label="Case filed date to"
                  />
                </div>
                {filedDateError && (
                  <span className="usa-error-message" role="alert">
                    {filedDateError}
                  </span>
                )}
              </div>

              <div className="filter-control filter-control--date-range">
                <div className="filter-control-header">
                  <span className="filter-control-label">Trustee Appointed Date</span>
                </div>
                <div className="date-range-inputs">
                  <label htmlFor="appointed-date-from" className="usa-label">
                    From
                  </label>
                  <input
                    id="appointed-date-from"
                    type="date"
                    className="usa-input"
                    value={appointedDateFrom}
                    onChange={(e) =>
                      viewModel.handleAppointedDateChange(e.target.value, appointedDateTo)
                    }
                    aria-label="Trustee appointed date from"
                  />
                  <label htmlFor="appointed-date-to" className="usa-label">
                    To
                  </label>
                  <input
                    id="appointed-date-to"
                    type="date"
                    className="usa-input"
                    value={appointedDateTo}
                    onChange={(e) =>
                      viewModel.handleAppointedDateChange(appointedDateFrom, e.target.value)
                    }
                    aria-label="Trustee appointed date to"
                  />
                </div>
                {appointedDateError && (
                  <span className="usa-error-message" role="alert">
                    {appointedDateError}
                  </span>
                )}
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
            const filedDateRemoved =
              filedDatePill && !updatedPills.find((p) => p.value === 'filed-date');
            const appointedDateRemoved =
              appointedDatePill && !updatedPills.find((p) => p.value === 'appointed-date');
            const updatedChapters = updatedPills.filter(
              (p) =>
                p.value !== selectedStatus &&
                p.value !== 'filed-date' &&
                p.value !== 'appointed-date',
            );

            if (statusRemoved) {
              viewModel.handleStatusChange('ALL');
            }
            if (filedDateRemoved) {
              viewModel.handleFiledDateChange('', '');
            }
            if (appointedDateRemoved) {
              viewModel.handleAppointedDateChange('', '');
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
