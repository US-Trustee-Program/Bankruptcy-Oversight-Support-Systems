import { Pagination, PaginationProps } from '@/lib/components/uswds/Pagination';
import { BrowserRouter } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { Pagination as PaginationModel } from '@common/api/pagination';
import { SearchPredicate } from '@common/api/search';

describe('Pagination tests', () => {
  const retrievePageSpy = vi.fn();
  const defaultPagination: PaginationModel = {
    count: 25,
    limit: 25,
    currentPage: 1,
    totalPages: 10,
    totalCount: 500,
  };
  const next = 'next-link';
  const previous = 'previous-link';
  const defaultSearchPredicate = {
    limit: 25,
    offset: 0,
  };
  beforeEach(async () => {
    vi.stubEnv('CAMS_PA11Y', 'true');
  });

  function renderWithProps(props: Partial<PaginationProps<SearchPredicate>> = {}) {
    const defaultProps: PaginationProps<SearchPredicate> = {
      paginationValues: defaultPagination,
      searchPredicate: defaultSearchPredicate,
      retrievePage: retrievePageSpy,
    };

    render(
      <BrowserRouter>
        <Pagination {...defaultProps} {...props} />
      </BrowserRouter>,
    );
  }

  test('should call retrievePage correctly for next page number button', () => {
    renderWithProps();

    const expectedArgument = {
      ...defaultSearchPredicate,
      offset: defaultSearchPredicate.offset + defaultSearchPredicate.limit,
    };

    const pageTwoButton = screen.getByTestId('pagination-button-page-2-results');
    expect(pageTwoButton).toBeInTheDocument();
    fireEvent.click(pageTwoButton);
    expect(retrievePageSpy).toHaveBeenCalledWith(expectedArgument);
  });

  test('should call retrievePage correctly for next button', () => {
    const testPagination = { ...defaultPagination, next };
    renderWithProps({ paginationValues: testPagination });

    const expectedArgument = {
      ...defaultSearchPredicate,
      offset: defaultSearchPredicate.offset + defaultSearchPredicate.limit,
    };

    const nextButton = screen.getByTestId('pagination-button-next-results');
    expect(nextButton).toBeInTheDocument();
    fireEvent.click(nextButton);
    expect(retrievePageSpy).toHaveBeenCalledWith(expectedArgument);
  });

  test('should call retrievePage correctly for previous page number button', () => {
    const currentPage = 6;
    const searchPredicate = {
      ...defaultSearchPredicate,
      offset: defaultSearchPredicate.limit * (currentPage - 1),
    };
    const props = {
      paginationValues: { ...defaultPagination, previous, currentPage },
      searchPredicate,
    };
    renderWithProps(props);

    const expectedArgument = {
      ...defaultSearchPredicate,
      offset: searchPredicate.offset - searchPredicate.limit,
    };

    const pageOneButton = screen.getByTestId(`pagination-button-page-${currentPage - 1}-results`);
    expect(pageOneButton).toBeInTheDocument();
    fireEvent.click(pageOneButton);
    expect(retrievePageSpy).toHaveBeenCalledWith(expectedArgument);
  });

  test('should call retrievePage correctly for previous button', () => {
    const searchPredicate = { ...defaultSearchPredicate, offset: defaultSearchPredicate.limit };
    const props = {
      paginationValues: { ...defaultPagination, previous, currentPage: 2 },
      searchPredicate,
    };
    renderWithProps(props);

    const expectedArgument = {
      ...defaultSearchPredicate,
      offset: searchPredicate.offset - searchPredicate.limit,
    };

    const previousButton = screen.getByTestId('pagination-button-previous-results');
    expect(previousButton).toBeInTheDocument();
    fireEvent.click(previousButton);
    expect(retrievePageSpy).toHaveBeenCalledWith(expectedArgument);
  });

  test('should call retrievePage correctly for page one number button', () => {
    const currentPage = 6;
    const searchPredicate = {
      ...defaultSearchPredicate,
      offset: defaultSearchPredicate.limit * (currentPage - 1),
    };
    const props = {
      paginationValues: { ...defaultPagination, previous, currentPage },
      searchPredicate,
    };
    renderWithProps(props);

    const expectedArgument = {
      ...defaultSearchPredicate,
      offset: 0,
    };

    const pageOneButton = screen.getByTestId('pagination-button-page-1-results');
    expect(pageOneButton).toBeInTheDocument();
    fireEvent.click(pageOneButton);
    expect(retrievePageSpy).toHaveBeenCalledWith(expectedArgument);
  });

  test('should call retrievePage correctly for page two number button', () => {
    const currentPage = 4;
    const searchPredicate = {
      ...defaultSearchPredicate,
      offset: defaultSearchPredicate.limit * (currentPage - 1),
    };
    const props = {
      paginationValues: { ...defaultPagination, previous, currentPage },
      searchPredicate,
    };
    renderWithProps(props);

    const expectedArgument = {
      ...defaultSearchPredicate,
      offset: searchPredicate.limit,
    };

    const pageTwoButton = screen.getByTestId('pagination-button-page-2-results');
    expect(pageTwoButton).toBeInTheDocument();
    fireEvent.click(pageTwoButton);
    expect(retrievePageSpy).toHaveBeenCalledWith(expectedArgument);
  });

  test.skip('should not call retrievePage correctly for current page number button', () => {
    //What? Is this because of the difference in functionality between Cosmos && SQL?
    const currentPage = 6;
    const searchPredicate = {
      ...defaultSearchPredicate,
      offset: defaultSearchPredicate.limit * (currentPage - 1),
    };
    const props = {
      paginationValues: {
        ...defaultPagination,
        previous,
        next,
        currentPage,
        limit: 150,
      },
      searchPredicate,
    };
    renderWithProps(props);

    const expectedArgument = {
      ...searchPredicate,
    };

    const currentPageButton = screen.getByTestId(`pagination-button-page-${currentPage}-results`);
    expect(currentPageButton).toBeInTheDocument();
    fireEvent.click(currentPageButton);
    expect(retrievePageSpy).not.toHaveBeenCalledWith(expectedArgument);
  });

  test('should render page 1, page 2, ellipses, and next', () => {
    const testPagination = {
      ...defaultPagination,
      next,
    };

    renderWithProps({ paginationValues: testPagination });
    const previousPageButton = screen.queryByTestId('pagination-button-previous-results');
    expect(previousPageButton).not.toBeInTheDocument();
    const pageOneButton = screen.queryByTestId('pagination-button-page-1-results');
    expect(pageOneButton).toBeInTheDocument();
    const pageTwoButton = screen.queryByTestId('pagination-button-page-2-results');
    expect(pageTwoButton).toBeInTheDocument();
    const ellipses = document.querySelectorAll('.usa-pagination__overflow');
    expect(ellipses).toHaveLength(1);
    const nextPageButton = screen.queryByTestId('pagination-button-next-results');
    expect(nextPageButton).toBeInTheDocument();
  });

  test('should render previous, page 1, page 2, page 3, ellipses, and next', () => {
    const props = {
      paginationValues: {
        ...defaultPagination,
        previous,
        currentPage: 2,
        next,
      },
      searchPredicate: { ...defaultSearchPredicate, offset: defaultSearchPredicate.limit },
    };
    renderWithProps(props);

    const previousPageButton = screen.queryByTestId('pagination-button-previous-results');
    expect(previousPageButton).toBeInTheDocument();
    const pageOneButton = screen.queryByTestId('pagination-button-page-1-results');
    expect(pageOneButton).toBeInTheDocument();
    const pageTwoButton = screen.queryByTestId('pagination-button-page-2-results');
    expect(pageTwoButton).toBeInTheDocument();
    const pageThreeButton = screen.queryByTestId('pagination-button-page-3-results');
    expect(pageThreeButton).toBeInTheDocument();
    const ellipses = document.querySelectorAll('.usa-pagination__overflow');
    expect(ellipses).toHaveLength(1);
    const nextPageButton = screen.queryByTestId('pagination-button-next-results');
    expect(nextPageButton).toBeInTheDocument();
  });

  test('should render previous, page 1, page 2, page 3, page 4, ellipses, and next', () => {
    const props = {
      paginationValues: {
        ...defaultPagination,
        previous,
        currentPage: 3,
        next,
      },
      searchPredicate: { ...defaultSearchPredicate, offset: defaultSearchPredicate.limit * 2 },
    };
    renderWithProps(props);

    const previousPageButton = screen.queryByTestId('pagination-button-previous-results');
    expect(previousPageButton).toBeInTheDocument();
    const pageOneButton = screen.queryByTestId('pagination-button-page-1-results');
    expect(pageOneButton).toBeInTheDocument();
    const pageTwoButton = screen.queryByTestId('pagination-button-page-2-results');
    expect(pageTwoButton).toBeInTheDocument();
    const pageThreeButton = screen.queryByTestId('pagination-button-page-3-results');
    expect(pageThreeButton).toBeInTheDocument();
    const pageFourButton = screen.queryByTestId('pagination-button-page-4-results');
    expect(pageFourButton).toBeInTheDocument();
    const ellipses = document.querySelectorAll('.usa-pagination__overflow');
    expect(ellipses).toHaveLength(1);
    const nextPageButton = screen.queryByTestId('pagination-button-next-results');
    expect(nextPageButton).toBeInTheDocument();
  });

  test('should render previous, page 1, page 2, page 3, page 4, page 5, ellipses, and next', () => {
    const props = {
      paginationValues: {
        ...defaultPagination,
        previous,
        currentPage: 4,
        next,
      },
      searchPredicate: { ...defaultSearchPredicate, offset: defaultSearchPredicate.limit * 3 },
    };
    renderWithProps(props);

    const previousPageButton = screen.queryByTestId('pagination-button-previous-results');
    expect(previousPageButton).toBeInTheDocument();
    const pageOneButton = screen.queryByTestId('pagination-button-page-1-results');
    expect(pageOneButton).toBeInTheDocument();
    const pageTwoButton = screen.queryByTestId('pagination-button-page-2-results');
    expect(pageTwoButton).toBeInTheDocument();
    const pageThreeButton = screen.queryByTestId('pagination-button-page-3-results');
    expect(pageThreeButton).toBeInTheDocument();
    const pageFourButton = screen.queryByTestId('pagination-button-page-4-results');
    expect(pageFourButton).toBeInTheDocument();
    const pageFiveButton = screen.queryByTestId('pagination-button-page-5-results');
    expect(pageFiveButton).toBeInTheDocument();
    const ellipses = document.querySelectorAll('.usa-pagination__overflow');
    expect(ellipses).toHaveLength(1);
    const nextPageButton = screen.queryByTestId('pagination-button-next-results');
    expect(nextPageButton).toBeInTheDocument();
  });

  test('should render previous, page 1, ellipses, page 4, page 5, page 6, ellipses, and next', () => {
    const props = {
      paginationValues: {
        ...defaultPagination,
        previous,
        currentPage: 5,
        next,
      },
      searchPredicate: { ...defaultSearchPredicate, offset: defaultSearchPredicate.limit * 4 },
    };
    renderWithProps(props);

    const previousPageButton = screen.queryByTestId('pagination-button-previous-results');
    expect(previousPageButton).toBeInTheDocument();
    const pageOneButton = screen.queryByTestId('pagination-button-page-1-results');
    expect(pageOneButton).toBeInTheDocument();
    const pageTwoButton = screen.queryByTestId('pagination-button-page-2-results');
    expect(pageTwoButton).not.toBeInTheDocument();
    const pageThreeButton = screen.queryByTestId('pagination-button-page-3-results');
    expect(pageThreeButton).not.toBeInTheDocument();
    const pageFourButton = screen.queryByTestId('pagination-button-page-4-results');
    expect(pageFourButton).toBeInTheDocument();
    const pageFiveButton = screen.queryByTestId('pagination-button-page-5-results');
    expect(pageFiveButton).toBeInTheDocument();
    const pageSixButton = screen.queryByTestId('pagination-button-page-6-results');
    expect(pageSixButton).toBeInTheDocument();
    const ellipses = document.querySelectorAll('.usa-pagination__overflow');
    expect(ellipses).toHaveLength(2);
    const nextPageButton = screen.queryByTestId('pagination-button-next-results');
    expect(nextPageButton).toBeInTheDocument();
  });

  test('should not render final ellipses or next buttons if we have no next', () => {
    const props = {
      paginationValues: {
        ...defaultPagination,
        previous,
        next: undefined,
        currentPage: 5,
        totalPages: 5,
        totalCount: 249,
        limit: 25,
        offset: 225,
      },
      searchPredicate: { ...defaultSearchPredicate, offset: 225 },
    };
    renderWithProps(props);

    const previousPageButton = screen.queryByTestId('pagination-button-previous-results');
    expect(previousPageButton).toBeInTheDocument();
    const pageOneButton = screen.queryByTestId('pagination-button-page-1-results');
    expect(pageOneButton).toBeInTheDocument();
    const pageTwoButton = screen.queryByTestId('pagination-button-page-2-results');
    expect(pageTwoButton).not.toBeInTheDocument();
    const pageThreeButton = screen.queryByTestId('pagination-button-page-3-results');
    expect(pageThreeButton).not.toBeInTheDocument();
    const pageFourButton = screen.queryByTestId('pagination-button-page-4-results');
    expect(pageFourButton).toBeInTheDocument();
    const pageFiveButton = screen.queryByTestId('pagination-button-page-5-results');
    expect(pageFiveButton).toBeInTheDocument();
    const pageSixButton = screen.queryByTestId('pagination-button-page-6-results');
    expect(pageSixButton).not.toBeInTheDocument();
    const ellipses = document.querySelectorAll('.usa-pagination__overflow');
    expect(ellipses).toHaveLength(1);
    const nextPageButton = screen.queryByTestId('pagination-button-next-results');
    expect(nextPageButton).not.toBeInTheDocument();
  });
});
