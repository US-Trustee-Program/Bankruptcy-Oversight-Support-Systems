import { useEffect, useRef, useState } from 'react';
import IconInput from '@/lib/components/IconInput';
import LoadingIndicator from '@/lib/components/LoadingIndicator';
import {
  CaseDocketEntry,
  CaseDocketEntryDocument,
  CaseDocketSummaryFacet,
} from '@/lib/type-declarations/chapter-15';
import useFeatureFlags, { DOCKET_SEARCH_ENABLED } from '@/lib/hooks/UseFeatureFlags';
import { handleHighlight } from '@/lib/utils/highlight-api';
import Icon from '@/lib/components/uswds/Icon';
import Alert, { AlertRefType, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import './CaseDetailCourtDocket.scss';

export type CaseDocketSummaryFacets = Map<string, CaseDocketSummaryFacet>;

export interface CaseDetailCourtDocketProps {
  caseId?: string;
  docketEntries?: CaseDocketEntry[];
  facets?: string[];
}

type SortDirection = 'Oldest' | 'Newest';

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

export function docketSorterClosure(sortDirection: SortDirection) {
  return (left: CaseDocketEntry, right: CaseDocketEntry) => {
    const direction = sortDirection === 'Newest' ? 1 : -1;
    return left.sequenceNumber < right.sequenceNumber ? direction : direction * -1;
  };
}

export default function CaseDetailCourtDocket(props: CaseDetailCourtDocketProps) {
  const { docketEntries } = props;
  // TODO: Replace use of useEffect for handling loading with useTransition
  const [isLoading, setIsLoading] = useState(true);
  const [searchString, setSearchString] = useState('');
  const [sortDirection, setSortDirection] = useState<SortDirection>('Newest');
  const alertRef = useRef<AlertRefType>(null);

  const flags = useFeatureFlags();
  const searchFeature = flags[DOCKET_SEARCH_ENABLED];
  const facets: string[] = props.facets || [];

  function docketSearchFilter(docketEntry: CaseDocketEntry) {
    return (
      docketEntry.summaryText.toLowerCase().includes(searchString) ||
      docketEntry.fullText.toLowerCase().includes(searchString)
    );
  }

  function facetFilter(docketEntry: CaseDocketEntry) {
    if (facets.length === 0) return docketEntry;
    return facets.includes(docketEntry.summaryText);
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
    if (!hasDocketEntries) {
      alertRef.current?.show(true);
    }
  }, [docketEntries]);

  useEffect(() => {
    handleHighlight(window, document, 'searchable-docket', searchString);
  }, [searchString, sortDirection]);

  const hasDocketEntries = docketEntries && !!docketEntries.length;

  return (
    <div id="case-detail-court-docket-panel">
      {hasDocketEntries && searchFeature && (
        <div className="filter-and-search padding-y-4 grid-row">
          <div className="grid-col-8" data-testid="docket-entry-search">
            <div className="usa-search usa-search--small">
              <label htmlFor="basic-search-field">Find in Docket</label>
              <IconInput
                className="search-icon"
                id="basic-search-field"
                name="basic-search"
                icon="search"
                autocomplete="off"
                onChange={search}
              />
            </div>
          </div>
          <div className="sort grid-col-4">
            <div className="usa-sort usa-sort--small">
              <button
                className="usa-button usa-button--outline sort-button"
                id="basic-sort-button"
                name="basic-sort"
                onClick={toggleSort}
                data-testid="docket-entry-sort"
                aria-label={'Sort ' + sortDirection + ' First'}
              >
                <div aria-hidden="true">
                  <span aria-hidden="true">Sort ({sortDirection})</span>
                  <Icon
                    className="sort-button-icon"
                    name={sortDirection === 'Newest' ? 'arrow_upward' : 'arrow_downward'}
                  />
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
      <div id="searchable-docket" data-testid="searchable-docket">
        {isLoading && <LoadingIndicator />}
        {!isLoading &&
          hasDocketEntries &&
          docketEntries
            .filter(docketSearchFilter)
            .filter(facetFilter)
            .sort(docketSorterClosure(sortDirection))
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
