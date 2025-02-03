import { Pagination as PaginationModel } from '@common/api/pagination';
import { DEFAULT_SEARCH_LIMIT, DEFAULT_SEARCH_OFFSET, SearchPredicate } from '@common/api/search';
import { PaginationButton } from '@/lib/components/uswds/PaginationButton';
/* eslint-disable @typescript-eslint/no-unused-vars */

export type PaginationProps<P extends SearchPredicate> = {
  paginationValues: PaginationModel;
  searchPredicate: P;
  retrievePage: (searchPredicate: P) => void;
};

export function Pagination<P extends SearchPredicate>({
  paginationValues,
  searchPredicate,
  retrievePage,
}: PaginationProps<P>) {
  const { previous, next, currentPage, totalPages } = paginationValues;
  const lastPage = totalPages ?? 0;
  const elipsesComponent = () => {
    return (
      <li
        className="usa-pagination__item usa-pagination__overflow"
        aria-label="ellipsis indicating non-visible pages"
      >
        <span>…</span>
      </li>
    );
  };
  const currentPageButton = () => {
    return (
      <li className="usa-pagination__item usa-pagination__page-no">
        <PaginationButton id={`page-${currentPage}-results`} isCurrent={true}>
          {currentPage}
        </PaginationButton>
      </li>
    );
  };
  //We always want 7 items. so attempt to render based on that
  function renderAllPagationButtons() {}

  function renderFirstPageButton() {
    return (
      <li className="usa-pagination__item usa-pagination__page-no">
        <PaginationButton
          id={`page-1-results`}
          onClick={() => {
            retrievePage({ ...searchPredicate, offset: DEFAULT_SEARCH_OFFSET });
          }}
        >
          1
        </PaginationButton>
      </li>
    );
  }

  function renderLastPageButton() {
    return (
      <li className="usa-pagination__item usa-pagination__page-no">
        <PaginationButton
          id={`last-page-${lastPage}-results`}
          isCurrent={currentPage === lastPage}
          onClick={() => {
            retrievePage({
              ...searchPredicate,
              offset: (lastPage - 1) * searchPredicate.limit!,
            });
          }}
        >
          {lastPage}
        </PaginationButton>
      </li>
    );
  }
  function renderImmediatePreviousButton() {}
  function renderPreviousPaginationButtons() {
    if (currentPage > 1 && currentPage < 5) {
      const previousPages = currentPage - 1;
      const previousButtons = [];
      for (let i = 0; i < previousPages; i++) {
        previousButtons.push(
          <li className="usa-pagination__item usa-pagination__page-no">
            <PaginationButton
              id={`page-${currentPage - i}-results`}
              onClick={() => {
                retrievePage({
                  ...searchPredicate,
                  offset: searchPredicate.offset! - searchPredicate.limit!,
                });
              }}
            >
              {currentPage - 1}
            </PaginationButton>
          </li>,
        );
      }
    } else if (currentPage >= 5) {
      return <></>;
    } else {
      return <></>;
    }
  }

  function renderNextPaginationButtons() {
    return <></>;
  }
  //TODO: show the seven components within the USWDS model (if 7 components are available)
  return (
    <nav aria-label="Pagination" className="usa-pagination">
      <ul className="usa-pagination__list">
        {previous && (
          <li className="usa-pagination__item usa-pagination__arrow">
            <PaginationButton
              id={'previous-results'}
              onClick={() => {
                retrievePage({
                  ...searchPredicate,
                  offset:
                    (searchPredicate.offset ?? DEFAULT_SEARCH_OFFSET) -
                    (searchPredicate.limit ?? DEFAULT_SEARCH_LIMIT),
                });
              }}
              isPrevious={true}
            />
          </li>
        )}

        {currentPage > 1 && renderFirstPageButton()}
        {currentPage === 4 && (
          <li className="usa-pagination__item usa-pagination__page-no">
            <PaginationButton
              id={`page-2-results`}
              onClick={() => {
                retrievePage({
                  ...searchPredicate,
                  offset: searchPredicate.limit!,
                });
              }}
            >
              2
            </PaginationButton>
          </li>
        )}
        {currentPage > 4 && elipsesComponent()}
        {currentPage > 2 && (
          <li className="usa-pagination__item usa-pagination__page-no">
            <PaginationButton
              id={`page-${currentPage - 1}-results`}
              onClick={() => {
                retrievePage({
                  ...searchPredicate,
                  offset: searchPredicate.offset! - searchPredicate.limit!,
                });
              }}
            >
              {currentPage - 1}
            </PaginationButton>
          </li>
        )}
        {currentPageButton()}
        {next && currentPage < lastPage - 1 && (
          <li className="usa-pagination__item usa-pagination__page-no">
            <PaginationButton
              id={`page-${currentPage + 1}-results`}
              onClick={() => {
                retrievePage({
                  ...searchPredicate,
                  offset: searchPredicate.offset! + searchPredicate.limit!,
                });
              }}
            >
              {currentPage + 1}
            </PaginationButton>
          </li>
        )}
        {next && currentPage < lastPage - 2 && <>{elipsesComponent()}</>}
        {next && <>{renderLastPageButton()}</>}

        {next && (
          <li className="usa-pagination__item usa-pagination__arrow">
            <PaginationButton
              id={'next-results'}
              onClick={() => {
                retrievePage({
                  ...searchPredicate,
                  offset:
                    (searchPredicate.offset ?? DEFAULT_SEARCH_OFFSET) +
                    (searchPredicate.limit ?? DEFAULT_SEARCH_LIMIT),
                });
              }}
              isNext={true}
            />
          </li>
        )}
      </ul>
    </nav>
  );
}
