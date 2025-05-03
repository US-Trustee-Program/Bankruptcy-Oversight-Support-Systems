import DocketEntryDocumentList from '@/lib/components/DocketEntryDocumentList';
import LoadingIndicator from '@/lib/components/LoadingIndicator';
import Alert, { AlertRefType, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { formatDate } from '@/lib/utils/datetime';
import { handleHighlight } from '@/lib/utils/highlight-api';
import { CaseDocketEntry } from '@common/cams/cases';

import './CaseDetailCourtDocket.scss';

import { useEffect, useRef, useState } from 'react';

export interface AlertOptions {
  message: string;
  title: string;
  type: UswdsAlertStyle;
}

export interface CaseDetailCourtDocketProps {
  alertOptions?: AlertOptions;
  caseId?: string;
  docketEntries?: CaseDocketEntry[];
  hasDocketEntries: boolean;
  isDocketLoading: boolean;
  searchString: string;
}

export type CaseDocketSummaryFacets = Map<string, CaseDocketSummaryFacet>;

type CaseDocketSummaryFacet = {
  count: number;
  text: string;
};

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
          title: 'Docket Entries Not Available',
          type: UswdsAlertStyle.Error,
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
      <h3 aria-label="Docket Entries" className="docket-entries-main-header">
        Docket Entries
      </h3>
      <ol data-testid="searchable-docket" id="searchable-docket">
        {props.isDocketLoading && <LoadingIndicator />}
        {!props.isDocketLoading &&
          hasDocketEntries &&
          docketEntries?.map((docketEntry: CaseDocketEntry, idx: number) => {
            return (
              <li
                className="docket-entry grid-container"
                data-testid={`docket-entry-${idx}`}
                key={idx}
              >
                <div className="grid-row">
                  <div
                    aria-label={
                      docketEntry.documentNumber
                        ? `Docket Number ${docketEntry.documentNumber}`
                        : undefined
                    }
                    className="grid-col-1 document-number-column"
                  >
                    {docketEntry.documentNumber}
                  </div>
                  <div className="grid-col-11">
                    <h4
                      aria-label={`Filed on ${docketEntry.dateFiled} - ${docketEntry.summaryText}`}
                      className="docket-entry-header usa-tooltip"
                      data-testid={`docket-entry-${idx}-header`}
                      title={`Document number ${docketEntry.documentNumber} filed on ${docketEntry.dateFiled} - ${docketEntry.summaryText}`}
                    >
                      {printDocketHeader(docketEntry)}
                    </h4>
                  </div>
                </div>
                <div className="grid-row">
                  <div className="grid-col-1"></div>
                  <div className="grid-col-11 docket-content">
                    <div
                      aria-label="full text of docket entry"
                      className="docket-full-text"
                      data-testid={`docket-entry-${idx}-text`}
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
        inline={true}
        message={alertOptions?.message || ''}
        ref={alertRef}
        role={'status'}
        timeout={0}
        title={alertOptions?.title || ''}
        type={alertOptions?.type || UswdsAlertStyle.Error}
      />
    </div>
  );
}
