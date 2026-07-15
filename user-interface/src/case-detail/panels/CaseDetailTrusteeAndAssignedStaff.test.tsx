import { BrowserRouter } from 'react-router-dom';
import CaseDetailTrusteeAndAssignedStaff, {
  CaseDetailTrusteeAndAssignedStaffProps,
} from './CaseDetailTrusteeAndAssignedStaff';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MockData from '@common/cams/test-utilities/mock-data';
import Actions from '@common/cams/actions';
import { AttorneyUser, CamsUser, Staff } from '@common/cams/users';
import { MockAttorneys } from '@common/cams/test-utilities/attorneys.mock';
import { CamsRole, OversightRoleType } from '@common/cams/roles';
import LocalStorage from '@/lib/utils/local-storage';
import { ResponseBody } from '@common/api/response';
import Api2 from '@/lib/models/api2';
import TestingUtilities from '@/lib/testing/testing-utilities';
import { Consolidation } from '@common/cams/events';

const TEST_CASE_ID = '101-23-12345';
const TEST_TRIAL_ATTORNEY_1 = MockAttorneys.Brian;
const TEST_ASSIGNMENT_1 = MockData.getAttorneyAssignment({ ...TEST_TRIAL_ATTORNEY_1 });
const TEST_TRIAL_ATTORNEY_2 = MockAttorneys.Carl;
const TEST_ASSIGNMENT_2 = MockData.getAttorneyAssignment({ ...TEST_TRIAL_ATTORNEY_2 });
const TEST_TRUSTEE = MockData.getLegacyTrustee();

const CONSOLIDATE_FROM: Consolidation = {
  caseId: TEST_CASE_ID,
  otherCase: MockData.getCaseSummary({ override: { caseId: '222-24-00001' } }),
  orderDate: '01-12-2024',
  consolidationType: 'administrative',
  documentType: 'CONSOLIDATION_FROM',
  updatedBy: MockData.getCamsUser(),
  updatedOn: '01-12-2024',
};

const CONSOLIDATE_TO: Consolidation = {
  caseId: TEST_CASE_ID,
  otherCase: MockData.getCaseSummary({ override: { caseId: '222-24-00001' } }),
  orderDate: '01-12-2024',
  consolidationType: 'administrative',
  documentType: 'CONSOLIDATION_TO',
  updatedBy: MockData.getCamsUser(),
  updatedOn: '01-12-2024',
};

const BASE_TEST_CASE_DETAIL = MockData.getCaseDetail({
  override: {
    caseId: TEST_CASE_ID,
    chapter: '15',
    assignments: [TEST_ASSIGNMENT_1, TEST_ASSIGNMENT_2],
    trustee: TEST_TRUSTEE,
    _actions: [Actions.ManageAssignments],
    consolidation: [CONSOLIDATE_FROM],
  },
});

const attorneyList: AttorneyUser[] = MockData.buildArray(MockData.getAttorneyUser, 2);

