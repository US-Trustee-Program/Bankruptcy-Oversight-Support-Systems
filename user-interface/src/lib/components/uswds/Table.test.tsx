import { render, screen } from '@testing-library/react';
import { TableRow, TableRowData } from './Table';

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
  test.only('should render row data childen', () => {
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

describe('TableHeader component', () => {
  test('', () => {});
});

describe('TableBody component', () => {
  test('', () => {});
});

describe('Table component', () => {
  test('', () => {});
});
