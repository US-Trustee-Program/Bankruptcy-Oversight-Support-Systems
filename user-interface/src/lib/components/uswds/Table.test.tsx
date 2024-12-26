import { render, screen } from '@testing-library/react';
import {
  Table,
  TableBody,
  TableHeader,
  TableHeaderData,
  TableRow,
  TableRowData,
  TableRowSortButton,
  UswdsTableStyle,
} from './Table';

describe('TableRowData component', () => {
  test('should render text childen', () => {
    const expectedText = 'test';
    render(<TableRowData data-testid="test-element">{expectedText}</TableRowData>);
    const element = screen.getByTestId('test-element');
    expect(element).toHaveTextContent(expectedText);
  });

  test('should render <span> childen', () => {
    const expectedText = 'test';
    const testSpan = <span>{expectedText}</span>;
    render(<TableRowData data-testid="test-element">{testSpan}</TableRowData>);
    const element = screen.getByTestId('test-element');
    expect(element).toHaveTextContent(expectedText);
  });

  test('should render <a> childen', () => {
    const expectedText = 'test';
    const testLink = <a>{expectedText}</a>;
    render(<TableRowData data-testid="test-element">{testLink}</TableRowData>);
    const element = screen.getByTestId('test-element');
    expect(element).toHaveTextContent(expectedText);
  });
});

describe('TableRow component', () => {
  test('should render row data childen', () => {
    const expectedText = 'test';
    render(
      <TableRow data-testid="test-element">
        <TableRowData>{expectedText}</TableRowData>
        <TableRowData>{expectedText}</TableRowData>
        <TableRowData>{expectedText}</TableRowData>
      </TableRow>,
    );
    const element = screen.getByTestId('test-element');
    expect(element).toHaveTextContent(expectedText + expectedText + expectedText);
  });
});

describe('TableHeaderData component', () => {
  test('should render text childen', () => {
    const expectedText = 'test';
    render(<TableHeaderData data-testid="test-element">{expectedText}</TableHeaderData>);
    const element = screen.getByTestId('test-element');
    expect(element).toHaveTextContent(expectedText);
  });

  test('should render <span> childen', () => {
    const expectedText = 'test';
    const testSpan = <span>{expectedText}</span>;
    render(<TableHeaderData data-testid="test-element">{testSpan}</TableHeaderData>);
    const element = screen.getByTestId('test-element');
    expect(element).toHaveTextContent(expectedText);
  });

  test('should render <a> childen', () => {
    const expectedText = 'test';
    const testLink = <a>{expectedText}</a>;
    render(<TableHeaderData data-testid="test-element">{testLink}</TableHeaderData>);
    const element = screen.getByTestId('test-element');
    expect(element).toHaveTextContent(expectedText);
  });

  test('should have an aria-sort attribute of ascending if sorted ascending', () => {
    render(
      <TableHeaderData
        data-testid="test-element"
        sortable={true}
        sortDirection="ascending"
      ></TableHeaderData>,
    );
    const element = screen.getByTestId('test-element');
    expect(element).toHaveAttribute('aria-sort', 'ascending');
  });

  test('should have an aria-sort attribute of descending if sorted descending', () => {
    render(
      <TableHeaderData
        data-testid="test-element"
        sortable={true}
        sortDirection="descending"
      ></TableHeaderData>,
    );
    const element = screen.getByTestId('test-element');
    expect(element).toHaveAttribute('aria-sort', 'descending');
  });

  test('should not have an aria-sort attribute if unsorted', () => {
    render(
      <TableHeaderData
        data-testid="test-element"
        sortable={true}
        sortDirection="unsorted"
      ></TableHeaderData>,
    );
    const element = screen.queryByTestId('test-element');
    expect(element).not.toHaveAttribute('aria-sort');
  });

  test('should render with role attribute value "columnheader" by default', () => {
    render(<TableHeaderData data-testid="test-element" />);
    const element = screen.getByTestId('test-element');
    expect(element).toHaveAttribute('role', 'columnheader');
  });

  test('should render with role attribute value "row" if scope = "row"', () => {
    render(<TableHeaderData data-testid="test-element" scope="row" />);
    const element = screen.getByTestId('test-element');
    expect(element).toHaveAttribute('role', 'row');
  });
});

describe('TableHeader component', () => {
  test('should render children', () => {
    const expectedText = 'test';
    render(
      <TableHeader data-testid="test-element">
        <TableHeaderData>{expectedText}</TableHeaderData>
        <TableHeaderData>{expectedText}</TableHeaderData>
        <TableHeaderData>{expectedText}</TableHeaderData>
      </TableHeader>,
    );
    const element = screen.getByTestId('test-element');
    expect(element).toHaveTextContent(expectedText + expectedText + expectedText);
  });
});

