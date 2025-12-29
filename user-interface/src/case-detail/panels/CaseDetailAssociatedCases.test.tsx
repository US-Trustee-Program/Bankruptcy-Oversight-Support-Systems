import { render, screen, waitFor } from '@testing-library/react';
import MockData from '@common/cams/test-utilities/mock-data';
import CaseDetailAssociatedCases from './CaseDetailAssociatedCases';
import {
  ConsolidationFrom,
  ConsolidationTo,
  EventCaseReference,
  Transfer,
} from '@common/cams/events';
import { ConsolidationType } from '@common/cams/orders';
import { BrowserRouter } from 'react-router-dom';
import { getCaseNumber } from '@/lib/utils/caseNumber';
import { formatDate } from '@/lib/utils/datetime';
import { CaseDetail } from '@common/cams/cases';

function getAssociatedCasesMock(caseId: string, consolidationType: ConsolidationType) {
  return [
    {
      caseId: '081-93-87181',
      otherCase: MockData.getCaseSummary({
        override: { caseId, caseTitle: 'Mr Joe', courtDivisionCode: '001' },
      }),
      orderDate: '2016-09-28',
      documentType: 'CONSOLIDATION_TO',
      consolidationType,
    } as ConsolidationTo,
    {
      caseId,
      otherCase: MockData.getCaseSummary({ override: { courtDivisionCode: '001' } }),
      orderDate: '2016-09-28',
      documentType: 'CONSOLIDATION_FROM',
      consolidationType,
    } as ConsolidationFrom,
    {
      caseId,
      otherCase: MockData.getCaseSummary({ override: { courtDivisionCode: '001' } }),
      orderDate: '2016-09-28',
      documentType: 'CONSOLIDATION_FROM',
      consolidationType,
    } as ConsolidationFrom,
    {
      caseId,
      otherCase: MockData.getCaseSummary({ override: { courtDivisionCode: '001' } }),
      orderDate: '2016-09-28',
      documentType: 'CONSOLIDATION_FROM',
      consolidationType,
    } as ConsolidationFrom,
  ];
}

