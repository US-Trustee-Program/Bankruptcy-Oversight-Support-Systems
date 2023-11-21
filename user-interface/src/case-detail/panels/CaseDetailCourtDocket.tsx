import { useEffect, useState } from 'react';
import IconInput from '@/lib/components/IconInput';
import LoadingIndicator from '@/lib/components/LoadingIndicator';
import { CaseDocketEntry } from '@/lib/type-declarations/chapter-15';
import useFeatureFlags, { DOCKET_SEARCH_ENABLED } from '@/lib/hooks/UseFeatureFlags';
import './CaseDetailCourtDocket.scss';

export interface CaseDetailCourtDocketProps {
  caseId: string | undefined;
  docketEntries?: CaseDocketEntry[];
}

export default function CaseDetailCourtDocket(props: CaseDetailCourtDocketProps) {
  const { docketEntries } = props;
  // TODO: Replace with useTransition
  const [isLoading, setIsLoading] = useState(true);
  const [searchString, setSearchString] = useState('');
  const [filteredDocketEntries, setFilteredDocketEntries] = useState(docketEntries);

  const flags = useFeatureFlags();
  const searchFeature = flags[DOCKET_SEARCH_ENABLED];

  function docketSearchFilter(docketEntry: CaseDocketEntry) {
    return (
      docketEntry.summaryText.toLowerCase().includes(searchString) ||
      docketEntry.fullText.toLowerCase().includes(searchString)
    );
  }

  function search(ev: React.ChangeEvent<HTMLInputElement>) {
    const searchString = ev.target.value.toLowerCase();
    setSearchString(searchString || '');
    setFilteredDocketEntries(docketEntries?.filter(docketSearchFilter));
  }

  useEffect(() => {
    setIsLoading(!docketEntries);
  }, [docketEntries]);

  useEffect(() => {
    // TODO: Need to find type declaration for the browser window and replace this adhoc type def.
    const browserApi = window as unknown as {
      CSS: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        highlights?: any;
      };
    };
    if (browserApi.CSS.highlights) {
      console.log('Highlight API is supported.');
      if (!searchString || searchString.length === 0) {
        browserApi.CSS.highlights.clear();
        return;
      }
      // TODO: Don't like having to get by the entire class name.... Find a better way.
      const docketNode = document.getElementById('searchable-docket');
      if (docketNode) {
        const treeWalker = document.createTreeWalker(docketNode, NodeFilter.SHOW_TEXT);
        const allTextNodes = [];
        let currentNode = treeWalker.nextNode();
        while (currentNode) {
          allTextNodes.push(currentNode);
          currentNode = treeWalker.nextNode();
        }

        const ranges = allTextNodes
          .map((el) => {
            return { el, text: el.textContent?.toLowerCase() || '' };
          })
          .map(({ text, el }) => {
            const indices = [];
            let startPos = 0;
            while (startPos < text.length) {
              const index = text.indexOf(searchString, startPos);
              if (index === -1) break;
              indices.push(index);
              startPos = index + searchString.length;
            }

            // Create a range object for each instance of
            // str we found in the text node.
            return indices.map((index) => {
              const range = new Range();
              range.setStart(el, index);
              range.setEnd(el, index + searchString.length);
              return range;
            });
          });

        console.log('ranges', ranges);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const searchResultsHighlight = new Highlight(...ranges.flat());
        browserApi.CSS.highlights.set('search-results', searchResultsHighlight);
      }
    } else {
      console.log('Highlight API is not supported.');
    }
  }, [filteredDocketEntries]);

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
                    onChange={search}
                  />
                </div>
              </section>
            </div>
          </div>
        </form>
      )}
      <div id="searchable-docket">
        {isLoading && <LoadingIndicator />}
        {!isLoading &&
          filteredDocketEntries &&
          filteredDocketEntries.map((docketEntry: CaseDocketEntry, idx: number) => {
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
