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

    screen.debug(table!);
    expectedCssClasses.forEach((cssClass) => {
      expect(table).toHaveClass(cssClass);
    });
  });

  describe('TableRowSortButton component', () => {
    // TODO: Implement expect statements in these tests.
    test('should render unsorted', () => {
      render(<TableRowSortButton direction="unsorted"></TableRowSortButton>);
    });
    test('should render ascending', () => {
      render(<TableRowSortButton direction="ascending"></TableRowSortButton>);
    });
    test('should render descending', () => {
      render(<TableRowSortButton direction="descending"></TableRowSortButton>);
    });
  });
});
