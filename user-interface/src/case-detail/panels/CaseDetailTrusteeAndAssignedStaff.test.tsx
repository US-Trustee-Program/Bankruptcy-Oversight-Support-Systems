import { BrowserRouter } from 'react-router-dom';
import CaseDetailTrusteeAndAssignedStaff, {
  CaseDetailTrusteeAndAssignedStaffProps,
} from './CaseDetailTrusteeAndAssignedStaff';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { getCaseNumber } from '@/lib/utils/caseNumber';
import { CaseDetail } from '@common/cams/cases';
import { MockData } from '@common/cams/test-utilities/mock-data';
import Actions from '@common/cams/actions';
import { AttorneyUser, CamsUser } from '@common/cams/users';
import { MockAttorneys } from '@common/cams/test-utilities/attorneys.mock';
import { CamsRole } from '@common/cams/roles';
import LocalStorage from '@/lib/utils/local-storage';
import { ResponseBody } from '@common/api/response';
import Api2 from '@/lib/models/api2';
import testingUtilities from '@/lib/testing/testing-utilities';
import { Consolidation } from '@common/cams/events';

const TEST_CASE_ID = '101-23-12345';
const TEST_TRIAL_ATTORNEY_1 = MockAttorneys.Brian;
const TEST_ASSIGNMENT_1 = MockData.getAttorneyAssignment({ ...TEST_TRIAL_ATTORNEY_1 });
const TEST_TRIAL_ATTORNEY_2 = MockAttorneys.Carl;
const TEST_ASSIGNMENT_2 = MockData.getAttorneyAssignment({ ...TEST_TRIAL_ATTORNEY_2 });
const TEST_TRUSTEE = MockData.getTrustee();

const BASE_TEST_CASE_DETAIL = MockData.getCaseDetail({
  override: {
    caseId: TEST_CASE_ID,
    chapter: '15',
    assignments: [TEST_ASSIGNMENT_1, TEST_ASSIGNMENT_2],
    trustee: TEST_TRUSTEE,
    _actions: [Actions.ManageAssignments],
  },
});

const CONSOLIDATE_TO: Consolidation = {
  caseId: TEST_CASE_ID,
  otherCase: MockData.getCaseSummary({ override: { caseId: '222-24-00001' } }),
  orderDate: '01-12-2024',
  consolidationType: 'administrative',
  documentType: 'CONSOLIDATION_TO',
  updatedBy: MockData.getCamsUser(),
  updatedOn: '01-12-2024',
};

const attorneyList: AttorneyUser[] = MockData.buildArray(MockData.getAttorneyUser, 2);

describe('CaseDetailTrusteeAndAssignedStaff', () => {
  const attorneyListResponse: ResponseBody<AttorneyUser[]> = {
    meta: { self: 'self-url' },
    data: attorneyList,
  };
  vi.spyOn(Api2, 'getAttorneys').mockResolvedValue(attorneyListResponse);

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

    test('should show edit button when user has ManageAssignments action and case is chapter 15', () => {
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

    test('should open assignment modal when edit button is clicked', () => {
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
      expect(emailLink?.textContent).toContain(TEST_TRUSTEE.email);
      expect(emailLink?.getAttribute('href')).toEqual(
        `mailto:${TEST_TRUSTEE.email}?subject=${getCaseNumber(BASE_TEST_CASE_DETAIL.caseId)} - ${BASE_TEST_CASE_DETAIL.caseTitle}`,
      );

      // Verify mail icon is present
      const mailIcon = emailElement?.querySelector('.link-icon');
      expect(mailIcon).toBeInTheDocument();
    });

    test('should not display email section when trustee has no email', () => {
      const trusteeNoEmail = { ...TEST_TRUSTEE, email: undefined };
      const caseDetailNoEmail = {
        ...BASE_TEST_CASE_DETAIL,
        trustee: trusteeNoEmail,
      };
      renderWithProps({ caseDetail: caseDetailNoEmail });
      const emailElement = screen.queryByTestId('case-detail-trustee-email');
      expect(emailElement).not.toBeInTheDocument();
    });

    test('should display trustee phone number', () => {
      renderWithProps();
      const phoneElement = document.querySelector('.trustee-phone-number');
      expect(phoneElement).toBeInTheDocument();
      expect(phoneElement?.textContent).toEqual(TEST_TRUSTEE.phone);
    });

    test('should display all trustee address fields', () => {
      renderWithProps();

      const addressElements = document.querySelectorAll('.trustee-address');
      expect(addressElements).toHaveLength(3);
      expect(addressElements[0]?.textContent).toEqual(TEST_TRUSTEE.address1);
      expect(addressElements[1]?.textContent).toEqual(TEST_TRUSTEE.address2);
      expect(addressElements[2]?.textContent).toEqual(TEST_TRUSTEE.address3);

      const cityStateElement = document.querySelector('.trustee-city');
      expect(cityStateElement).toBeInTheDocument();
      expect(cityStateElement?.textContent).toEqual(TEST_TRUSTEE.cityStateZipCountry);
    });

    test('should handle partial trustee address data gracefully', () => {
      const partialTrustee = {
        ...TEST_TRUSTEE,
        address2: undefined,
        address3: undefined,
      };
      const caseDetailPartialAddress = {
        ...BASE_TEST_CASE_DETAIL,
        trustee: partialTrustee,
      };
      renderWithProps({ caseDetail: caseDetailPartialAddress });

      const addressElements = document.querySelectorAll('.trustee-address');
      expect(addressElements).toHaveLength(3); // Elements still exist
      expect(addressElements[0]?.textContent).toEqual(partialTrustee.address1);
      expect(addressElements[1]?.textContent).toEqual(''); // Empty for undefined address2
      expect(addressElements[2]?.textContent).toEqual(''); // Empty for undefined address3
    });
  });

  describe('Modal and Assignment Functionality', () => {
    const assignmentModalId = 'assignmentModalId';

    test('should call handleCaseAssignment callback when assignment is completed', async () => {
      const apiResult = {
        data: undefined,
      };
      vi.spyOn(Api2, 'postStaffAssignments').mockResolvedValue(apiResult);

      const onCaseAssignment = vi.fn();
      renderWithProps({ onCaseAssignment });

      const assignedStaffEditButton = screen.getByTestId('open-modal-button');
      fireEvent.click(assignedStaffEditButton);

      const modal = screen.getByTestId(`modal-${assignmentModalId}`);
      await waitFor(() => {
        expect(modal).toBeVisible();
      });

      await testingUtilities.selectCheckbox('0-checkbox');

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

    test('should show joint administration warning for child cases', async () => {
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

    test('should not show joint administration warning for non-child cases', async () => {
      const onCaseAssignment = vi.fn();
      renderWithProps({ onCaseAssignment });

      const assignedStaffEditButton = screen.getByTestId('open-modal-button');
      fireEvent.click(assignedStaffEditButton);

      const modal = screen.getByTestId(`modal-${assignmentModalId}`);
      await waitFor(() => {
        expect(modal).toBeVisible();
      });

      const childCaseMessage = screen.queryByTestId('alert-message');
      expect(childCaseMessage).not.toBeInTheDocument();
    });
  });
});