describe('associated cases tests', () => {
  function renderComponent(
    mock: EventCaseReference[],
    isLoading: boolean,
    caseDetail?: CaseDetail,
  ) {
    if (!caseDetail) {
      caseDetail = MockData.getCaseDetail();
    }

    render(
      <BrowserRouter>
        <CaseDetailAssociatedCases
          caseDetail={caseDetail}
          associatedCases={mock}
          isAssociatedCasesLoading={isLoading}
        />
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

  test('should display alert if no associated cases are available', async () => {
    renderComponent([], false);

    const alert = screen.queryByTestId('alert-container-no-cases');
    expect(alert).toBeInTheDocument();
  });

  test('should display associated case table when data exists', async () => {
    const mock: EventCaseReference[] = getAssociatedCasesMock('081-34-34811', 'substantive');
    renderComponent(mock, false);

    const sortedMock = sortMock(mock);

    let header3;
    await waitFor(() => {
      header3 = document.querySelector('.associated-cases h3');
    });

    expect(header3).toHaveTextContent('Substantive Consolidation (4)');

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
    expect(tableRow1Cells[1]).toHaveTextContent(`${sortedMock[0].otherCase.caseTitle}`);
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

    const row2Link = row2IdCell!.querySelector('a');
    const row3Link = row3IdCell!.querySelector('a');
    const row4Link = row4IdCell!.querySelector('a');

    const row2Int = getInt(row2Link!.textContent as string);
    const row3Int = getInt(row3Link!.textContent as string);
    const row4Int = getInt(row4Link!.textContent as string);

    expect(row3Int).toBeGreaterThan(row2Int);
    expect(row4Int).toBeGreaterThan(row3Int);
  });

  test('should display lead case icon with tooltip in table', () => {
    const mock: EventCaseReference[] = getAssociatedCasesMock('081-34-34811', 'administrative');
    renderComponent(mock, false);

    const row1IdCell = document.querySelector(
      '#associated-cases-table tr:nth-child(1) td:nth-child(1)',
    );
    const leadIcon = row1IdCell!.querySelector('[data-testid="lead-case-icon"]');
    expect(leadIcon).toBeInTheDocument();

    const titleElement = leadIcon!.querySelector('title');
    expect(titleElement).toHaveTextContent('Lead case in joint administration');
  });

  test('should display member case icon with tooltip in table', () => {
    const mock: EventCaseReference[] = getAssociatedCasesMock('081-34-34811', 'substantive');
    renderComponent(mock, false);

    const row2IdCell = document.querySelector(
      '#associated-cases-table tr:nth-child(2) td:nth-child(1)',
    );
    const memberIcon = row2IdCell!.querySelector('[data-testid="member-case-icon"]');
    expect(memberIcon).toBeInTheDocument();

    const titleElement = memberIcon!.querySelector('title');
    expect(titleElement).toHaveTextContent('Member case in substantive consolidation');
  });

  describe('Transferred case information tests', () => {
    const BASE_TEST_CASE_DETAIL = MockData.getCaseDetail();
    const OLD_CASE_ID = '111-20-11111';
    const TEST_CASE_ID = '101-23-12345';
    const NEW_CASE_ID = '222-24-00001';
    const TRANSFER_FROM: Transfer = {
      caseId: TEST_CASE_ID,
      otherCase: MockData.getCaseSummary({ override: { caseId: OLD_CASE_ID } }),
      orderDate: '01-04-2023',
      documentType: 'TRANSFER_FROM',
    };

    const TRANSFER_TO: Transfer = {
      caseId: TEST_CASE_ID,
      otherCase: MockData.getCaseSummary({ override: { caseId: NEW_CASE_ID } }),
      orderDate: '01-12-2024',
      documentType: 'TRANSFER_TO',
    };

    test('should display information about case being transfered out when there is no verified transfer', async () => {
      renderComponent([], false, { ...BASE_TEST_CASE_DETAIL, transferDate: '2024-12-01' });

      expect(screen.queryByTestId('verified-transfer-header')).not.toBeInTheDocument();
      const ambiguousTransferText = screen.queryByTestId('ambiguous-transfer-text');
      expect(ambiguousTransferText).toHaveTextContent(
        'This case was transferred to another court. Review the docket for further details.',
      );
    });

    test('should display information about case being transferred in when there is no verified transfer', async () => {
      renderComponent([], false, { ...BASE_TEST_CASE_DETAIL, petitionCode: 'TI' });

      expect(screen.queryByTestId('verified-transfer-header')).not.toBeInTheDocument();
      const ambiguousTransferText = screen.queryByTestId('ambiguous-transfer-text');
      expect(ambiguousTransferText).toHaveTextContent(
        'This case was transferred from another court. Review the docket for further details.',
      );
    });

    test('should display old case information', () => {
      renderComponent([], false, { ...BASE_TEST_CASE_DETAIL, transfers: [TRANSFER_FROM] });

      expect(screen.queryByTestId('ambiguous-transfer-text')).not.toBeInTheDocument();

      const oldCaseIdLink = screen.queryByTestId('case-detail-transfer-link-0');
      expect(oldCaseIdLink).toBeInTheDocument();
      expect(oldCaseIdLink?.textContent).toEqual(getCaseNumber(OLD_CASE_ID));

      const oldCaseOrderDate = screen.queryByTestId('case-detail-transfer-order-0');
      expect(oldCaseOrderDate).toBeInTheDocument();
      expect(oldCaseOrderDate?.textContent).toEqual(formatDate(TRANSFER_FROM.orderDate));

      const oldCaseCourt = screen.queryByTestId('case-detail-transfer-court-0');
      expect(oldCaseCourt).toBeInTheDocument();
      expect(oldCaseCourt?.textContent).toEqual(
        `${TRANSFER_FROM.otherCase.courtName} - ${TRANSFER_FROM.otherCase.courtDivisionName}`,
      );
    });

    test('should display new case information', () => {
      renderComponent([], false, { ...BASE_TEST_CASE_DETAIL, transfers: [TRANSFER_TO] });

      expect(screen.queryByTestId('ambiguous-transfer-text')).not.toBeInTheDocument();

      const newCaseNumberLink = screen.queryByTestId('case-detail-transfer-link-0');
      expect(newCaseNumberLink).toBeInTheDocument();
      expect(newCaseNumberLink?.textContent).toEqual(getCaseNumber(NEW_CASE_ID));

      const newCaseOrderDate = screen.queryByTestId('case-detail-transfer-order-0');
      expect(newCaseOrderDate).toBeInTheDocument();
      expect(newCaseOrderDate?.textContent).toEqual(formatDate(TRANSFER_TO.orderDate));

      const newCaseCourt = screen.queryByTestId('case-detail-transfer-court-0');
      expect(newCaseCourt).toBeInTheDocument();
      expect(newCaseCourt?.textContent).toEqual(
        `${TRANSFER_TO.otherCase.courtName} - ${TRANSFER_TO.otherCase.courtDivisionName}`,
      );
    });

    test('should display old and new case information', () => {
      renderComponent([], false, {
        ...BASE_TEST_CASE_DETAIL,
        transfers: [TRANSFER_TO, TRANSFER_FROM],
      });

      const newCaseNumberLink = screen.queryByTestId('case-detail-transfer-link-0');
      expect(newCaseNumberLink).toBeInTheDocument();
      expect(newCaseNumberLink?.textContent).toEqual(getCaseNumber(NEW_CASE_ID));

      const newCaseOrderDate = screen.queryByTestId('case-detail-transfer-order-0');
      expect(newCaseOrderDate).toBeInTheDocument();
      expect(newCaseOrderDate?.textContent).toEqual(formatDate(TRANSFER_TO.orderDate));

      const newCaseCourt = screen.queryByTestId('case-detail-transfer-court-0');
      expect(newCaseCourt).toBeInTheDocument();
      expect(newCaseCourt?.textContent).toEqual(
        `${TRANSFER_TO.otherCase.courtName} - ${TRANSFER_TO.otherCase.courtDivisionName}`,
      );

      const oldCaseIdLink = screen.queryByTestId('case-detail-transfer-link-1');
      expect(oldCaseIdLink).toBeInTheDocument();
      expect(oldCaseIdLink?.textContent).toEqual(getCaseNumber(OLD_CASE_ID));

      const oldCaseOrderDate = screen.queryByTestId('case-detail-transfer-order-1');
      expect(oldCaseOrderDate).toBeInTheDocument();
      expect(oldCaseOrderDate?.textContent).toEqual(formatDate(TRANSFER_FROM.orderDate));

      const oldCaseCourt = screen.queryByTestId('case-detail-transfer-court-1');
      expect(oldCaseCourt).toBeInTheDocument();
      expect(oldCaseCourt?.textContent).toEqual(
        `${TRANSFER_FROM.otherCase.courtName} - ${TRANSFER_FROM.otherCase.courtDivisionName}`,
      );
    });
  });
});
