import Api2 from '@/lib/models/api2';
import testingUtilities from '@/lib/testing/testing-utilities';
import { getCaseNumber } from '@/lib/utils/caseNumber';
import { formatDate } from '@/lib/utils/datetime';
import LocalStorage from '@/lib/utils/local-storage';
import { ResponseBody } from '@common/api/response';
import Actions from '@common/cams/actions';
import { CaseDetail } from '@common/cams/cases';
import { Consolidation, Transfer } from '@common/cams/events';
import { CamsRole } from '@common/cams/roles';
import { MockAttorneys } from '@common/cams/test-utilities/attorneys.mock';
import { MockData } from '@common/cams/test-utilities/mock-data';
import { AttorneyUser, CamsUser } from '@common/cams/users';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

import CaseDetailOverview, { CaseDetailOverviewProps } from './CaseDetailOverview';

const TEST_CASE_ID = '101-23-12345';
const OLD_CASE_ID = '111-20-11111';
const NEW_CASE_ID = '222-24-00001';
const TEST_TRIAL_ATTORNEY_1 = MockAttorneys.Brian;
const TEST_ASSIGNMENT_1 = MockData.getAttorneyAssignment({ ...TEST_TRIAL_ATTORNEY_1 });
const TEST_TRIAL_ATTORNEY_2 = MockAttorneys.Carl;
const TEST_ASSIGNMENT_2 = MockData.getAttorneyAssignment({ ...TEST_TRIAL_ATTORNEY_2 });
const TEST_JUDGE_NAME = 'Rick B Hart';
const TEST_DEBTOR_ATTORNEY = MockData.getDebtorAttorney();
const BASE_TEST_CASE_DETAIL = MockData.getCaseDetail({
  override: {
    _actions: [Actions.ManageAssignments],
    assignments: [TEST_ASSIGNMENT_1, TEST_ASSIGNMENT_2],
    caseId: TEST_CASE_ID,
    chapter: '15',
    debtorAttorney: TEST_DEBTOR_ATTORNEY,
    judgeName: TEST_JUDGE_NAME,
  },
});
const TRANSFER_FROM: Transfer = {
  caseId: TEST_CASE_ID,
  documentType: 'TRANSFER_FROM',
  orderDate: '01-04-2023',
  otherCase: MockData.getCaseSummary({ override: { caseId: OLD_CASE_ID } }),
};
const TRANSFER_TO: Transfer = {
  caseId: TEST_CASE_ID,
  documentType: 'TRANSFER_TO',
  orderDate: '01-12-2024',
  otherCase: MockData.getCaseSummary({ override: { caseId: NEW_CASE_ID } }),
};
const CONSOLIDATE_TO: Consolidation = {
  caseId: TEST_CASE_ID,
  consolidationType: 'administrative',
  documentType: 'CONSOLIDATION_TO',
  orderDate: '01-12-2024',
  otherCase: MockData.getCaseSummary({ override: { caseId: NEW_CASE_ID } }),
  updatedBy: MockData.getCamsUser(),
  updatedOn: '01-12-2024',
};

const CONSOLIDATE_FROM: Consolidation = {
  caseId: TEST_CASE_ID,
  consolidationType: 'administrative',
  documentType: 'CONSOLIDATION_FROM',
  orderDate: '01-12-2024',
  otherCase: MockData.getCaseSummary({ override: { caseId: NEW_CASE_ID } }),
  updatedBy: MockData.getCamsUser(),
  updatedOn: '01-12-2024',
};

const attorneyList: AttorneyUser[] = MockData.buildArray(MockData.getAttorneyUser, 2);

