import IconInput from '@/lib/components/IconInput';
import './CaseDetailCourtDocket.scss';
import LoadingIndicator from '@/lib/components/LoadingIndicator';
import { CaseDocketEntry } from '@/lib/type-declarations/chapter-15';
import { useEffect, useState } from 'react';
import useFeatureFlags, { DOCKET_SEARCH_ENABLED } from '@/lib/hooks/UseFeatureFlags';

export interface CaseDetailCourtDocketProps {
  caseId: string | undefined;
  docketEntries?: CaseDocketEntry[];
}

export default function CaseDetailCourtDocket(props: CaseDetailCourtDocketProps) {
  const { docketEntries } = props;
  const [isLoading, setIsLoading] = useState(true);
  const flags = useFeatureFlags();
  const searchFeature = flags[DOCKET_SEARCH_ENABLED];

  useEffect(() => {
    setIsLoading(!docketEntries);
  }, [docketEntries]);

  return (
    <div id="case-detail-court-docket-panel">
      {searchFeature && (
        <form className="filter-and-search padding-y-4" role="search">
          <div className="grid-row">
            <div className="grid-col-12" data-testid="docket-entry-search">
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
                  />
                </div>
              </section>
            </div>
          </div>
        </form>
      )}
      {isLoading && <LoadingIndicator />}
      {!isLoading &&
        docketEntries &&
        (docketEntries as Array<CaseDocketEntry>)?.map(
          (docketEntry: CaseDocketEntry, idx: number) => {
            return (
              <div
                className="grid-row grid-gap-lg docket-entry"
                key={idx}
                data-testid={`docket-entry-${idx}`}
              >
                <div
                  className="grid-col-1 document-number-column"
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
          },
        )}
    </div>
  );
}
