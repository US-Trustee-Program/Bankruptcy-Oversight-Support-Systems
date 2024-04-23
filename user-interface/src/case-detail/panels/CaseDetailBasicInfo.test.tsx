import { BrowserRouter } from 'react-router-dom';
import CaseDetailBasicInfo, { CaseDetailBasicInfoProps } from './CaseDetailBasicInfo';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { formatDate } from '@/lib/utils/datetime';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import { Consolidation, Transfer } from '@common/cams/events';
import { CaseDetail } from '@common/cams/cases';
import { MockData } from '@common/cams/test-utilities/mock-data';
import { Attorney } from '@/lib/type-declarations/attorneys';
import { getFullName } from '@common/name-helper';
import Api from '@/lib/models/api';

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
const CONSOLIDATE_TO: Consolidation = {
  caseId: TEST_CASE_ID,
  otherCase: MockData.getCaseSummary({ override: { caseId: NEW_CASE_ID } }),
  orderDate: '01-12-2024',
  consolidationType: 'administrative',
  documentType: 'CONSOLIDATION_TO',
};

const CONSOLIDATE_FROM: Consolidation = {
  caseId: TEST_CASE_ID,
  otherCase: MockData.getCaseSummary({ override: { caseId: NEW_CASE_ID } }),
  orderDate: '01-12-2024',
  consolidationType: 'administrative',
  documentType: 'CONSOLIDATION_FROM',
};

const attorneyList: Attorney[] = [
  {
    firstName: 'Joe',
    lastName: 'Bob',
    office: 'Your office',
  },
  {
    firstName: 'Francis',
    lastName: 'Jones',
    office: 'His office',
  },
];

