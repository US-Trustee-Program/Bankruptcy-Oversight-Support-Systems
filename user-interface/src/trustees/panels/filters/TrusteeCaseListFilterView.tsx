import ComboBox, { ComboOption } from '@/lib/components/combobox/ComboBox';
import PillBox from '@/lib/components/PillBox';
import { Accordion, AccordionGroup } from '@/lib/components/uswds/Accordion';
import { TrusteeCaseListFilterViewProps } from './trusteeCaseListFilter.types';
import './TrusteeCaseListFilter.scss';

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
            {/* Row 1: Case Filed Date Start | Case Filed Date End | Case Status */}
            <div className="filter-controls-row">
              <div className="filter-control">
                <label htmlFor="filed-date-from" className="usa-label">
                  Case Filed Date Start
                </label>
                <input
                  id="filed-date-from"
                  type="date"
                  className="usa-input"
                  value={filedDateFrom}
                  onChange={(e) => viewModel.handleFiledDateChange(e.target.value, filedDateTo)}
                  aria-label="Case filed date from"
                />
              </div>

              <div className="filter-control">
                <label htmlFor="filed-date-to" className="usa-label">
                  Case Filed Date End
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
                  <option value="ALL">- Select -</option>
                  <option value="OPEN">Open</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>
            </div>

            {filedDateError && (
              <span className="usa-error-message" role="alert">
                {filedDateError}
              </span>
            )}

            {/* Row 2: Appt. Date Start | Appt. Date End */}
            <div className="filter-controls-row">
              <div className="filter-control">
                <label htmlFor="appointed-date-from" className="usa-label">
                  Trustee Appointed Date Start
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
              </div>

              <div className="filter-control">
                <label htmlFor="appointed-date-to" className="usa-label">
                  Trustee Appointed Date End
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
            </div>

            {appointedDateError && (
              <span className="usa-error-message" role="alert">
                {appointedDateError}
              </span>
            )}

            {/* Row 3: Chapter with Clear link */}
            <div className="filter-controls-row">
              <div className="filter-control filter-control--chapter">
                <div className="filter-control-header">
                  <span className="filter-control-label">Chapter</span>
                  <button
                    type="button"
                    className="filter-clear-link"
                    onClick={viewModel.handleClearAll}
                    aria-label="Clear all case list filters"
                    style={{ visibility: isFiltered ? 'visible' : 'hidden' }}
                    disabled={!isFiltered}
                  >
                    Clear
                  </button>
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
                  placeholder="- Select one or more Chapters -"
                  ref={chapterFilterRef}
                />
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
