import { useEffect, useRef, useState } from 'react';
import DocketEntryDocumentList from '@/lib/components/DocketEntryDocumentList';
import LoadingIndicator from '@/lib/components/LoadingIndicator';
import Alert, { AlertRefType, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { formatDate } from '@/lib/utils/datetime';
import { handleHighlight } from '@/lib/utils/highlight-api';
import './CaseDetailCourtDocket.scss';
import { CaseDocketEntry } from '@common/cams/cases';

type CaseDocketSummaryFacet = {
  text: string;
  count: number;
};

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

  const MINIMUM_SEARCH_CHARACTERS = 3;

  function printDocketHeader(docket: CaseDocketEntry) {
    const outputString = `${formatDate(docket.dateFiled)} - ${docket.summaryText}`;
    return outputString;
  }

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
        handleHighlight(
          window,
          document,
          'searchable-docket',
          props.searchString,
          MINIMUM_SEARCH_CHARACTERS,
        );
      }
    }
  }, [docketEntries]);

  useEffect(() => {
    handleHighlight(
      window,
      document,
      'searchable-docket',
      props.searchString,
      MINIMUM_SEARCH_CHARACTERS,
    );
  }, [props.searchString]);

  return (
    <div id="case-detail-court-docket-panel">
      <h3 className="docket-entries-main-header" aria-label="Docket Entries">
        Docket Entries
      </h3>
      <ol id="searchable-docket" data-testid="searchable-docket">
        {props.isDocketLoading && <LoadingIndicator />}
        {!props.isDocketLoading &&
          hasDocketEntries &&
          docketEntries?.map((docketEntry: CaseDocketEntry, idx: number) => {
            return (
              <li
                className="docket-entry grid-container"
                key={idx}
                data-testid={`docket-entry-${idx}`}
              >
                <div className="grid-row">
                  <div
                    className="grid-col-1 document-number-column"
                    aria-label={`Docket Number ${docketEntry.documentNumber}`}
                  >
                    {docketEntry.documentNumber}
                  </div>
                  <div className="grid-col-11">
                    <h4
                      className="docket-entry-header usa-tooltip"
                      data-testid={`docket-entry-${idx}-header`}
                      title={`Document number ${docketEntry.documentNumber} filed on ${docketEntry.dateFiled} - ${docketEntry.summaryText}`}
                      aria-label={`Filed on ${docketEntry.dateFiled} - ${docketEntry.summaryText}`}
                    >
                      {printDocketHeader(docketEntry)}
                    </h4>
                  </div>
                </div>
                <div className="grid-row">
                  <div className="grid-col-1"></div>
                  <div className="grid-col-11 docket-content">
                    <div
                      className="docket-full-text"
                      data-testid={`docket-entry-${idx}-text`}
                      aria-label="full text of docket entry"
                    >
                      {docketEntry.fullText}
                    </div>
                    {docketEntry.documents && <DocketEntryDocumentList docketEntry={docketEntry} />}
                  </div>
                </div>
              </li>
            );
          })}
      </ol>
      <Alert
        message={alertOptions?.message || ''}
        type={alertOptions?.type || UswdsAlertStyle.Error}
        role={'status'}
        ref={alertRef}
        timeout={0}
        title={alertOptions?.title || ''}
        inline={true}
      />
    </div>
  );
}
