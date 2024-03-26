import { render, screen } from '@testing-library/react';
import { MockData } from '@common/cams/test-utilities/mock-data';
import CaseDetailAssociatedCases from './CaseDetailAssociatedCases';
import { ConsolidationFrom, ConsolidationTo, EventCaseReference } from '@common/cams/events';
import { ConsolidationType } from '@common/cams/orders';
import { BrowserRouter } from 'react-router-dom';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';

/*
dxtrId, debtor, officeName, officeCode,
*/
function getAssociatedCasesMock(caseId: string, consolidationType: ConsolidationType) {
  return [
    {
      caseId: '081-93-87181',
      otherCase: MockData.getCaseSummary({ override: { caseId, caseTitle: 'Mr Joe' } }),
      orderDate: '2016-09-28',
      documentType: 'CONSOLIDATION_TO',
      consolidationType,
    } as ConsolidationTo,
    {
      caseId,
      otherCase: MockData.getCaseSummary(),
      orderDate: '2016-09-28',
      documentType: 'CONSOLIDATION_FROM',
      consolidationType,
    } as ConsolidationFrom,
    {
      caseId,
      otherCase: MockData.getCaseSummary(),
      orderDate: '2016-09-28',
      documentType: 'CONSOLIDATION_FROM',
      consolidationType,
    } as ConsolidationFrom,
    {
      caseId,
      otherCase: MockData.getCaseSummary(),
      orderDate: '2016-09-28',
      documentType: 'CONSOLIDATION_FROM',
      consolidationType,
    } as ConsolidationFrom,
  ];
}

describe('associated cases tests', () => {
  function renderComponent(mock: EventCaseReference[], isLoading: boolean) {
    render(
      <BrowserRouter>
        <CaseDetailAssociatedCases associatedCases={mock} isAssociatedCasesLoading={isLoading} />
      </BrowserRouter>,
    );
  }

  test('should display loading indicator if loading', async () => {
    renderComponent([], true);

    const loadingIndicator = screen.queryByTestId('loading-indicator');
    expect(loadingIndicator).toBeInTheDocument();
  });

  test.only('should display associated case table when data exists', async () => {
    const mock: EventCaseReference[] = getAssociatedCasesMock('081-34-34811', 'substantive');
    renderComponent(mock, false);

    const sortedMock = mock
      .sort((a, b) => (a.otherCase.caseId > b.otherCase.caseId ? 1 : -1))
      .sort((a, _b) => (a.documentType === 'CONSOLIDATION_FROM' ? 1 : -1));

    let header3, header4;
    await vi.waitFor(() => {
      header3 = document.querySelector('.associated-cases h3');
      header4 = document.querySelector('.associated-cases h4');
    });

    expect(header3).toHaveTextContent('Consolidated cases (4)');
    expect(header4).toHaveTextContent('Substantive Consolidation');

    const tableRow1Cells = document.querySelectorAll('#associated-cases-table tr:nth-child(1) td');
    const tableRow3Cells = document.querySelectorAll('#associated-cases-table tr:nth-child(3) td');
    expect(tableRow1Cells[1]).toHaveTextContent(
      `${getCaseNumber(sortedMock[0].otherCase.caseTitle)} (Lead)`,
    );
    expect(tableRow3Cells[0]).toHaveTextContent(
      `${getCaseNumber(sortedMock[2].otherCase.caseId)} (${sortedMock[2].otherCase.courtDivisionName})`,
    );
    expect(tableRow3Cells[1]).toHaveTextContent(
      `${getCaseNumber(sortedMock[2].otherCase.caseTitle)}`,
    );
    expect(tableRow3Cells[2]).toHaveTextContent(
      `${getCaseNumber(sortedMock[2].otherCase.dateFiled)}`,
    );
    expect(tableRow3Cells[3]).toHaveTextContent(`${getCaseNumber(sortedMock[2].orderDate)}`);
  });

  test('should display lead case in the top of the list.', async () => {
    renderComponent([], false);
  });

  test('should display cases in order by case ID.', async () => {
    renderComponent([], false);
  });
});