describe('Case detail basic information panel', () => {
  function renderWithProps(props?: Partial<CaseDetailBasicInfoProps>) {
    const defaultProps: CaseDetailBasicInfoProps = {
      caseDetail: BASE_TEST_CASE_DETAIL,
      showReopenDate: false,
      attorneyList: attorneyList,
      onCaseAssignment: vi.fn(),
    };

    const renderProps = { ...defaultProps, ...props };
    render(
      <BrowserRouter>
        <CaseDetailBasicInfo {...renderProps} />
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

    test('should show edit button for trial attorney assignments and open modal with correct trial attorney info', () => {
      renderWithProps();
      const element = screen.getByTestId('toggle-modal-button');
      expect(element).toBeInTheDocument();
      expect(element).toBeVisible();
      fireEvent.click(element);
      const attorneyModal = document.querySelector('.assign-attorney-modal');
      expect(attorneyModal).toBeInTheDocument();
      expect(attorneyModal).toBeVisible();

      attorneyList.forEach((attorney, idx) => {
        const attorneyLabel = screen.getByTestId(`checkbox-label-${idx}-checkbox`);
        expect(attorneyLabel).toHaveTextContent(getFullName(attorney));
      });
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

  describe('for case assignment', () => {
    const assignmentModalId = 'assignmentModalId';

    test('should call handleCaseAssignment callback when callback provided', async () => {
      const apiResult = {
        message: 'post mock',
        count: 0,
        body: {},
      };
      vi.spyOn(Api, 'post').mockResolvedValue(apiResult);

      const caseDetail: CaseDetail = { ...BASE_TEST_CASE_DETAIL };
      const onCaseAssignment = vi.fn();
      renderWithProps({
        caseDetail,
        onCaseAssignment,
      });

      const assignedStaffEditButton = screen.getByTestId('toggle-modal-button');
      fireEvent.click(assignedStaffEditButton);

      const modal = screen.getByTestId(`modal-${assignmentModalId}`);
      await waitFor(() => {
        expect(modal).toBeVisible();
      });

      const checkbox = screen.getByTestId('checkbox-0-checkbox');
      fireEvent.click(checkbox);

      const submitButton = screen.getByTestId(`button-${assignmentModalId}-submit-button`);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(onCaseAssignment).toHaveBeenCalledWith(
          expect.objectContaining({
            apiResult,
          }),
        );
      });

      await waitFor(() => {
        expect(modal).toHaveClass('is-hidden');
      });
    });
  });

  describe('with consolidated case information', () => {
    const assignmentModalId = 'assignmentModalId';

    test('should show the consolidation type', async () => {
      renderWithProps({
        caseDetail: {
          ...BASE_TEST_CASE_DETAIL,
          consolidation: [{ ...CONSOLIDATE_TO, consolidationType: 'administrative' }],
        },
      });
      const administrativeHeader = document.querySelector('.consolidation > h4');
      expect(administrativeHeader).toBeInTheDocument();
      expect(administrativeHeader).toHaveTextContent('Joint Administration');

      renderWithProps({
        caseDetail: {
          ...BASE_TEST_CASE_DETAIL,
          consolidation: [{ ...CONSOLIDATE_TO, consolidationType: 'substantive' }],
        },
      });
      const substantiveHeader = document.querySelector('.consolidation > h4');
      expect(substantiveHeader).toBeInTheDocument();
      expect(substantiveHeader).toHaveTextContent('Joint Administration');
    });

    test('should show lead case summary content', async () => {
      const leadCase = CONSOLIDATE_TO.otherCase;
      renderWithProps({
        caseDetail: { ...BASE_TEST_CASE_DETAIL, consolidation: [CONSOLIDATE_TO] },
      });

      const link = screen.queryByTestId('case-detail-consolidation-link-link');
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', `/case-detail/${leadCase.caseId}/`);

      const contentLines = document.querySelectorAll('.consolidation > div');
      expect(contentLines.length).toEqual(2);
      expect(contentLines[0]).toHaveTextContent(
        `Lead Case:${getCaseNumber(leadCase.caseId)} ${leadCase.caseTitle}`,
      );
      expect(contentLines[1]).toHaveTextContent(
        `Order Filed:${formatDate(CONSOLIDATE_TO.orderDate)}`,
      );
    });

    test('should show child case summary content', async () => {
      const caseDetail: CaseDetail = {
        ...BASE_TEST_CASE_DETAIL,
        consolidation: [CONSOLIDATE_FROM],
      };
      renderWithProps({
        caseDetail,
      });

      const contentLines = document.querySelectorAll('.consolidation > div');
      expect(contentLines.length).toEqual(3);
      expect(contentLines[0]).toHaveTextContent('Lead Case: (this case)');
      expect(contentLines[1]).toHaveTextContent(
        `Cases Consolidated: ${caseDetail.consolidation!.length + 1}`,
      );
      expect(contentLines[2]).toHaveTextContent(
        `Order Filed:${formatDate(CONSOLIDATE_FROM.orderDate)}`,
      );
    });

    test('should show child case warning on case assignment modal', async () => {
      const caseDetail: CaseDetail = { ...BASE_TEST_CASE_DETAIL, consolidation: [CONSOLIDATE_TO] };
      const onCaseAssignment = vi.fn();
      renderWithProps({
        caseDetail,
        onCaseAssignment,
      });

      const assignedStaffEditButton = screen.getByTestId('toggle-modal-button');
      fireEvent.click(assignedStaffEditButton);

      const modal = screen.getByTestId(`modal-${assignmentModalId}`);
      await waitFor(() => {
        expect(modal).toBeVisible();
      });

      const childCaseMessage = screen.getByTestId('alert-message');
      expect(childCaseMessage).toHaveTextContent(
        'The assignees for this case will not match the lead case.',
      );
    });
  });

  describe('Transferred case information tests', () => {
    test('should display old case information', () => {
      const transferredCase = {
        ...BASE_TEST_CASE_DETAIL,
        transfers: [TRANSFER_FROM],
      };

      renderWithProps({ caseDetail: transferredCase, showReopenDate: false });

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
      const transferredCase = {
        ...BASE_TEST_CASE_DETAIL,
        transfers: [TRANSFER_TO],
      };

      renderWithProps({ caseDetail: transferredCase, showReopenDate: false });

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
      const transferredCase = {
        ...BASE_TEST_CASE_DETAIL,
        transfers: [TRANSFER_FROM, TRANSFER_TO],
      };

      renderWithProps({ caseDetail: transferredCase, showReopenDate: false });

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