describe('CaseDetailTrusteeAndAssignedStaff', () => {
  const staffByRole: Record<OversightRoleType, Staff[]> = {
    [CamsRole.OversightAttorney]: attorneyList,
    [CamsRole.OversightAuditor]: [],
    [CamsRole.OversightParalegal]: [],
  };
  const attorneyListResponse: ResponseBody<Record<OversightRoleType, Staff[]>> = {
    meta: { self: 'self-url' },
    data: staffByRole,
  };

  // Mock for AssignAttorneyModal
  const officeAttorneyListResponse: ResponseBody<AttorneyUser[]> = {
    meta: { self: 'self-url' },
    data: attorneyList,
  };

  beforeEach(() => {
    vi.spyOn(Api2, 'getOversightStaff').mockResolvedValue(attorneyListResponse);
    vi.spyOn(Api2, 'getOfficeAttorneys').mockResolvedValue(officeAttorneyListResponse);
  });

  function renderWithProps(props?: Partial<CaseDetailTrusteeAndAssignedStaffProps>) {
    const defaultProps: CaseDetailTrusteeAndAssignedStaffProps = {
      caseDetail: BASE_TEST_CASE_DETAIL,
      onCaseAssignment: vi.fn(),
    };

    const renderProps = { ...defaultProps, ...props };
    render(
      <BrowserRouter>
        <CaseDetailTrusteeAndAssignedStaff {...renderProps} />
      </BrowserRouter>,
    );
  }

  describe('Assigned Staff Section', () => {
    test('should render the assigned staff section with proper heading', () => {
      renderWithProps();
      const heading = screen.getByRole('heading', { name: /assigned staff/i });
      expect(heading).toBeInTheDocument();
    });

    test('should show region and office information when available', () => {
      renderWithProps();
      const regionElement = screen.queryByTestId('case-detail-region-id');
      expect(regionElement).toBeInTheDocument();
      expect(regionElement?.textContent).toEqual(
        `Region ${BASE_TEST_CASE_DETAIL.regionId?.replace(/^0*/, '')} - ${BASE_TEST_CASE_DETAIL.officeName} Office`,
      );
    });

    test('should not show region information when not available', () => {
      const caseDetailNoRegion = MockData.getCaseDetail({
        override: {
          ...BASE_TEST_CASE_DETAIL,
          regionId: '',
          officeName: '',
        },
      });
      renderWithProps({ caseDetail: caseDetailNoRegion });
      const regionElement = screen.queryByTestId('case-detail-region-id');
      expect(regionElement).not.toBeInTheDocument();
    });

    test('should show unassigned placeholder when no assignments exist', () => {
      const caseDetailNoAssignments = {
        ...BASE_TEST_CASE_DETAIL,
        assignments: [],
      };
      renderWithProps({ caseDetail: caseDetailNoAssignments });
      const placeholder = screen.getByText('(unassigned)');
      expect(placeholder).toBeInTheDocument();
    });

    test('should show unassigned placeholder when assignments is undefined', () => {
      const caseDetailUndefinedAssignments = {
        ...BASE_TEST_CASE_DETAIL,
        assignments: undefined,
      };
      renderWithProps({ caseDetail: caseDetailUndefinedAssignments });
      const placeholder = screen.getByText('(unassigned)');
      expect(placeholder).toBeInTheDocument();
    });

    test('should display leadTrialAttorney with Lead Trial Attorney role label', () => {
      const leadAttorney = { id: 'lead-1', name: 'Lead Attorney Name' };
      const caseDetailWithLead = {
        ...BASE_TEST_CASE_DETAIL,
        assignments: [],
        leadTrialAttorney: leadAttorney,
      };
      renderWithProps({ caseDetail: caseDetailWithLead });

      const assigneeNames = screen.getAllByText((_content, element) => {
        return element?.classList.contains('assignee-name') || false;
      });
      expect(assigneeNames[0]).toHaveTextContent(leadAttorney.name);
      expect(
        screen.getByText('Lead Trial Attorney', { selector: '.assignee-role' }),
      ).toBeInTheDocument();
    });

    test('should not show unassigned placeholder when leadTrialAttorney is set', () => {
      const leadAttorney = { id: 'lead-1', name: 'Lead Attorney' };
      const caseDetailWithLead = {
        ...BASE_TEST_CASE_DETAIL,
        assignments: [],
        leadTrialAttorney: leadAttorney,
      };
      renderWithProps({ caseDetail: caseDetailWithLead });

      expect(screen.queryByText('(unassigned)')).not.toBeInTheDocument();
    });

    test('should not render lead trial attorney in the trial attorney list (deduplication)', () => {
      const caseDetailWithLead = {
        ...BASE_TEST_CASE_DETAIL,
        leadTrialAttorney: { id: TEST_ASSIGNMENT_1.userId, name: TEST_TRIAL_ATTORNEY_1.name },
      };
      renderWithProps({ caseDetail: caseDetailWithLead });

      expect(
        screen.getByText('Lead Trial Attorney', { selector: '.assignee-role' }),
      ).toBeInTheDocument();

      // TEST_ASSIGNMENT_1 should only appear once total (as Lead, not also as Trial Attorney)
      const assigneeNames = screen.getAllByText((_content, element) => {
        return element?.classList.contains('assignee-name') || false;
      });
      const leadCount = assigneeNames.filter((el) =>
        el.textContent?.includes(TEST_TRIAL_ATTORNEY_1.name),
      );
      expect(leadCount).toHaveLength(1);

      // Only TEST_ASSIGNMENT_2 should appear as Trial Attorney
      expect(screen.getByText('Trial Attorney')).toBeInTheDocument();
      const trialRoles = screen.getAllByText('Trial Attorney');
      expect(trialRoles).toHaveLength(1);
    });

    test('should render list of assigned staff with names and roles', () => {
      renderWithProps();

      // Check that assignments are rendered
      const assigneeNames = screen.getAllByText((_content, element) => {
        return element?.classList.contains('assignee-name') || false;
      });
      expect(assigneeNames).toHaveLength(2);
      expect(assigneeNames[0]).toHaveTextContent(TEST_TRIAL_ATTORNEY_1.name);
      expect(assigneeNames[1]).toHaveTextContent(TEST_TRIAL_ATTORNEY_2.name);

      // Check that roles are shown
      const roles = screen.getAllByText('Trial Attorney');
      expect(roles).toHaveLength(2);
    });

    describe('Edit Button Visibility (canEditAssignedStaff)', () => {
      // Tests for the canEditAssignedStaff helper function logic:
      // Button should show when:
      //   - User has ManageAssignments permission
      //   - Case is chapter 15
      //   - Case is NOT a consolidation member case
      // Button should be hidden for consolidation member cases only

      test('should not show edit button when user lacks ManageAssignments action', () => {
        const caseDetailNoActions = {
          ...BASE_TEST_CASE_DETAIL,
          _actions: [],
        };
        renderWithProps({ caseDetail: caseDetailNoActions });
        const editButton = screen.queryByTestId('open-modal-button');
        expect(editButton).not.toBeInTheDocument();
      });

      test('should not show edit button for non-chapter 15 cases', () => {
        const caseDetailChapter7 = {
          ...BASE_TEST_CASE_DETAIL,
          chapter: '7',
        };
        renderWithProps({ caseDetail: caseDetailChapter7 });
        const editButton = screen.queryByTestId('open-modal-button');
        expect(editButton).not.toBeInTheDocument();
      });

      test('should not show edit button for consolidation member cases', () => {
        const user: CamsUser = MockData.getCamsUser({
          roles: [CamsRole.CaseAssignmentManager],
        });
        vi.spyOn(LocalStorage, 'getSession').mockReturnValue(MockData.getCamsSession({ user }));

        const caseDetailMemberCase = {
          ...BASE_TEST_CASE_DETAIL,
          consolidation: [CONSOLIDATE_TO], // CONSOLIDATION_TO means this is a member case
        };
        renderWithProps({ caseDetail: caseDetailMemberCase });
        const editButton = screen.queryByTestId('open-modal-button');
        expect(editButton).not.toBeInTheDocument();
      });

      test('should show edit button for consolidation lead cases', () => {
        const user: CamsUser = MockData.getCamsUser({
          roles: [CamsRole.CaseAssignmentManager],
        });
        vi.spyOn(LocalStorage, 'getSession').mockReturnValue(MockData.getCamsSession({ user }));

        const caseDetailLeadCase = {
          ...BASE_TEST_CASE_DETAIL,
          consolidation: [CONSOLIDATE_FROM], // CONSOLIDATION_FROM means this is a lead case
        };
        renderWithProps({ caseDetail: caseDetailLeadCase });
        const editButton = screen.queryByTestId('open-modal-button');
        expect(editButton).toBeInTheDocument();
        expect(editButton).toBeVisible();
      });

      test('should show edit button for non-consolidation cases', () => {
        const user: CamsUser = MockData.getCamsUser({
          roles: [CamsRole.CaseAssignmentManager],
        });
        vi.spyOn(LocalStorage, 'getSession').mockReturnValue(MockData.getCamsSession({ user }));

        const caseDetailNonConsolidation = {
          ...BASE_TEST_CASE_DETAIL,
          consolidation: [], // Empty consolidation array
        };
        renderWithProps({ caseDetail: caseDetailNonConsolidation });
        const editButton = screen.queryByTestId('open-modal-button');
        expect(editButton).toBeInTheDocument();
        expect(editButton).toBeVisible();
      });
    });

    test('should open assignment modal when edit button is clicked', async () => {
      const user: CamsUser = MockData.getCamsUser({
        roles: [CamsRole.CaseAssignmentManager],
      });
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(MockData.getCamsSession({ user }));

      renderWithProps();
      const modal = document.querySelector('.usa-modal-wrapper');
      expect(modal).toBeInTheDocument();
      expect(modal).not.toHaveClass('is-visible');

      const editButton = screen.getByTestId('open-modal-button');
      fireEvent.click(editButton);
      await TestingUtilities.waitForDocumentBody();

      const attorneyModal = document.querySelector('.assign-attorney-modal');
      expect(attorneyModal).toBeInTheDocument();
      expect(attorneyModal).toBeVisible();
      expect(modal).toHaveClass('is-visible');
    });
  });

  describe('Modal and Assignment Functionality', () => {
    const assignmentModalId = 'assignmentModalId';

    test('should call handleCaseAssignment callback when assignment is completed', async () => {
      const apiResult = {
        data: undefined,
      };
      const userEvent = TestingUtilities.setupUserEvent();
      vi.spyOn(Api2, 'postStaffAssignments').mockResolvedValue(apiResult);

      const onCaseAssignment = vi.fn();
      // Use a case with no existing assignments so selecting 1 attorney auto-selects them as lead,
      // satisfying the LeadTrialAttorney requirement before submitting.
      renderWithProps({
        onCaseAssignment,
        caseDetail: { ...BASE_TEST_CASE_DETAIL, assignments: [] },
      });

      const assignedStaffEditButton = screen.getByTestId('open-modal-button');
      await userEvent.click(assignedStaffEditButton);

      const modal = screen.getByTestId(`modal-${assignmentModalId}`);
      await waitFor(() => {
        expect(modal).toBeVisible();
      });

      // Wait for attorney list to load (API call completes)
      await waitFor(() => {
        expect(Api2.getOfficeAttorneys).toHaveBeenCalled();
      });

      // Wait for attorney list to render and select first attorney
      // Attorneys are sorted alphabetically, select the first one
      await waitFor(() => {
        expect(document.querySelector('.attorney-list-checkbox')).toBeInTheDocument();
      });

      const sortedAttorneys = [...attorneyList].sort((a, b) => a.name.localeCompare(b.name));
      await TestingUtilities.selectCheckbox(`attorney-${sortedAttorneys[0].id}-checkbox`);

      const submitButton = screen.getByTestId(`button-${assignmentModalId}-submit-button`);
      await userEvent.click(submitButton);

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

    test('should not show joint administration warning for lead cases', async () => {
      const onCaseAssignment = vi.fn();
      renderWithProps({ onCaseAssignment });

      const assignedStaffEditButton = screen.getByTestId('open-modal-button');
      fireEvent.click(assignedStaffEditButton);

      const modal = screen.getByTestId(`modal-${assignmentModalId}`);
      await waitFor(() => {
        expect(modal).toBeVisible();
      });

      const memberCaseMessage = screen.queryByTestId('alert-message');
      expect(memberCaseMessage).not.toBeInTheDocument();
    });
  });
});
