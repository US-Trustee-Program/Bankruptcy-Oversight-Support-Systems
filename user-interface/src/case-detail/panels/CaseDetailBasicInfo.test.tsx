import { BrowserRouter } from 'react-router-dom';
import CaseDetailBasicInfo from './CaseDetailBasicInfo';
import { CaseDetailType, DebtorAttorney, Transfer } from '@/lib/type-declarations/chapter-15';
import { render, screen } from '@testing-library/react';
import { formatDate } from '@/lib/utils/datetime';

const TEST_CASE_ID = '101-23-12345';
const OLD_CASE_ID = '111-20-11111';
const NEW_CASE_ID = '222-24-00001';
const TEST_TRIAL_ATTORNEY_1 = 'Brian Wilson';
const TEST_TRIAL_ATTORNEY_2 = 'Carl Wilson';
const TEST_JUDGE_NAME = 'Rick B Hart';
const TEST_DEBTOR_ATTORNEY: DebtorAttorney = {
  name: 'Jane Doe',
  address1: '123 Rabbithole Lane',
  cityStateZipCountry: 'Ciudad Obregón GR 25443, MX',
  phone: '234-123-1234',
  email: 'janedoe@cubeddoe.com',
  office: 'Doe, Doe and Doe, PLC',
};
const BASE_TEST_CASE_DETAIL: CaseDetailType = {
  caseId: TEST_CASE_ID,
  chapter: '15',
  regionId: '02',
  officeName: 'New York',
  caseTitle: 'The Beach Boys',
  dateFiled: '01-04-1962',
  judgeName: TEST_JUDGE_NAME,
  courtName: 'Court of Law',
  courtDivisionName: 'Manhattan',
  debtorTypeLabel: 'Corporate Business',
  petitionLabel: 'Voluntary',
  closedDate: '01-08-1963',
  dismissedDate: '01-08-1964',
  assignments: [TEST_TRIAL_ATTORNEY_1, TEST_TRIAL_ATTORNEY_2],
  debtor: {
    name: 'Roger Rabbit',
    address1: '123 Rabbithole Lane',
    address2: 'Apt 117',
    address3: 'Suite C',
    cityStateZipCountry: 'Ciudad Obregón GR 25443, MX',
  },
  debtorAttorney: TEST_DEBTOR_ATTORNEY,
};

const TRANSFER_IN: Transfer = {
  caseId: TEST_CASE_ID,
  otherCaseId: OLD_CASE_ID,
  orderDate: '01-04-2023',
  divisionName: 'Old Division',
  courtName: 'Ye Olde Court',
  transferType: 'TRANSFER_IN',
};
const TRANSFER_OUT: Transfer = {
  caseId: TEST_CASE_ID,
  otherCaseId: NEW_CASE_ID,
  orderDate: '01-12-2024',
  divisionName: 'New Division',
  courtName: 'New Hotness Court',
  transferType: 'TRANSFER_OUT',
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
      const testCaseDetail: CaseDetailType = { ...BASE_TEST_CASE_DETAIL };
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
      expect(oldCaseIdLink?.textContent).toEqual(OLD_CASE_ID);

      const oldCaseOrderDate = screen.queryByTestId('case-detail-transfer-order-0');
      expect(oldCaseOrderDate).toBeInTheDocument();
      expect(oldCaseOrderDate?.textContent).toEqual(formatDate(TRANSFER_IN.orderDate));

      const oldCaseCourt = screen.queryByTestId('case-detail-transfer-court-0');
      expect(oldCaseCourt).toBeInTheDocument();
      expect(oldCaseCourt?.textContent).toEqual(
        `${TRANSFER_IN.divisionName} - ${TRANSFER_IN.courtName}`,
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
      expect(newCaseIdLink?.textContent).toEqual(NEW_CASE_ID);

      const newCaseOrderDate = screen.queryByTestId('case-detail-transfer-order-0');
      expect(newCaseOrderDate).toBeInTheDocument();
      expect(newCaseOrderDate?.textContent).toEqual(formatDate(TRANSFER_IN.orderDate));

      const newCaseCourt = screen.queryByTestId('case-detail-transfer-court-0');
      expect(newCaseCourt).toBeInTheDocument();
      expect(newCaseCourt?.textContent).toEqual(
        `${TRANSFER_IN.divisionName} - ${TRANSFER_IN.courtName}`,
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

      const oldCaseIdLink = screen.queryByTestId('case-detail-transfer-link-0');
      expect(oldCaseIdLink).toBeInTheDocument();
      expect(oldCaseIdLink?.textContent).toEqual(OLD_CASE_ID);

      const oldCaseOrderDate = screen.queryByTestId('case-detail-transfer-order-0');
      expect(oldCaseOrderDate).toBeInTheDocument();
      expect(oldCaseOrderDate?.textContent).toEqual(formatDate(TRANSFER_OUT.orderDate));

      const oldCaseCourt = screen.queryByTestId('case-detail-transfer-court-0');
      expect(oldCaseCourt).toBeInTheDocument();
      expect(oldCaseCourt?.textContent).toEqual(
        `${TRANSFER_OUT.divisionName} - ${TRANSFER_OUT.courtName}`,
      );

      const newCaseIdLink = screen.queryByTestId('case-detail-transfer-link-1');
      expect(newCaseIdLink).toBeInTheDocument();
      expect(newCaseIdLink?.textContent).toEqual(NEW_CASE_ID);

      const newCaseOrderDate = screen.queryByTestId('case-detail-transfer-order-1');
      expect(newCaseOrderDate).toBeInTheDocument();
      expect(newCaseOrderDate?.textContent).toEqual(formatDate(TRANSFER_OUT.orderDate));

      const newCaseCourt = screen.queryByTestId('case-detail-transfer-court-1');
      expect(newCaseCourt).toBeInTheDocument();
      expect(newCaseCourt?.textContent).toEqual(
        `${TRANSFER_OUT.divisionName} - ${TRANSFER_OUT.courtName}`,
      );
    });
  });
});
