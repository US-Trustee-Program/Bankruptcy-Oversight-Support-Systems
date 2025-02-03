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
        {currentPage > 1 && (
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
        )}
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
        {currentPage > 4 && (
          <li
            className="usa-pagination__item usa-pagination__overflow"
            aria-label="ellipsis indicating non-visible pages"
          >
            <span>…</span>
          </li>
        )}
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
        <li className="usa-pagination__item usa-pagination__page-no">
          <PaginationButton id={`page-${currentPage}-results`} isCurrent={true}>
            {currentPage}
          </PaginationButton>
        </li>
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
        {next && currentPage < lastPage - 2 && (
          <li
            className="usa-pagination__item usa-pagination__overflow"
            aria-label="ellipsis indicating non-visible pages"
          >
            <span>…</span>
          </li>
        )}
        {next && (
          <li className="usa-pagination__item usa-pagination__page-no">
            <PaginationButton
              id={`last-page-${lastPage}-results`}
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
        )}

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
