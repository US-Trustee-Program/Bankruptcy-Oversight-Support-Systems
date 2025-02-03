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
  //TODO: show the seven components within the USWDS model (if 7 components are available)
  return (
    <nav aria-label="Pagination" className="usa-pagination">
      <ul className="usa-pagination__list">
        {previous && (
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
        )}
        {currentPage >= 1 && (
          <li className="usa-pagination__item usa-pagination__page-no selected-page">
            <PaginationButton
              id={`page-1-results`}
              isCurrent={currentPage === 1}
              onClick={() => {
                retrievePage({ ...searchPredicate, offset: DEFAULT_SEARCH_OFFSET });
              }}
            >
              1
            </PaginationButton>
          </li>
        )}
        {currentPage < 5 && (
          <>
            {totalPages! > 1 && (
              <li className="usa-pagination__item usa-pagination__page-no unselected-page">
                <PaginationButton
                  id={`page-2-results`}
                  isCurrent={currentPage === 2}
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
            {totalPages! > 2 && (
              <li className="usa-pagination__item usa-pagination__page-no unselected-page">
                <PaginationButton
                  id={`page-3-results`}
                  isCurrent={currentPage === 3}
                  onClick={() => {
                    retrievePage({
                      ...searchPredicate,
                      offset: searchPredicate.limit! * 2,
                    });
                  }}
                >
                  3
                </PaginationButton>
              </li>
            )}
            {totalPages! > 3 && (
              <li className="usa-pagination__item usa-pagination__page-no unselected-page">
                <PaginationButton
                  id={`page-4-results`}
                  isCurrent={currentPage === 4}
                  onClick={() => {
                    retrievePage({
                      ...searchPredicate,
                      offset: searchPredicate.limit! * 3,
                    });
                  }}
                >
                  4
                </PaginationButton>
              </li>
            )}
            {totalPages! > 4 && (
              <li className="usa-pagination__item usa-pagination__page-no unselected-page">
                <PaginationButton
                  id={`page-5-results`}
                  isCurrent={currentPage === 5}
                  onClick={() => {
                    retrievePage({
                      ...searchPredicate,
                      offset: searchPredicate.limit! * 4,
                    });
                  }}
                >
                  5
                </PaginationButton>
              </li>
            )}
          </>
        )}
        {totalPages! > 6 && (
          <li
            className="usa-pagination__item usa-pagination__overflow"
            aria-label="ellipsis indicating non-visible pages"
          >
            <span>…</span>
          </li>
        )}
        {totalPages! === 6 && (
          <li className="usa-pagination__item usa-pagination__page-no unselected-page">
            <PaginationButton
              id={`page-6-results`}
              isCurrent={currentPage === 6}
              onClick={() => {
                retrievePage({
                  ...searchPredicate,
                  offset: searchPredicate.limit! * 5,
                });
              }}
            >
              6
            </PaginationButton>
          </li>
        )}
        {totalPages! > 5 && currentPage > 4 && currentPage < lastPage - 3 && (
          <>
            <li className="usa-pagination__item usa-pagination__page-no">
              <PaginationButton
                id={`page-${currentPage - 1}-results`}
                onClick={() => {
                  retrievePage({
                    ...searchPredicate,
                    offset: searchPredicate.limit! * (currentPage - 2),
                  });
                }}
              >
                {currentPage - 1}
              </PaginationButton>
            </li>
            <li className="usa-pagination__item usa-pagination__page-no">
              <PaginationButton
                id={`page-${currentPage}-results`}
                isCurrent={true}
                onClick={() => {
                  retrievePage({
                    ...searchPredicate,
                    offset: searchPredicate.limit! * (currentPage - 1),
                  });
                }}
              >
                {currentPage}
              </PaginationButton>
            </li>
            {totalPages! > currentPage && (
              <li className="usa-pagination__item usa-pagination__page-no">
                <PaginationButton
                  id={`page-${currentPage + 1}-results`}
                  onClick={() => {
                    retrievePage({
                      ...searchPredicate,
                      offset: searchPredicate.limit! * currentPage,
                    });
                  }}
                >
                  {currentPage + 1}
                </PaginationButton>
              </li>
            )}
            <li
              className="usa-pagination__item usa-pagination__overflow"
              aria-label="ellipsis indicating non-visible pages"
            >
              <span>…</span>
            </li>
          </>
        )}
        {currentPage >= lastPage - 3 && (
          <>
            <li className="usa-pagination__item usa-pagination__page-no">
              <PaginationButton
                id={`last-page-${lastPage - 4}-results`}
                isCurrent={false}
                onClick={() => {
                  retrievePage({
                    ...searchPredicate,
                    offset: (lastPage - 5) * searchPredicate.limit!,
                  });
                }}
              >
                {lastPage - 4}
              </PaginationButton>
            </li>
            <li className="usa-pagination__item usa-pagination__page-no">
              <PaginationButton
                id={`last-page-${currentPage - 3}-results`}
                isCurrent={currentPage === lastPage - 3}
                onClick={() => {
                  retrievePage({
                    ...searchPredicate,
                    offset: (lastPage - 4) * searchPredicate.limit!,
                  });
                }}
              >
                {lastPage - 3}
              </PaginationButton>
            </li>
            <li className="usa-pagination__item usa-pagination__page-no">
              <PaginationButton
                id={`last-page-${currentPage - 2}-results`}
                isCurrent={currentPage === lastPage - 2}
                onClick={() => {
                  retrievePage({
                    ...searchPredicate,
                    offset: (lastPage - 3) * searchPredicate.limit!,
                  });
                }}
              >
                {lastPage - 2}
              </PaginationButton>
            </li>
            <li className="usa-pagination__item usa-pagination__page-no">
              <PaginationButton
                id={`last-page-${currentPage - 1}-results`}
                isCurrent={currentPage === lastPage - 1}
                onClick={() => {
                  retrievePage({
                    ...searchPredicate,
                    offset: (lastPage - 2) * searchPredicate.limit!,
                  });
                }}
              >
                {lastPage - 1}
              </PaginationButton>
            </li>
          </>
        )}
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
        {/*
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
        */}

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
