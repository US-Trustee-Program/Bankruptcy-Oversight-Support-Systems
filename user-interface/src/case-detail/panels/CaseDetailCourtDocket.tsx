import { useEffect, useRef, useState } from 'react';
import DocketEntryDocumentList from '@/lib/components/DocketEntryDocumentList';
import LoadingIndicator from '@/lib/components/LoadingIndicator';
import Alert, { AlertRefType, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { CaseDocketEntry, CaseDocketSummaryFacet } from '@/lib/type-declarations/chapter-15';
import { formatDate } from '@/lib/utils/datetime';
import { handleHighlight } from '@/lib/utils/highlight-api';
import './CaseDetailCourtDocket.scss';

export type CaseDocketSummaryFacets = Map<string, CaseDocketSummaryFacet>;

export interface AlertOptions {
  message: string;
  title: string;
  type: UswdsAlertStyle;
}

export interface CaseDetailCourtDocketProps {
  caseId?: string;
  docketEntries?: CaseDocketEntry[];
  searchString: string;
  hasDocketEntries: boolean;
  isDocketLoading: boolean;
  alertOptions?: AlertOptions;
}

export default function CaseDetailCourtDocket(props: CaseDetailCourtDocketProps) {
  const { docketEntries, hasDocketEntries } = props;
  // TODO: Replace use of useEffect for handling loading with useTransition
  const alertRef = useRef<AlertRefType>(null);

  const [alertOptions, setAlertOptions] = useState<AlertOptions | null>(null);

  const minSearchTextSize = 3;

  useEffect(() => {
    if (!props.isDocketLoading) {
      if (!hasDocketEntries) {
        setAlertOptions({
          message:
            'We are unable to retrieve court docket entries for this case. Please try again later. If the problem persists, please submit a feedback request describing the issue.',
          type: UswdsAlertStyle.Error,
          title: 'Docket Entries Not Available',
        });
        alertRef.current?.show();
      } else if (props.alertOptions) {
        setAlertOptions(props.alertOptions);
        alertRef.current?.show();
      } else {
        alertRef.current?.hide();
        if (props.searchString && props.searchString.length >= minSearchTextSize) {
          try {
            handleHighlight(window, document, 'searchable-docket', props.searchString);
          } catch (e) {
            // TODO CAMS-332 There might not be a need to handle this. May be okay to just ignore.
          }
        }
      }
    }
  }, [docketEntries]);

  useEffect(() => {
    if (props.searchString && props.searchString.length >= minSearchTextSize) {
      try {
        handleHighlight(window, document, 'searchable-docket', props.searchString);
      } catch (e) {
        // TODO CAMS-332 There might not be a need to handle this. May be okay to just ignore.
      }
    }
  }, [props.searchString]);

  return (
    <div id="case-detail-court-docket-panel">
      <div id="searchable-docket" data-testid="searchable-docket">
        {props.isDocketLoading && <LoadingIndicator />}
        {!props.isDocketLoading &&
          hasDocketEntries &&
          docketEntries?.map((docketEntry: CaseDocketEntry, idx: number) => {
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
                    {formatDate(docketEntry.dateFiled)} - {docketEntry.summaryText}
                  </div>
                  <div
                    className="docket-full-text"
                    data-testid={`docket-entry-${idx}-text`}
                    aria-label="full text of docket entry"
                  >
                    {docketEntry.fullText}
                  </div>
                  {docketEntry.documents && (
                    <DocketEntryDocumentList documents={docketEntry.documents} />
                  )}
                </div>
              </div>
            );
          })}
      </div>
      <Alert
        message={alertOptions?.message || ''}
        type={alertOptions?.type || UswdsAlertStyle.Error}
        role={'status'}
        slim={true}
        ref={alertRef}
        timeout={0}
        title={alertOptions?.title || ''}
        inline={true}
      />
    </div>
  );
}
