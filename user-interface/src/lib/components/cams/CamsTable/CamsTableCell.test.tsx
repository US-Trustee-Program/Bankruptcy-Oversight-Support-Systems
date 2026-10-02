import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import { CamsTableCell } from './CamsTableCell';

describe('CamsTableCell', () => {
  test('should render a label element when data-cell is a non-empty string', () => {
    const { container } = render(
      <CamsTableCell data-cell="Case Number">081-24-12345</CamsTableCell>,
    );

    const labelElement = container.querySelector('.cams-table__cell-label');
    expect(labelElement).toBeInTheDocument();
    expect(labelElement?.textContent).toBe('Case Number: ');
  });

  test('should NOT render a label element when data-cell is an empty string', () => {
    const { container } = render(<CamsTableCell data-cell="">Additional info</CamsTableCell>);

    const labelElement = container.querySelector('.cams-table__cell-label');
    expect(labelElement).not.toBeInTheDocument();
  });

  test('should NOT render a label element when data-cell prop is not provided', () => {
    const { container } = render(<CamsTableCell>Some value</CamsTableCell>);

    const labelElement = container.querySelector('.cams-table__cell-label');
    expect(labelElement).not.toBeInTheDocument();
  });

  test('should still set the data-cell attribute on the cell (regression guard for SCSS selectors)', () => {
    const { container } = render(<CamsTableCell data-cell="Chapter">7</CamsTableCell>);

    const cell = container.querySelector('.cams-table__cell');
    expect(cell).toHaveAttribute('data-cell', 'Chapter');
  });

  test('should include both label and value in the text content, in that order', () => {
    render(<CamsTableCell data-cell="Status">Open</CamsTableCell>);

    // The cell should have text that includes "Status: " followed by "Open"
    const cell = screen.getByRole('cell');
    expect(cell.textContent).toMatch(/Status: .*Open/);
  });

  test('should render label even with empty string children', () => {
    const { container } = render(<CamsTableCell data-cell="Amount"></CamsTableCell>);

    const labelElement = container.querySelector('.cams-table__cell-label');
    expect(labelElement).toBeInTheDocument();
    expect(labelElement?.textContent).toBe('Amount: ');
  });

  test('should apply className to the cell container', () => {
    const { container } = render(
      <CamsTableCell className="col-special" data-cell="Name">
        John Doe
      </CamsTableCell>,
    );

    const cell = container.querySelector('.cams-table__cell');
    expect(cell).toHaveClass('col-special');
    expect(cell).toHaveClass('cams-table__cell');
  });

  test('should preserve data-cell attribute when empty', () => {
    const { container } = render(<CamsTableCell data-cell="">Content</CamsTableCell>);

    const cell = container.querySelector('.cams-table__cell');
    expect(cell).toHaveAttribute('data-cell', '');
  });
});
