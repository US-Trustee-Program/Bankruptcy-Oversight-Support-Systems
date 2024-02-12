import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { CaseTable } from './CaseTable';
import { CaseSummary } from '@common/cams/cases';

const cases: Array<CaseSummary> = [
  {
    // courtDivision: '081', // <-- GAP
    caseId: '081-85-86221',
    caseTitle: 'Smith-Moyer',
    dateFiled: '2022-10-03',
    chapter: '15',
    // courtId: '0208', // GAP
    courtName: 'Southern District of New York',
    courtDivisionName: 'Manhattan',
    regionId: '02',
    debtorTypeLabel: 'Individual Business',
    petitionLabel: 'Voluntary',
    officeName: 'New York',
    debtor: {
      name: 'DebtorName',
      ssn: '11-1111',
    },
  },
  {
    // courtDivision: '081', // <-- GAP
    caseId: '081-85-86221',
    caseTitle: 'Smith-Moyer',
    dateFiled: '2022-10-03',
    chapter: '15',
    // courtId: '0208', // GAP
    courtName: 'Southern District of New York',
    courtDivisionName: 'Manhattan',
    regionId: '02',
    debtorTypeLabel: 'Individual Business',
    petitionLabel: 'Voluntary',
    officeName: 'New York',
    debtor: {
      name: 'DebtorName',
      taxId: '22-22222',
    },
  },
  {
    // courtDivision: '081', // <-- GAP
    caseId: '081-85-86221',
    caseTitle: 'Smith-Moyer',
    dateFiled: '2022-10-03',
    chapter: '15',
    // courtId: '0208', // GAP
    courtName: 'Southern District of New York',
    courtDivisionName: 'Manhattan',
    regionId: '02',
    debtorTypeLabel: 'Individual Business',
    petitionLabel: 'Voluntary',
    officeName: 'New York',
    debtor: {
      name: 'DebtorName',
    },
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
