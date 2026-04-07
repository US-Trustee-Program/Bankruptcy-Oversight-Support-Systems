import { BrowserRouter } from 'react-router-dom';
import CaseDetailOverview, { CaseDetailOverviewProps } from './CaseDetailOverview';
import { render, screen } from '@testing-library/react';
import { CaseDetail } from '@common/cams/cases';
import MockData from '@common/cams/test-utilities/mock-data';

const TEST_CASE_ID = '101-23-12345';
const TEST_DEBTOR_ATTORNEY = MockData.getDebtorAttorney();
const BASE_TEST_CASE_DETAIL = MockData.getCaseDetail({
  override: {
    caseId: TEST_CASE_ID,
    chapter: '15',
    debtorAttorney: TEST_DEBTOR_ATTORNEY,
  },
});

describe('Case detail overview panel', () => {
  function renderWithProps(props?: Partial<CaseDetailOverviewProps>) {
    const defaultProps: CaseDetailOverviewProps = {
      caseDetail: BASE_TEST_CASE_DETAIL,
      showReopenDate: false,
    };

    const renderProps = { ...defaultProps, ...props };
    render(
      <BrowserRouter>
        <CaseDetailOverview {...renderProps} />
      </BrowserRouter>,
    );
  }

  describe('With expected case detail properties', () => {
    test('should show debtor counsel office', () => {
      renderWithProps();
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

      renderWithProps({ caseDetail: testCaseDetail, showReopenDate: false });

      const element = screen.queryByTestId('case-detail-debtor-counsel-office');
      expect(element).not.toBeInTheDocument();
    });
  });
});
