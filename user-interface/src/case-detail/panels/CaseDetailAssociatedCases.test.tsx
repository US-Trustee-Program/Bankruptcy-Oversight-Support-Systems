import { render, screen } from '@testing-library/react';
import { MockData } from '@common/cams/test-utilities/mock-data';
import CaseDetailAssociatedCases from './CaseDetailAssociatedCases';
import { ConsolidationFrom, ConsolidationTo, EventCaseReference } from '@common/cams/events';
import { ConsolidationType } from '@common/cams/orders';
import { BrowserRouter } from 'react-router-dom';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import { formatDate } from '@/lib/utils/datetime';

function getAssociatedCasesMock(caseId: string, consolidationType: ConsolidationType) {
  return [
    {
      caseId: '081-93-87181',
      otherCase: MockData.getCaseSummary({
        override: { caseId, caseTitle: 'Mr Joe', courtDivision: '001' },
      }),
      orderDate: '2016-09-28',
      documentType: 'CONSOLIDATION_TO',
      consolidationType,
    } as ConsolidationTo,
    {
      caseId,
      otherCase: MockData.getCaseSummary({ override: { courtDivision: '001' } }),
      orderDate: '2016-09-28',
      documentType: 'CONSOLIDATION_FROM',
      consolidationType,
    } as ConsolidationFrom,
    {
      caseId,
      otherCase: MockData.getCaseSummary({ override: { courtDivision: '001' } }),
      orderDate: '2016-09-28',
      documentType: 'CONSOLIDATION_FROM',
      consolidationType,
    } as ConsolidationFrom,
    {
      caseId,
      otherCase: MockData.getCaseSummary({ override: { courtDivision: '001' } }),
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

  function sortMock(mock: EventCaseReference[]) {
    return mock
      .sort((a, b) =>
        getCaseNumber(a.otherCase.caseId) > getCaseNumber(b.otherCase.caseId) ? 1 : -1,
      )
      .sort((a, _b) => (a.documentType === 'CONSOLIDATION_FROM' ? 1 : -1));
  }

  function getInt(value: string): number {
    return parseInt(value.replace('-', ''));
  }

  test('should display loading indicator if loading', async () => {
    renderComponent([], true);

    const loadingIndicator = screen.queryByTestId('loading-indicator');
    expect(loadingIndicator).toBeInTheDocument();
  });

  test('should display associated case table when data exists', async () => {
    const mock: EventCaseReference[] = getAssociatedCasesMock('081-34-34811', 'substantive');
    renderComponent(mock, false);

    const sortedMock = sortMock(mock);

    let header3, header4;
    await vi.waitFor(() => {
      header3 = document.querySelector('.associated-cases h3');
      header4 = document.querySelector('.associated-cases h4');
    });

    expect(header3).toHaveTextContent('Consolidated cases (4)');
    expect(header4).toHaveTextContent('Substantive Consolidation');

    const tableRow3Cells = document.querySelectorAll('#associated-cases-table tr:nth-child(3) td');
    expect(tableRow3Cells[0]).toHaveTextContent(
      `${getCaseNumber(sortedMock[2].otherCase.caseId)} (${sortedMock[2].otherCase.courtDivisionName})`,
    );
    expect(tableRow3Cells[1]).toHaveTextContent(`${sortedMock[2].otherCase.caseTitle}`);
    expect(tableRow3Cells[2]).toHaveTextContent(`${formatDate(sortedMock[2].otherCase.dateFiled)}`);
    expect(tableRow3Cells[3]).toHaveTextContent(`${formatDate(sortedMock[2].orderDate)}`);
  });

  test('should display lead case in the top of the list.', async () => {
    const mock: EventCaseReference[] = getAssociatedCasesMock('081-34-34811', 'administrative');
    renderComponent(mock, false);

    const sortedMock = sortMock(mock);

    const tableRow1Cells = document.querySelectorAll('#associated-cases-table tr:nth-child(1) td');
    expect(tableRow1Cells[1]).toHaveTextContent(`${sortedMock[0].otherCase.caseTitle} (Lead)`);
  });

  test('should display cases in order by case ID, after lead case.', async () => {
    const mock: EventCaseReference[] = getAssociatedCasesMock('081-34-34811', 'administrative');
    renderComponent(mock, false);

    const sortedMock = sortMock(mock);

    const row2IdCell = document.querySelector(
      '#associated-cases-table tr:nth-child(2) td:nth-child(1)',
    );
    const row3IdCell = document.querySelector(
      '#associated-cases-table tr:nth-child(3) td:nth-child(1)',
    );
    const row4IdCell = document.querySelector(
      '#associated-cases-table tr:nth-child(4) td:nth-child(1)',
    );
    expect(row2IdCell).toHaveTextContent(getCaseNumber(sortedMock[1].otherCase.caseId));
    expect(row3IdCell).toHaveTextContent(getCaseNumber(sortedMock[2].otherCase.caseId));
    expect(row4IdCell).toHaveTextContent(getCaseNumber(sortedMock[3].otherCase.caseId));

    const row2Int = getInt(row2IdCell!.textContent as string);
    const row3Int = getInt(row3IdCell!.textContent as string);
    const row4Int = getInt(row4IdCell!.textContent as string);

    expect(row3Int).toBeGreaterThan(row2Int);
    expect(row4Int).toBeGreaterThan(row3Int);
  });
});
