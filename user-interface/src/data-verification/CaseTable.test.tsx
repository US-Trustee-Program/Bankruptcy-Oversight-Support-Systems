import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { CaseTable } from './CaseTable';
import { CaseSummary } from '@common/cams/cases';
import { MockData } from '@common/cams/test-utilities/mock-data';

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
  describe('without onSelect', () => {
    beforeEach(() => {
      render(
        <BrowserRouter>
          <CaseTable id="test-case-table" cases={cases}></CaseTable>
        </BrowserRouter>,
      );
    });

    test('should render a table of cases', () => {
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

    beforeEach(() => {
      render(
        <BrowserRouter>
          <CaseTable id="test-case-table" cases={cases} onSelect={onSelect}></CaseTable>
        </BrowserRouter>,
      );
    });

    test('should render radio buttons to select cases when onSelect is provided', () => {
      const table = screen.getByTestId('test-case-table');
      expect(table).toBeInTheDocument();

      const expectedColumnCount = 7;
      expect(getNumberOfColumns(table)).toEqual(expectedColumnCount);

      const radio0 = screen.queryByTestId('test-case-table-radio-0');
      expect(radio0).toBeInTheDocument();
    });

    test('should call onSelect when a case is selected', () => {
      const radio0 = screen.queryByTestId('test-case-table-radio-0');
      expect(radio0).toBeInTheDocument();

      fireEvent.click(radio0!);
      expect(onSelect).toHaveBeenCalled();
      expect(onSelect).toHaveBeenCalledWith(cases[0]);
    });
  });
});
