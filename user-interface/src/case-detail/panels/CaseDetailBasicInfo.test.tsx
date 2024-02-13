import { BrowserRouter } from 'react-router-dom';
import CaseDetailBasicInfo from './CaseDetailBasicInfo';
import { render, screen } from '@testing-library/react';
import { formatDate } from '@/lib/utils/datetime';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import { Transfer } from '@common/cams/events';
import { CaseDetail } from '@common/cams/cases';
import { MockData } from '@common/cams/test-utilities/mock-data';

const TEST_CASE_ID = '101-23-12345';
const OLD_CASE_ID = '111-20-11111';
const NEW_CASE_ID = '222-24-00001';
const TEST_TRIAL_ATTORNEY_1 = 'Brian Wilson';
const TEST_TRIAL_ATTORNEY_2 = 'Carl Wilson';
const TEST_JUDGE_NAME = 'Rick B Hart';
const TEST_DEBTOR_ATTORNEY = MockData.getDebtorAttorney();
const BASE_TEST_CASE_DETAIL = MockData.getCaseDetail({
  override: {
    caseId: TEST_CASE_ID,
    judgeName: TEST_JUDGE_NAME,
    assignments: [TEST_TRIAL_ATTORNEY_1, TEST_TRIAL_ATTORNEY_2],
    debtorAttorney: TEST_DEBTOR_ATTORNEY,
  },
});
const TRANSFER_IN: Transfer = {
  caseId: TEST_CASE_ID,
  otherCaseId: OLD_CASE_ID,
  orderDate: '01-04-2023',
  divisionName: 'Old Division',
  courtName: 'Ye Olde Court',
  documentType: 'TRANSFER_IN',
};
const TRANSFER_OUT: Transfer = {
  caseId: TEST_CASE_ID,
  otherCaseId: NEW_CASE_ID,
  orderDate: '01-12-2024',
  divisionName: 'New Division',
  courtName: 'New Hotness Court',
  documentType: 'TRANSFER_OUT',
};

describe('Case detail basic information panel', () => {
  describe('With expected case detail properties', () => {
    beforeEach(() => {
      render(
        <BrowserRouter>
          <CaseDetailBasicInfo caseDetail={BASE_TEST_CASE_DETAIL} showReopenDate={false} />
        </BrowserRouter>,
      );
    });

    test('should show debtor counsel office', () => {
      const element = screen.queryByTestId('case-detail-debtor-counsel-office');
      expect(element).toBeInTheDocument();
      expect(element?.textContent).toEqual(BASE_TEST_CASE_DETAIL.debtorAttorney?.office);
    });
  });

  describe('With debtor counsel variations', () => {
    test('should not show office if not available', () => {
      const testCaseDetail: CaseDetail = { ...BASE_TEST_CASE_DETAIL };
      const debtorAttorney = testCaseDetail.debtorAttorney!;
      delete debtorAttorney.office;

      render(
        <BrowserRouter>
          <CaseDetailBasicInfo caseDetail={testCaseDetail} showReopenDate={false} />
        </BrowserRouter>,
      );

      const element = screen.queryByTestId('case-detail-debtor-counsel-office');
      expect(element).not.toBeInTheDocument();
    });
  });

  describe('Transferred case information tests', () => {
    test('should display old case information', () => {
      const transferredCase = {
        ...BASE_TEST_CASE_DETAIL,
        transfers: [TRANSFER_IN],
      };
      render(
        <BrowserRouter>
          <CaseDetailBasicInfo caseDetail={transferredCase} showReopenDate={false} />
        </BrowserRouter>,
      );

      const oldCaseIdLink = screen.queryByTestId('case-detail-transfer-link-0');
      expect(oldCaseIdLink).toBeInTheDocument();
      expect(oldCaseIdLink?.textContent).toEqual(getCaseNumber(OLD_CASE_ID));

      const oldCaseOrderDate = screen.queryByTestId('case-detail-transfer-order-0');
      expect(oldCaseOrderDate).toBeInTheDocument();
      expect(oldCaseOrderDate?.textContent).toEqual(formatDate(TRANSFER_IN.orderDate));

      const oldCaseCourt = screen.queryByTestId('case-detail-transfer-court-0');
      expect(oldCaseCourt).toBeInTheDocument();
      expect(oldCaseCourt?.textContent).toEqual(
        `${TRANSFER_IN.courtName} - ${TRANSFER_IN.divisionName}`,
      );
    });

    test('should display new case information', () => {
      const transferredCase = {
        ...BASE_TEST_CASE_DETAIL,
        transfers: [TRANSFER_OUT],
      };
      render(
        <BrowserRouter>
          <CaseDetailBasicInfo caseDetail={transferredCase} showReopenDate={false} />
        </BrowserRouter>,
      );

      const newCaseIdLink = screen.queryByTestId('case-detail-transfer-link-0');
      expect(newCaseIdLink).toBeInTheDocument();
      expect(newCaseIdLink?.textContent).toEqual(getCaseNumber(NEW_CASE_ID));

      const newCaseOrderDate = screen.queryByTestId('case-detail-transfer-order-0');
      expect(newCaseOrderDate).toBeInTheDocument();
      expect(newCaseOrderDate?.textContent).toEqual(formatDate(TRANSFER_OUT.orderDate));

      const newCaseCourt = screen.queryByTestId('case-detail-transfer-court-0');
      expect(newCaseCourt).toBeInTheDocument();
      expect(newCaseCourt?.textContent).toEqual(
        `${TRANSFER_OUT.courtName} - ${TRANSFER_OUT.divisionName}`,
      );
    });

    test('should display old and new case information', () => {
      const transferredCase = {
        ...BASE_TEST_CASE_DETAIL,
        transfers: [TRANSFER_IN, TRANSFER_OUT],
      };
      render(
        <BrowserRouter>
          <CaseDetailBasicInfo caseDetail={transferredCase} showReopenDate={false} />
        </BrowserRouter>,
      );

      const newCaseIdLink = screen.queryByTestId('case-detail-transfer-link-0');
      expect(newCaseIdLink).toBeInTheDocument();
      expect(newCaseIdLink?.textContent).toEqual(getCaseNumber(NEW_CASE_ID));

      const newCaseOrderDate = screen.queryByTestId('case-detail-transfer-order-0');
      expect(newCaseOrderDate).toBeInTheDocument();
      expect(newCaseOrderDate?.textContent).toEqual(formatDate(TRANSFER_OUT.orderDate));

      const newCaseCourt = screen.queryByTestId('case-detail-transfer-court-0');
      expect(newCaseCourt).toBeInTheDocument();
      expect(newCaseCourt?.textContent).toEqual(
        `${TRANSFER_OUT.courtName} - ${TRANSFER_OUT.divisionName}`,
      );

      const oldCaseIdLink = screen.queryByTestId('case-detail-transfer-link-1');
      expect(oldCaseIdLink).toBeInTheDocument();
      expect(oldCaseIdLink?.textContent).toEqual(getCaseNumber(OLD_CASE_ID));

      const oldCaseOrderDate = screen.queryByTestId('case-detail-transfer-order-1');
      expect(oldCaseOrderDate).toBeInTheDocument();
      expect(oldCaseOrderDate?.textContent).toEqual(formatDate(TRANSFER_IN.orderDate));

      const oldCaseCourt = screen.queryByTestId('case-detail-transfer-court-1');
      expect(oldCaseCourt).toBeInTheDocument();
      expect(oldCaseCourt?.textContent).toEqual(
        `${TRANSFER_IN.courtName} - ${TRANSFER_IN.divisionName}`,
      );
    });
  });
});
