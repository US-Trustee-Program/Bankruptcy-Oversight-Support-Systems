import { Pagination as PaginationModel } from '@common/api/pagination';
import { DEFAULT_SEARCH_LIMIT, DEFAULT_SEARCH_OFFSET, SearchPredicate } from '@common/api/search';
import { PaginationButton } from '@/lib/components/uswds/PaginationButton';

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

  function renderEllipsis() {
    return (
      <li
        className="usa-pagination__item usa-pagination__overflow"
        aria-label="ellipsis indicating non-visible pages"
      >
        <span>…</span>
      </li>
    );
  }

  function renderPreviousLink() {
    return (
      <li className="usa-pagination__item usa-pagination__arrow">
        <PaginationButton
          id={'previous-results'}
          isPrevious={true}
          onClick={() => {
            retrievePage({
              ...searchPredicate,
              offset:
                (searchPredicate.offset ?? DEFAULT_SEARCH_OFFSET) -
                (searchPredicate.limit ?? DEFAULT_SEARCH_LIMIT),
            });
          }}
        />
      </li>
    );
  }

  function renderNextLink() {
    return (
      <li className="usa-pagination__item usa-pagination__arrow">
        <PaginationButton
          id={'next-results'}
          isNext={true}
          onClick={() => {
            retrievePage({
              ...searchPredicate,
              offset:
                (searchPredicate.offset ?? DEFAULT_SEARCH_OFFSET) +
                (searchPredicate.limit ?? DEFAULT_SEARCH_LIMIT),
            });
          }}
        />
      </li>
    );
  }

  function renderLeftSidePageButton(pageNumber: number, selectedPage: number | boolean) {
    return (
      <li className="usa-pagination__item usa-pagination__page-no">
        <PaginationButton
          id={`page-${pageNumber}-results`}
          isCurrent={selectedPage === pageNumber}
          onClick={() => {
            retrievePage({
              ...searchPredicate,
              offset: searchPredicate.limit! * (pageNumber - 1),
            });
          }}
        >
          {pageNumber}
        </PaginationButton>
      </li>
    );
  }

  function renderRightSidePageButton(countFromEnd: number) {
    return (
      <li className="usa-pagination__item usa-pagination__page-no">
        <PaginationButton
          id={`last-page-${lastPage - countFromEnd}-results`}
          isCurrent={currentPage === lastPage - countFromEnd}
          onClick={() => {
            retrievePage({
              ...searchPredicate,
              offset: (lastPage - countFromEnd - 1) * searchPredicate.limit!,
            });
          }}
        >
          {lastPage - countFromEnd}
        </PaginationButton>
      </li>
    );
  }

  //TODO: show the seven components within the USWDS model (if 7 components are available)
  return (
    <nav aria-label="Pagination" className="usa-pagination">
      <ul className="usa-pagination__list">
        {previous && renderPreviousLink()}
        {currentPage >= 1 && renderLeftSidePageButton(1, currentPage)}
        {currentPage < 5 && (
          <>
            {totalPages! > 1 && renderLeftSidePageButton(2, currentPage)}
            {totalPages! > 2 && renderLeftSidePageButton(3, currentPage)}
            {totalPages! > 3 && renderLeftSidePageButton(4, currentPage)}
            {totalPages! > 4 && renderLeftSidePageButton(5, currentPage)}
          </>
        )}
        {totalPages! > 6 && renderEllipsis()}
        {totalPages! === 6 && (
          <>
            {currentPage === 6 && renderLeftSidePageButton(6, currentPage)}
            {currentPage < 6 && renderRightSidePageButton(6)}
          </>
        )}
        {totalPages! > 5 && currentPage > 4 && currentPage < lastPage - 3 && (
          <>
            {renderLeftSidePageButton(currentPage - 1, false)}
            {renderLeftSidePageButton(currentPage, currentPage)}
            {/* The follow is the odd case. The button is after the current, but we need to use LeftSide. */}
            {renderLeftSidePageButton(currentPage + 1, false)}
            {renderEllipsis()}
          </>
        )}
        {currentPage >= lastPage - 3 && (
          <>
            {renderRightSidePageButton(4)}
            {renderRightSidePageButton(3)}
            {renderRightSidePageButton(2)}
            {renderRightSidePageButton(1)}
          </>
        )}
        {renderRightSidePageButton(0)}
        {next && renderNextLink()}
      </ul>
    </nav>
  );
}
