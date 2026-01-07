import { BrowserRouter } from 'react-router-dom';
import CaseDetailOverview, { CaseDetailOverviewProps } from './CaseDetailOverview';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CaseDetail } from '@common/cams/cases';
import MockData from '@common/cams/test-utilities/mock-data';
import Actions from '@common/cams/actions';
import { AttorneyUser, CamsUser, Staff } from '@common/cams/users';
import { MockAttorneys } from '@common/cams/test-utilities/attorneys.mock';
import { CamsRole, OversightRoleType } from '@common/cams/roles';
import LocalStorage from '@/lib/utils/local-storage';
import { ResponseBody } from '@common/api/response';
import Api2 from '@/lib/models/api2';
import TestingUtilities from '@/lib/testing/testing-utilities';
import * as FeatureFlagHook from '@/lib/hooks/UseFeatureFlags';

const TEST_CASE_ID = '101-23-12345';
const TEST_TRIAL_ATTORNEY_1 = MockAttorneys.Brian;
const TEST_ASSIGNMENT_1 = MockData.getAttorneyAssignment({ ...TEST_TRIAL_ATTORNEY_1 });
const TEST_TRIAL_ATTORNEY_2 = MockAttorneys.Carl;
const TEST_ASSIGNMENT_2 = MockData.getAttorneyAssignment({ ...TEST_TRIAL_ATTORNEY_2 });
const TEST_JUDGE_NAME = 'Rick B Hart';
const TEST_DEBTOR_ATTORNEY = MockData.getDebtorAttorney();
const BASE_TEST_CASE_DETAIL = MockData.getCaseDetail({
  override: {
    caseId: TEST_CASE_ID,
    chapter: '15',
    judgeName: TEST_JUDGE_NAME,
    assignments: [TEST_ASSIGNMENT_1, TEST_ASSIGNMENT_2],
    debtorAttorney: TEST_DEBTOR_ATTORNEY,
    _actions: [Actions.ManageAssignments],
  },
});

const attorneyList: AttorneyUser[] = MockData.buildArray(MockData.getAttorneyUser, 2);

describe('Case detail basic information panel', () => {
  const staffByRole: Record<OversightRoleType, Staff[]> = {
    [CamsRole.OversightAttorney]: attorneyList,
    [CamsRole.OversightAuditor]: [],
    [CamsRole.OversightParalegal]: [],
  };
  const attorneyListResponse: ResponseBody<Record<OversightRoleType, Staff[]>> = {
    meta: { self: 'self-url' },
    data: staffByRole,
  };
  vi.spyOn(Api2, 'getOversightStaff').mockResolvedValue(attorneyListResponse);

  function renderWithProps(props?: Partial<CaseDetailOverviewProps>) {
    const defaultProps: CaseDetailOverviewProps = {
      caseDetail: BASE_TEST_CASE_DETAIL,
      showReopenDate: false,
      onCaseAssignment: vi.fn(),
    };

    const renderProps = { ...defaultProps, ...props };
    render(
      <BrowserRouter>
        <CaseDetailOverview {...renderProps} />
      </BrowserRouter>,
    );
  }

  beforeEach(() => {
    const mockFeatureFlags = {
      [FeatureFlagHook.VIEW_TRUSTEE_ON_CASE]: false,
    };
    vi.spyOn(FeatureFlagHook, 'default').mockReturnValue(mockFeatureFlags);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('With expected case detail properties', () => {
    test('should show debtor counsel office', () => {
      renderWithProps();
      const element = screen.queryByTestId('case-detail-debtor-counsel-office');
      expect(element).toBeInTheDocument();
      expect(element?.textContent).toEqual(BASE_TEST_CASE_DETAIL.debtorAttorney?.office);
    });

    test('should not show assigned staff information if the feature flag is disabled', () => {
      vi.spyOn(FeatureFlagHook, 'default').mockReturnValue({
        [FeatureFlagHook.VIEW_TRUSTEE_ON_CASE]: true,
      });
      renderWithProps();
      const element = document.querySelector('.assigned-staff-information');
      expect(element).not.toBeInTheDocument();
    });

    test('should show edit button and open the staff assignment modal if the user is a case assignment manager', async () => {
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
      await TestingUtilities.waitForDocumentBody();

      const attorneyModal = document.querySelector('.assign-attorney-modal');
      expect(attorneyModal).toBeInTheDocument();
      expect(attorneyModal).toBeVisible();
      expect(modal).toHaveClass('is-visible');
    });

    test('should not show edit button for trial attorney assignments', () => {
      const caseDetailNoActions = MockData.getCaseDetail({
        override: {
          caseId: TEST_CASE_ID,
          chapter: '15',
          judgeName: TEST_JUDGE_NAME,
          assignments: [TEST_ASSIGNMENT_1, TEST_ASSIGNMENT_2],
          debtorAttorney: TEST_DEBTOR_ATTORNEY,
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

      await TestingUtilities.selectCheckbox('0-checkbox');

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
});
