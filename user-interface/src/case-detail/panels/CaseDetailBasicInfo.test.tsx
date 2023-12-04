import { BrowserRouter } from 'react-router-dom';
import CaseDetailBasicInfo from './CaseDetailBasicInfo';
import { CaseDetailType, DebtorAttorney } from '@/lib/type-declarations/chapter-15';
import { render, screen } from '@testing-library/react';

const TEST_CASE_ID = '101-23-12345';
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
});
