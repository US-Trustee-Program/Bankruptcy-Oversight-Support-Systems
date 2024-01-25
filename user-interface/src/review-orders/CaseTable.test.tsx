import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { CaseTable } from './CaseTable';
import { CaseDetailType } from '@/lib/type-declarations/chapter-15';

const cases: Array<CaseDetailType> = [
  {
    // courtDivision: '081', // <-- GAP
    caseId: '081-85-86221',
    caseTitle: 'Smith-Moyer',
    dateFiled: '2022-10-03',
    // dxtrId: '313826', // GAP
    chapter: '15',
    // courtId: '0208', // GAP
    courtName: 'Southern District of New York',
    courtDivisionName: 'Manhattan',
    judgeName: 'Kimberly X. Willis',
    regionId: '02',
    debtorTypeLabel: 'Individual Business',
    petitionLabel: 'Voluntary',
    officeName: 'New York',
    assignments: [], // GAP
    debtor: {
      name: 'DebtorName',
    }, // GAP
  },
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
