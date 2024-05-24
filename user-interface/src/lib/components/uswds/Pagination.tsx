import { PaginationButton } from '@/lib/components/uswds/PaginationButton';
import { WithPagination } from '@common/api/pagination';
import { CasesSearchPredicate } from '@common/api/search';
import { DEFAULT_SEARCH_LIMIT } from '@common/cams/cases';

export type PaginationProps = {
  paginationMeta: WithPagination;
  searchPredicate: CasesSearchPredicate;
  retrievePage: (searchPredicate: CasesSearchPredicate) => void;
};

export const Pagination = ({ paginationMeta, searchPredicate, retrievePage }: PaginationProps) => {
  const { previous, next, currentPage } = paginationMeta;

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
                    (searchPredicate.offset ?? 0) - (searchPredicate.limit ?? DEFAULT_SEARCH_LIMIT),
                });
                // search(previous);
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
                retrievePage({ ...searchPredicate, offset: 0 });
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
          <PaginationButton
            id={`page-${currentPage}-results`}
            onClick={() => {
              retrievePage({ ...searchPredicate });
            }}
            isCurrent={true}
          >
            {currentPage}
          </PaginationButton>
        </li>
        {next && (
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
        {next && (
          <li
            className="usa-pagination__item usa-pagination__overflow"
            aria-label="ellipsis indicating non-visible pages"
          >
            <span>…</span>
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
                    (searchPredicate.offset ?? 0) + (searchPredicate.limit ?? DEFAULT_SEARCH_LIMIT),
                });
                // search(next);
              }}
              isNext={true}
            />
          </li>
        )}
      </ul>
    </nav>
  );
};
