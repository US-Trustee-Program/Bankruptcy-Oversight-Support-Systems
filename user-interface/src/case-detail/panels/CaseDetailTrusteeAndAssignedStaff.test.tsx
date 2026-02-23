import { BrowserRouter } from 'react-router-dom';
import CaseDetailTrusteeAndAssignedStaff, {
  CaseDetailTrusteeAndAssignedStaffProps,
} from './CaseDetailTrusteeAndAssignedStaff';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { getCaseNumber } from '@/lib/utils/caseNumber';
import MockData from '@common/cams/test-utilities/mock-data';
import { parsePhoneNumber } from '@common/phone-helper';
import Actions from '@common/cams/actions';
import { AttorneyUser, CamsUser, Staff } from '@common/cams/users';
import { MockAttorneys } from '@common/cams/test-utilities/attorneys.mock';
import { CamsRole, OversightRoleType } from '@common/cams/roles';
import LocalStorage from '@/lib/utils/local-storage';
import { ResponseBody } from '@common/api/response';
import Api2 from '@/lib/models/api2';
import TestingUtilities from '@/lib/testing/testing-utilities';
import { Consolidation } from '@common/cams/events';
import { CaseDetail } from '@common/cams/cases';

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

      test('should show edit button when all conditions are met', () => {
        const user: CamsUser = MockData.getCamsUser({
          roles: [CamsRole.CaseAssignmentManager],
        });
        vi.spyOn(LocalStorage, 'getSession').mockReturnValue(MockData.getCamsSession({ user }));

        renderWithProps();
        const editButton = screen.getByTestId('open-modal-button');
        expect(editButton).toBeInTheDocument();
        expect(editButton).toBeVisible();
      });

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

  describe('Trustee Section', () => {
    test('should render trustee section when trustee data exists', () => {
      renderWithProps();
      const trusteeHeading = screen.getByRole('heading', { name: /trustee/i });
      expect(trusteeHeading).toBeInTheDocument();
    });

    test('should not render trustee section when no trustee data', () => {
      const caseDetailNoTrustee = {
        ...BASE_TEST_CASE_DETAIL,
        trustee: undefined,
      };
      renderWithProps({ caseDetail: caseDetailNoTrustee });
      const trusteeHeading = screen.queryByRole('heading', { name: /trustee/i });
      expect(trusteeHeading).not.toBeInTheDocument();
    });

    test('should display trustee name', () => {
      renderWithProps();
      const trusteeName = document.querySelector('.trustee-name');
      expect(trusteeName).toBeInTheDocument();
      expect(trusteeName?.textContent).toEqual(TEST_TRUSTEE.name);
    });

    test('should display trustee email as mailto link with proper subject and icon', () => {
      renderWithProps();
      const emailElement = screen.queryByTestId('case-detail-trustee-email');
      expect(emailElement).toBeInTheDocument();

      const emailLink = emailElement?.querySelector('a');
      expect(emailLink).toBeInTheDocument();
      expect(emailLink?.textContent).toContain(TEST_TRUSTEE.legacy?.email);
      const expectedSubject = encodeURIComponent(
        `${getCaseNumber(BASE_TEST_CASE_DETAIL.caseId)} - ${BASE_TEST_CASE_DETAIL.caseTitle}`,
      );
      expect(emailLink?.getAttribute('href')).toEqual(
        `mailto:${TEST_TRUSTEE.legacy?.email}?subject=${expectedSubject}`,
      );

      // Verify mail icon is present
      const mailIcon = emailElement?.querySelector('.usa-icon');
      expect(mailIcon).toBeInTheDocument();
    });

    test('should display trustee phone number as clickable link', () => {
      renderWithProps();
      const phoneElement = screen.getByTestId('case-detail-trustee-phone-number');
      expect(phoneElement).toBeInTheDocument();

      // Phone is now rendered via CommsLink with parsePhoneNumber formatting
      const parsedPhone = parsePhoneNumber(TEST_TRUSTEE.legacy?.phone ?? '');
      const expectedLabel = parsedPhone?.extension
        ? `${parsedPhone.number} ext. ${parsedPhone.extension}`
        : (parsedPhone?.number ?? '');
      expect(phoneElement?.textContent).toEqual(expectedLabel);

      // Verify phone is a clickable link with aria-label
      const phoneLink = phoneElement?.querySelector('a');
      expect(phoneLink).toHaveAttribute('aria-label', `Phone: ${expectedLabel}`);
    });

    test('should display all trustee address fields', () => {
      renderWithProps();

      const address1Element = screen.getByTestId('case-detail-trustee-address1');
      const address2Element = screen.getByTestId('case-detail-trustee-address2');
      const address3Element = screen.getByTestId('case-detail-trustee-address3');

      expect(address1Element).toBeInTheDocument();
      expect(address2Element).toBeInTheDocument();
      expect(address3Element).toBeInTheDocument();

      expect(address1Element?.textContent).toEqual(TEST_TRUSTEE.legacy?.address1);
      expect(address2Element?.textContent).toEqual(TEST_TRUSTEE.legacy?.address2);
      expect(address3Element?.textContent).toEqual(TEST_TRUSTEE.legacy?.address3);

      const cityStateElement = screen.getByTestId('case-detail-trustee-city-state-zip');
      expect(cityStateElement).toBeInTheDocument();
      expect(cityStateElement?.textContent).toEqual(TEST_TRUSTEE.legacy?.cityStateZipCountry);
    });

    test('should render trustee name as link when trusteeId is present', async () => {
      const trustee = MockData.getTrustee();
      vi.spyOn(Api2, 'getTrustee').mockResolvedValue({ data: trustee });

      const caseDetailWithTrusteeId = {
        ...BASE_TEST_CASE_DETAIL,
        trusteeId: trustee.trusteeId,
      };
      renderWithProps({ caseDetail: caseDetailWithTrusteeId });

      const trusteeLink = screen.getByTestId('case-detail-trustee-link');
      expect(trusteeLink).toBeInTheDocument();
      expect(trusteeLink).toHaveAttribute('href', `/trustees/${trustee.trusteeId}`);
      expect(trusteeLink).toHaveTextContent(TEST_TRUSTEE.name);

      // Wait for async effects to settle
      await waitFor(() => {
        expect(screen.queryByTestId('case-detail-zoom-loading')).not.toBeInTheDocument();
      });
    });

    test('should render trustee name as plain text when trusteeId is absent', () => {
      renderWithProps();

      const trusteeLink = screen.queryByTestId('case-detail-trustee-link');
      expect(trusteeLink).not.toBeInTheDocument();

      const trusteeName = document.querySelector('.trustee-name');
      expect(trusteeName).toBeInTheDocument();
      expect(trusteeName?.textContent).toEqual(TEST_TRUSTEE.name);
    });

    test('should display Zoom info when trustee has zoomInfo', async () => {
      const trustee = MockData.getTrustee({
        zoomInfo: {
          link: 'https://zoom.us/j/123456',
          phone: '2125551234',
          meetingId: '123456',
          passcode: 'abc123',
        },
      });
      vi.spyOn(Api2, 'getTrustee').mockResolvedValue({ data: trustee });

      const caseDetailWithTrusteeId = {
        ...BASE_TEST_CASE_DETAIL,
        trusteeId: trustee.trusteeId,
      };
      renderWithProps({ caseDetail: caseDetailWithTrusteeId });

      await waitFor(() => {
        expect(screen.getByTestId('case-detail-zoom-info')).toBeInTheDocument();
      });

      expect(screen.getByTestId('case-detail-zoom-link')).toBeInTheDocument();
      expect(screen.getByTestId('case-detail-zoom-phone')).toBeInTheDocument();
      expect(screen.getByTestId('case-detail-zoom-meeting-id')).toBeInTheDocument();
      expect(screen.getByTestId('case-detail-zoom-passcode')).toBeInTheDocument();
    });

    test('should show "No 341 meeting information" when trustee has no zoomInfo', async () => {
      const trustee = MockData.getTrustee({ zoomInfo: undefined });
      vi.spyOn(Api2, 'getTrustee').mockResolvedValue({ data: trustee });

      const caseDetailWithTrusteeId = {
        ...BASE_TEST_CASE_DETAIL,
        trusteeId: trustee.trusteeId,
      };
      renderWithProps({ caseDetail: caseDetailWithTrusteeId });

      await waitFor(() => {
        expect(screen.getByTestId('case-detail-zoom-empty')).toBeInTheDocument();
      });
      expect(screen.getByTestId('case-detail-zoom-empty')).toHaveTextContent(
        'No 341 meeting information',
      );
    });

    test('should show legacy trustee info when trustee API call fails', async () => {
      vi.spyOn(Api2, 'getTrustee').mockRejectedValue(new Error('API error'));

      const caseDetailWithTrusteeId = {
        ...BASE_TEST_CASE_DETAIL,
        trusteeId: 'some-trustee-id',
      };
      renderWithProps({ caseDetail: caseDetailWithTrusteeId });

      await waitFor(() => {
        expect(screen.queryByTestId('case-detail-zoom-loading')).not.toBeInTheDocument();
      });

      // Legacy trustee info should still display
      const trusteeName = document.querySelector('.trustee-name');
      expect(trusteeName).toBeInTheDocument();
      expect(trusteeName?.textContent).toEqual(TEST_TRUSTEE.name);

      // Zoom info should not be present
      expect(screen.queryByTestId('case-detail-zoom-info')).not.toBeInTheDocument();
    });

    test('should show loading state while fetching trustee details', () => {
      vi.spyOn(Api2, 'getTrustee').mockReturnValue(new Promise(() => {})); // never resolves

      const caseDetailWithTrusteeId = {
        ...BASE_TEST_CASE_DETAIL,
        trusteeId: 'some-trustee-id',
      };
      renderWithProps({ caseDetail: caseDetailWithTrusteeId });

      expect(screen.getByTestId('case-detail-zoom-loading')).toBeInTheDocument();
    });

    test('should handle partial trustee address data gracefully', () => {
      const partialTrustee = {
        ...TEST_TRUSTEE,
        legacy: {
          ...TEST_TRUSTEE.legacy,
          address2: undefined,
          address3: undefined,
        },
      };
      const caseDetailPartialAddress = {
        ...BASE_TEST_CASE_DETAIL,
        trustee: partialTrustee,
      };
      renderWithProps({ caseDetail: caseDetailPartialAddress });

      // Only address1 should be present since address2 and address3 are undefined
      const address1Element = screen.getByTestId('case-detail-trustee-address1');
      expect(address1Element).toBeInTheDocument();
      expect(address1Element?.textContent).toEqual(partialTrustee.legacy?.address1);

      // address2 and address3 should not be rendered when undefined
      expect(screen.queryByTestId('case-detail-trustee-address2')).not.toBeInTheDocument();
      expect(screen.queryByTestId('case-detail-trustee-address3')).not.toBeInTheDocument();
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
      renderWithProps({ onCaseAssignment });

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

    test('should not show edit button for member cases', () => {
      const caseDetail: CaseDetail = { ...BASE_TEST_CASE_DETAIL, consolidation: [CONSOLIDATE_TO] };
      const onCaseAssignment = vi.fn();
      renderWithProps({
        caseDetail,
        onCaseAssignment,
      });

      const assignedStaffEditButton = screen.queryByTestId('open-modal-button');
      expect(assignedStaffEditButton).not.toBeInTheDocument();
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
