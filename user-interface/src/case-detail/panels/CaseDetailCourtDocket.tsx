import { useEffect, useRef } from 'react';
import LoadingIndicator from '@/lib/components/LoadingIndicator';
import {
  CaseDocketEntry,
  CaseDocketEntryDocument,
  CaseDocketSummaryFacet,
} from '@/lib/type-declarations/chapter-15';
import { handleHighlight } from '@/lib/utils/highlight-api';
import Icon from '@/lib/components/uswds/Icon';
import Alert, { AlertRefType, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import './CaseDetailCourtDocket.scss';

export type CaseDocketSummaryFacets = Map<string, CaseDocketSummaryFacet>;

export interface CaseDetailCourtDocketProps {
  caseId?: string;
  docketEntries?: CaseDocketEntry[];
  searchString: string;
  hasDocketEntries: boolean;
  isDocketLoading: boolean;
}

export function fileSizeDescription(fileSize: number): string {
  // https://learn.microsoft.com/en-us/style-guide/a-z-word-list-term-collections/term-collections/bits-bytes-terms
  const KB = 1024;
  const MB = 1048576;
  const GB = 1073741824;
  let unit: string = 'bytes';
  let decimalSize: number = fileSize;
  if (fileSize >= GB) {
    decimalSize = fileSize / GB;
    unit = 'GB';
  } else if (fileSize >= MB) {
    decimalSize = fileSize / MB;
    unit = 'MB';
  } else if (fileSize >= KB) {
    decimalSize = fileSize / KB;
    unit = 'KB';
  }
  const sizeString = unit === 'bytes' ? fileSize : (Math.round(decimalSize * 10) / 10).toFixed(1);
  return `${sizeString} ${unit}`;
}

export function generateDocketFilenameDisplay(linkInfo: CaseDocketEntryDocument): string {
  const { fileLabel, fileSize, fileExt } = linkInfo;
  const extension = fileExt ? fileExt?.toUpperCase() + ', ' : '';
  return `View ${fileLabel} [${extension}${fileSizeDescription(fileSize)}]`;
}

export default function CaseDetailCourtDocket(props: CaseDetailCourtDocketProps) {
  const { docketEntries, hasDocketEntries } = props;
  // TODO: Replace use of useEffect for handling loading with useTransition
  const alertRef = useRef<AlertRefType>(null);

  useEffect(() => {
    if (!props.isDocketLoading && !hasDocketEntries) {
      alertRef.current?.show(true);
    }
  }, [docketEntries]);

  useEffect(() => {
    handleHighlight(window, document, 'searchable-docket', props.searchString);
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
                    {docketEntry.dateFiled} - {docketEntry.summaryText}
                  </div>
                  <div
                    className="docket-full-text"
                    data-testid={`docket-entry-${idx}-text`}
                    aria-label="full text of docket entry"
                  >
                    {docketEntry.fullText}
                  </div>
                  {docketEntry.documents && (
                    <div className="docket-documents">
                      <ul
                        className="usa-list usa-list--unstyled"
                        data-testid="document-unordered-list"
                      >
                        {docketEntry.documents.map((linkInfo: CaseDocketEntryDocument) => {
                          return (
                            <li key={linkInfo.fileUri}>
                              <a href={linkInfo.fileUri} target="_blank" rel="noreferrer">
                                {generateDocketFilenameDisplay(linkInfo)}
                                <Icon className="link-icon" name="launch"></Icon>
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
      </div>
      <Alert
        message={
          'We are unable to retrieve court docket entries for this case. Please try again later. If the problem persists, please submit a feedback request describing the issue.'
        }
        type={UswdsAlertStyle.Error}
        role={'status'}
        slim={true}
        ref={alertRef}
        timeout={0}
        title={'Docket Entries Not Available'}
      />{' '}
    </div>
  );
}