describe('Case detail basic information panel', () => {
  const attorneyListResponse: ResponseBody<AttorneyUser[]> = {
    data: attorneyList,
    meta: { self: 'self-url' },
  };
  vi.spyOn(Api2, 'getAttorneys').mockResolvedValue(attorneyListResponse);

  function renderWithProps(props?: Partial<CaseDetailOverviewProps>) {
    const defaultProps: CaseDetailOverviewProps = {
      caseDetail: BASE_TEST_CASE_DETAIL,
      onCaseAssignment: vi.fn(),
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

    test('should show edit button and open the staff assignment modal if the user is a case assignment manager', () => {
      const user: CamsUser = MockData.getCamsUser({
        roles: [CamsRole.CaseAssignmentManager],
      });
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(MockData.getCamsSession({ user }));

      renderWithProps();
      const modal = document.querySelector('.usa-modal-wrapper');
      expect(modal).toBeInTheDocument();
      expect(modal).not.toHaveClass('is-visible');
      const element = screen.getByTestId('open-modal-button');
      expect(element).toBeInTheDocument();
      expect(element).toBeVisible();
      fireEvent.click(element);
      const attorneyModal = document.querySelector('.assign-attorney-modal');
      expect(attorneyModal).toBeInTheDocument();
      expect(attorneyModal).toBeVisible();
      expect(modal).toHaveClass('is-visible');
    });

    test('should not show edit button for trial attorney assignments', () => {
      const caseDetailNoActions = MockData.getCaseDetail({
        override: {
          assignments: [TEST_ASSIGNMENT_1, TEST_ASSIGNMENT_2],
          caseId: TEST_CASE_ID,
          chapter: '15',
          debtorAttorney: TEST_DEBTOR_ATTORNEY,
          judgeName: TEST_JUDGE_NAME,
        },
      });
      renderWithProps({ caseDetail: caseDetailNoActions });
      const element = screen.queryByTestId('open-modal-button');
      expect(element).not.toBeInTheDocument();
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
        data: undefined,
      };
      vi.spyOn(Api2, 'postStaffAssignments').mockResolvedValue(apiResult);

      const caseDetail: CaseDetail = { ...BASE_TEST_CASE_DETAIL };
      const onCaseAssignment = vi.fn();
      renderWithProps({
        caseDetail,
        onCaseAssignment,
      });

      const assignedStaffEditButton = screen.getByTestId('open-modal-button');
      fireEvent.click(assignedStaffEditButton);

      const modal = screen.getByTestId(`modal-${assignmentModalId}`);
      await waitFor(() => {
        expect(modal).toBeVisible();
      });

      testingUtilities.selectCheckbox('0-checkbox');

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

    test('should show the administrative consolidation header', async () => {
      renderWithProps({
        caseDetail: {
          ...BASE_TEST_CASE_DETAIL,
          consolidation: [{ ...CONSOLIDATE_TO, consolidationType: 'administrative' }],
        },
      });
      const administrativeHeader = document.querySelector('.consolidation > h4');
      expect(administrativeHeader).toBeInTheDocument();
      expect(administrativeHeader).toHaveTextContent('Joint Administration');
    });

    test('should show the substantive consolidation header', async () => {
      renderWithProps({
        caseDetail: {
          ...BASE_TEST_CASE_DETAIL,
          consolidation: [{ ...CONSOLIDATE_TO, consolidationType: 'substantive' }],
        },
      });
      const substantiveHeader = document.querySelector('.consolidation > h4');
      expect(substantiveHeader).toBeInTheDocument();
      expect(substantiveHeader).toHaveTextContent('Substantive Consolidation');
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

      const assignedStaffEditButton = screen.getByTestId('open-modal-button');
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
    test('should display information about case being transfered out when there is no verified transfer', async () => {
      const transferredCase = {
        ...BASE_TEST_CASE_DETAIL,
        transferDate: '2024-12-01',
      };
      renderWithProps({ caseDetail: transferredCase });

      expect(screen.queryByTestId('verified-transfer-header')).not.toBeInTheDocument();
      const ambiguousTransferText = screen.queryByTestId('ambiguous-transfer-text');
      expect(ambiguousTransferText).toHaveTextContent(
        'This case was transfered to another court. Review the docket for further details.',
      );
    });

    test('should display information about case being transfered in when there is no verified transfer', async () => {
      const transferredCase = {
        ...BASE_TEST_CASE_DETAIL,
        petitionCode: 'TI',
      };
      renderWithProps({ caseDetail: transferredCase });

      expect(screen.queryByTestId('verified-transfer-header')).not.toBeInTheDocument();
      const ambiguousTransferText = screen.queryByTestId('ambiguous-transfer-text');
      expect(ambiguousTransferText).toHaveTextContent(
        'This case was transfered from another court. Review the docket for further details.',
      );
    });

    test('should display old case information', () => {
      const transferredCase = {
        ...BASE_TEST_CASE_DETAIL,
        transfers: [TRANSFER_FROM],
      };

      renderWithProps({ caseDetail: transferredCase, showReopenDate: false });

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
      const transferredCase = {
        ...BASE_TEST_CASE_DETAIL,
        transfers: [TRANSFER_TO],
      };

      renderWithProps({ caseDetail: transferredCase, showReopenDate: false });

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
