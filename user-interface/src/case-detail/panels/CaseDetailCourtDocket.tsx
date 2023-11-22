import { useEffect, useState } from 'react';
import IconInput from '@/lib/components/IconInput';
import LoadingIndicator from '@/lib/components/LoadingIndicator';
import { CaseDocketEntry } from '@/lib/type-declarations/chapter-15';
import useFeatureFlags, { DOCKET_SEARCH_ENABLED } from '@/lib/hooks/UseFeatureFlags';
import './CaseDetailCourtDocket.scss';
import { handleHighlight } from '@/lib/utils/highlight-api';
import Icon from '@/lib/components/uswds/Icon';

export interface CaseDetailCourtDocketProps {
  caseId?: string;
  docketEntries?: CaseDocketEntry[];
}

type SortDirection = 'Oldest' | 'Newest';

export default function CaseDetailCourtDocket(props: CaseDetailCourtDocketProps) {
  const { docketEntries } = props;
  // TODO: Replace use of useEffect for handling loading with useTransition
  const [isLoading, setIsLoading] = useState(true);
  const [searchString, setSearchString] = useState('');
  const [sortDirection, setSortDirection] = useState<SortDirection>('Newest');

  const flags = useFeatureFlags();
  const searchFeature = flags[DOCKET_SEARCH_ENABLED];

  function docketSearchFilter(docketEntry: CaseDocketEntry) {
    return (
      docketEntry.summaryText.toLowerCase().includes(searchString) ||
      docketEntry.fullText.toLowerCase().includes(searchString)
    );
  }

  function docketSorter(left: CaseDocketEntry, right: CaseDocketEntry) {
    const direction = sortDirection === 'Newest' ? 1 : -1;
    return left.sequenceNumber < right.sequenceNumber ? direction : direction * -1;
  }

  function toggleSort() {
    setSortDirection(sortDirection === 'Newest' ? 'Oldest' : 'Newest');
  }

  function search(ev: React.ChangeEvent<HTMLInputElement>) {
    const searchString = ev.target.value.toLowerCase();
    setSearchString(searchString);
  }

  useEffect(() => {
    setIsLoading(!docketEntries);
  }, [docketEntries]);

  useEffect(() => {
    handleHighlight(window, document, 'searchable-docket', searchString);
  }, [searchString, sortDirection]);

  return (
    <div id="case-detail-court-docket-panel">
      {searchFeature && (
        <div className="filter-and-search padding-y-4 grid-row">
          <div className="grid-col-8" data-testid="docket-entry-search">
            <section aria-label="Small search component">
              <div className="usa-search usa-search--small">
                <label className="" htmlFor="basic-search-field">
                  Find in Docket
                </label>
                <IconInput
                  className="search-icon"
                  id="basic-search-field"
                  name="basic-search"
                  icon="search"
                  autocomplete="off"
                  onChange={search}
                />
              </div>
            </section>
          </div>
          <div className="sort grid-col-4">
            <section aria-label="Small sort component">
              <div className="usa-sort usa-sort--small">
                <button
                  className="usa-button usa-button--outline sort-button"
                  id="basic-sort-button"
                  name="basic-sort"
                  onClick={toggleSort}
                  data-testid="docket-entry-sort"
                >
                  <div>
                    Sort ({sortDirection})
                    <Icon
                      className="sort-button-icon"
                      name={sortDirection === 'Newest' ? 'arrow_upward' : 'arrow_downward'}
                    />
                  </div>
                </button>
              </div>
            </section>
          </div>
        </div>
      )}
      <div id="searchable-docket" data-testid="searchable-docket">
        {isLoading && <LoadingIndicator />}
        {!isLoading &&
          docketEntries &&
          docketEntries
            .filter(docketSearchFilter)
            .sort(docketSorter)
            .map((docketEntry: CaseDocketEntry, idx: number) => {
              return (
                <div
                  className="grid-row grid-gap-lg docket-entry"
                  key={idx}
                  data-testid={`docket-entry-${idx}`}
                >
                  <div
                    className="grid-col-1 document-number-column usa-tooltip"
                    data-testid={`docket-entry-${idx}-number`}
                    aria-label="document number"
                    title={`Document number ${docketEntry.documentNumber}`}
                  >
                    {docketEntry.documentNumber ? <h3>{docketEntry.documentNumber}</h3> : ''}
                  </div>
                  <div className="grid-col-11 docket-content">
                    <div
                      className="docket-entry-header"
                      aria-label="date filed and summary text for the docket entry"
                      data-testid={`docket-entry-${idx}-header`}
                    >
                      {docketEntry.dateFiled} - {docketEntry.summaryText}
                    </div>
                    <div
                      data-testid={`docket-entry-${idx}-text`}
                      aria-label="full text of docket entry"
                    >
                      {docketEntry.fullText}
                    </div>
                  </div>
                </div>
              );
            })}
      </div>
    </div>
  );
}
