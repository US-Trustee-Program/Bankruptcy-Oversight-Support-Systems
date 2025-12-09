import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import CaseTable from './CaseTable';
import { CaseSummary } from '@common/cams/cases';
import MockData from '@common/cams/test-utilities/mock-data';

const cases: Array<CaseSummary> = [
  MockData.getCaseSummary(),
  MockData.getCaseSummary(),
  MockData.getCaseSummary(),
];

function getNumberOfColumns(table: HTMLElement) {
  const thead = table.children[0];
  const trow = thead.children[0];
  return trow.children.length;
}

describe('CaseTable component', () => {
  describe('in common', () => {
    test('should render a missing ssn / tax ID as an empty string', () => {
      const debtor = MockData.getDebtor({ override: { ssn: undefined, taxId: undefined } });
      const bCase = MockData.getCaseSummary({ override: { debtor } });
      render(
        <BrowserRouter>
          <CaseTable id="test-case-table" cases={[bCase]}></CaseTable>
        </BrowserRouter>,
      );

      const row = screen.getByTestId('test-case-table-row-0');
      const taxIdColumn = row.children[5];
      expect(taxIdColumn).toBeInTheDocument();
      expect(taxIdColumn).toHaveTextContent('');
    });
  });

  describe('for empty row', () => {
    test('should not render an empty row if onSelect is not provided', () => {
      const onSelect = vi.fn();
      render(
        <BrowserRouter>
          <CaseTable id="test-case-table" cases={[...cases, null]} onSelect={onSelect}></CaseTable>
        </BrowserRouter>,
      );

      const emptyRow = screen.queryByTestId('empty-row');
      expect(emptyRow).toBeInTheDocument();
    });

    test('should render an empty row if onSelect is provided', () => {
      render(
        <BrowserRouter>
          <CaseTable id="test-case-table" cases={[...cases, null]}></CaseTable>
        </BrowserRouter>,
      );

      const emptyRow = screen.queryByTestId('empty-row');
      expect(emptyRow).not.toBeInTheDocument();
    });
  });

  describe('without onSelect', () => {
    test('should render a table of cases', () => {
      render(
        <BrowserRouter>
          <CaseTable id="test-case-table" cases={cases}></CaseTable>
        </BrowserRouter>,
      );

      const table = screen.getByTestId('test-case-table');
      expect(table).toBeInTheDocument();

      const expectedColumnCount = 6;
      expect(getNumberOfColumns(table)).toEqual(expectedColumnCount);

      const radio0 = screen.queryByTestId('test-case-table-radio-0');
      expect(radio0).not.toBeInTheDocument();
    });
  });

  describe('with onSelect', () => {
    const onSelect = vi.fn();

    const renderWithoutProps = () => {
      render(
        <BrowserRouter>
          <CaseTable id="test-case-table" cases={cases} onSelect={onSelect}></CaseTable>
        </BrowserRouter>,
      );
    };

    test('should render radio buttons to select cases when onSelect is provided', () => {
      renderWithoutProps();
      const table = screen.getByTestId('test-case-table');
      expect(table).toBeInTheDocument();

      const expectedColumnCount = 7;
      expect(getNumberOfColumns(table)).toEqual(expectedColumnCount);

      const radio0 = screen.queryByTestId('button-radio-test-case-table-checkbox-0-click-target');
      expect(radio0).toBeInTheDocument();
    });

    test('should call onSelect when a case is selected', () => {
      renderWithoutProps();
      const radio0 = screen.queryByTestId('button-radio-test-case-table-checkbox-0-click-target');
      expect(radio0).toBeInTheDocument();

      fireEvent.click(radio0!);
      expect(onSelect).toHaveBeenCalled();
      expect(onSelect).toHaveBeenCalledWith(cases[0]);
    });
  });
});
