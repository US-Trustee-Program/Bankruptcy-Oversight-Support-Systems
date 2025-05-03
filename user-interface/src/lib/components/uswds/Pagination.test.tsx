import { Pagination, PaginationProps } from '@/lib/components/uswds/Pagination';
import { Pagination as PaginationModel } from '@common/api/pagination';
import { SearchPredicate } from '@common/api/search';
import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

describe('Pagination tests', () => {
  const retrievePageSpy = vi.fn();
  const defaultPagination: PaginationModel = {
    count: 25,
    currentPage: 1,
    limit: 25,
    totalCount: 500,
    totalPages: 10,
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
      retrievePage: retrievePageSpy,
      searchPredicate: defaultSearchPredicate,
      ...props,
    };

    render(
      <BrowserRouter>
        <Pagination {...defaultProps} />
      </BrowserRouter>,
    );
  }

  test('should call retrievePage correctly for page one button', () => {
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

  test('should call retrievePage correctly for page 10 button', () => {
    const props = {
      paginationValues: {
        ...defaultPagination,
        count: 100,
        currentPage: 1,
        limit: 10,
        totalCount: 100,
        totalPages: 10,
      },
      searchPredicate: {
        ...defaultSearchPredicate,
        limit: 10,
      },
    };
    renderWithProps(props);

    const expectedArgument = {
      ...defaultSearchPredicate,
      limit: 10,
      offset: 90,
    };

    const pageTenButton = screen.getByTestId('pagination-button-page-10-results');
    expect(pageTenButton).toBeInTheDocument();
    fireEvent.click(pageTenButton);
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
      paginationValues: { ...defaultPagination, currentPage, previous },
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
      paginationValues: { ...defaultPagination, currentPage: 2, previous },
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
      paginationValues: { ...defaultPagination, currentPage, previous },
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
      paginationValues: { ...defaultPagination, currentPage, previous },
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

  test('should render 6 pages with no ellipses if there are 6 total pages and the current page is page 6. Previous should be in the document and Next should not.', () => {
    const testPagination = {
      ...defaultPagination,
      count: 225,
      currentPage: 6,
      limit: 25,
      totalCount: 225,
      totalPages: 6,
    };

    renderWithProps({ paginationValues: testPagination });

    const previousPageButton = screen.queryByTestId('pagination-button-previous-results');
    expect(previousPageButton).toBeInTheDocument();

    for (let page = 1; page < 6; page++) {
      const pageButton = screen.queryByTestId(`pagination-button-page-${page}-results`);
      expect(pageButton).toBeInTheDocument();
    }

    const pageSixButton = screen.queryByTestId('pagination-button-page-6-results');
    expect(pageSixButton).toBeInTheDocument();

    const ellipses = document.querySelectorAll('.usa-pagination__overflow');
    expect(ellipses).toHaveLength(0);

    const nextPageButton = screen.queryByTestId('pagination-button-next-results');
    expect(nextPageButton).not.toBeInTheDocument();
  });

  test('should render 6 pages with no ellipses if there are 6 total pages and the current page is page 1. Previous should not be in the document and Next should be.', () => {
    const testPagination = {
      ...defaultPagination,
      count: 225,
      currentPage: 1,
      limit: 25,
      totalCount: 225,
      totalPages: 6,
    };

    renderWithProps({ paginationValues: testPagination });

    const previousPageButton = screen.queryByTestId('pagination-button-previous-results');
    expect(previousPageButton).not.toBeInTheDocument();

    for (let page = 1; page < 6; page++) {
      const pageButton = screen.queryByTestId(`pagination-button-page-${page}-results`);
      expect(pageButton).toBeInTheDocument();
    }

    const pageSixButton = screen.queryByTestId('pagination-button-page-6-results');
    expect(pageSixButton).toBeInTheDocument();

    const ellipses = document.querySelectorAll('.usa-pagination__overflow');
    expect(ellipses).toHaveLength(0);

    const nextPageButton = screen.queryByTestId('pagination-button-next-results');
    expect(nextPageButton).toBeInTheDocument();
  });

  test('should render previous, page 1, page 2, page 3, ellipses, and next', () => {
    const props = {
      paginationValues: {
        ...defaultPagination,
        currentPage: 2,
        next,
        previous,
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
        currentPage: 3,
        next,
        previous,
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
        currentPage: 4,
        next,
        previous,
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
        currentPage: 5,
        next,
        previous,
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

  test('should render nextlink withdefault offset and limit', async () => {
    const props = {
      paginationValues: {
        ...defaultPagination,
        currentPage: 2,
        next,
        previous,
      },
      searchPredicate: {},
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
    fireEvent.click(nextPageButton!);
    expect(retrievePageSpy).toHaveBeenCalledWith({ offset: 25 });
  });

  test('should render nextlink withdefault offset and limit', async () => {
    const props = {
      paginationValues: {
        ...defaultPagination,
        currentPage: 2,
        next,
        previous,
      },
      searchPredicate: {},
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
    fireEvent.click(previousPageButton!);
    expect(retrievePageSpy).toHaveBeenCalledWith({ limit: 25, offset: 0 });
  });
});
