import {
  BUTTON_BASE_CLASS,
  PaginationButton,
  PaginationButtonProps,
} from '@/lib/components/uswds/PaginationButton';
import { BrowserRouter } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';

describe('PaginationButton tests', () => {
  const onClickSpy = vi.fn();
  beforeEach(async () => {
    vi.stubEnv('CAMS_PA11Y', 'true');
  });

  function renderWithProps(props: Partial<PaginationButtonProps> = {}) {
    const defaultProps: PaginationButtonProps = {
      id: 'test',
      children: 1,
    };

    render(
      <BrowserRouter>
        <PaginationButton {...defaultProps} {...props} onClick={onClickSpy} />
      </BrowserRouter>,
    );
  }

  test('should call onClick', () => {
    renderWithProps({ id: 'test' });

    const button = screen.getByTestId('pagination-button-test');

    fireEvent.click(button);

    expect(onClickSpy).toHaveBeenCalled();
  });

  test('should render previous button correctly', () => {
    const props = {
      isPrevious: true,
    };

    renderWithProps(props);

    const button = screen.getByTestId('pagination-button-test');

    expect(button).toHaveClass('usa-pagination__link');
    expect(button).toHaveClass('usa-pagination__previous-page');
    expect(button).not.toHaveClass('usa-pagination__next-page');
    expect(button).not.toHaveClass(BUTTON_BASE_CLASS);
    expect(button).not.toHaveClass('usa-current');
    expect(button).toHaveTextContent('Previous');

    const icon = screen.getByTestId('icon');

    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass('usa-icon');
  });

  test('should render next button correctly', () => {
    const props = {
      isNext: true,
    };

    renderWithProps(props);

    const button = screen.getByTestId('pagination-button-test');

    expect(button).toHaveClass('usa-pagination__link');
    expect(button).toHaveClass('usa-pagination__next-page');
    expect(button).not.toHaveClass('usa-pagination__previous-page');
    expect(button).not.toHaveClass(BUTTON_BASE_CLASS);
    expect(button).not.toHaveClass('usa-current');
    expect(button).toHaveTextContent('Next');

    const icon = screen.getByTestId('icon');

    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass('usa-icon');
  });

  test('should render current button correctly', () => {
    const props = {
      isCurrent: true,
    };

    renderWithProps(props);

    const button = screen.getByTestId('pagination-button-test');

    expect(button).not.toHaveClass('usa-pagination__link');
    expect(button).not.toHaveClass('usa-pagination__previous-page');
    expect(button).not.toHaveClass('usa-pagination__next-page');
    expect(button).toHaveClass(BUTTON_BASE_CLASS);
    expect(button).toHaveClass('usa-current');
    expect(button).toHaveTextContent('1');

    const icon = screen.queryByTestId('icon');

    expect(icon).not.toBeInTheDocument();
  });

  test('should render non-current button correctly', () => {
    renderWithProps();

    const button = screen.getByTestId('pagination-button-test');

    expect(button).not.toHaveClass('usa-pagination__link');
    expect(button).not.toHaveClass('usa-pagination__previous-page');
    expect(button).not.toHaveClass('usa-pagination__next-page');
    expect(button).toHaveClass(BUTTON_BASE_CLASS);
    expect(button).not.toHaveClass('usa-current');
    expect(button).toHaveTextContent('1');

    const icon = screen.queryByTestId('icon');

    expect(icon).not.toBeInTheDocument();
  });
});