describe('TableBody component', () => {
  test('should render row children', () => {
    const expectedText = 'test';
    const expectedTextX3 = expectedText + expectedText + expectedText;
    render(
      <TableBody data-testid="test-body">
        <TableRow data-testid="test-row">
          <TableRowData>{expectedText}</TableRowData>
          <TableRowData>{expectedText}</TableRowData>
          <TableRowData>{expectedText}</TableRowData>
        </TableRow>
        <TableRow data-testid="test-row">
          <TableRowData>{expectedText}</TableRowData>
          <TableRowData>{expectedText}</TableRowData>
          <TableRowData>{expectedText}</TableRowData>
        </TableRow>
        <TableRow data-testid="test-row">
          <TableRowData>{expectedText}</TableRowData>
          <TableRowData>{expectedText}</TableRowData>
          <TableRowData>{expectedText}</TableRowData>
        </TableRow>
      </TableBody>,
    );
    const body = screen.queryByTestId('test-body');
    expect(body).toBeInTheDocument();

    const rows = screen.queryAllByTestId('test-row');
    expect(rows).toHaveLength(3);
    rows.forEach((row) => {
      expect(row).toHaveTextContent(expectedTextX3);
    });
  });
});

describe('Table component', () => {
  test('should render the header and the table body', () => {
    render(
      <Table data-testid="test-table">
        <TableHeader data-testid="test-header">
          <TableHeaderData>HEADER</TableHeaderData>
        </TableHeader>
        <TableBody data-testid="test-body">
          <TableRow>
            <TableRowData>DATA</TableRowData>
          </TableRow>
        </TableBody>
      </Table>,
    );

    const table = screen.queryByTestId('test-table');
    expect(table).toBeInTheDocument();

    const header = screen.queryByTestId('test-header');
    expect(header).toBeInTheDocument();

    const body = screen.queryByTestId('test-body');
    expect(body).toBeInTheDocument();
  });

  test('should include uswds css class when specified', () => {
    const styleMap = new Map<UswdsTableStyle, string>([['scrollable', 'usa-table--scrollable']]);
    const uswdsStyle: UswdsTableStyle[] = [...styleMap.keys()];
    const expectedCssClasses: string[] = [...styleMap.values()];
    render(
      <Table data-testid="test-table" uswdsStyle={uswdsStyle}>
        <TableHeader>
          <TableHeaderData>HEADER</TableHeaderData>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableRowData>DATA</TableRowData>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const table = screen.queryByTestId('test-table');
    expect(table).toBeInTheDocument();

    expectedCssClasses.forEach((cssClass) => {
      expect(table).toHaveClass(cssClass);
    });
  });

  test('should render the caption if title is passed to table', () => {
    render(<Table data-testid="test-table" title="test caption"></Table>);

    const table = screen.queryByTestId('test-table');
    expect(table).toBeInTheDocument();
    const caption = document.querySelector('caption');
    expect(table).toContainElement(caption);
    expect(caption).toHaveTextContent('test caption');
  });

  describe('TableRowSortButton component', () => {
    // TODO: Implement expect statements in these tests.
    test('should render unsorted', () => {
      render(<TableRowSortButton direction="unsorted"></TableRowSortButton>);
      const svg = document.querySelector('.usa-table__header__button > svg');
      expect(svg).toBeInTheDocument();
      expect(svg?.hasChildNodes).toBeTruthy();
      expect(svg?.childNodes[0]).toHaveClass('unsorted');
    });

    test('should render ascending', () => {
      render(<TableRowSortButton direction="ascending"></TableRowSortButton>);
      const svg = document.querySelector('.usa-table__header__button > svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass('usa-icon');
      expect(svg?.hasChildNodes).toBeTruthy();
      expect(svg?.childNodes[0]).toHaveClass('ascending');
    });

    test('should render descending', () => {
      render(<TableRowSortButton direction="descending"></TableRowSortButton>);
      const svg = document.querySelector('.usa-table__header__button > svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass('usa-icon');
      expect(svg?.hasChildNodes).toBeTruthy();
      expect(svg?.childNodes[0]).toHaveClass('descending');
    });

    test('should render ascending if no direction is provided', () => {
      render(<TableRowSortButton></TableRowSortButton>);
      const svg = document.querySelector('.usa-table__header__button > svg');
      expect(svg).toBeInTheDocument();
      expect(svg?.childNodes[0]).toHaveClass('ascending');
    });
  });
});
