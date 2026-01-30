import { useRef } from 'react';
import MockData from '@common/cams/test-utilities/mock-data';
import { StaffAssignmentRow, StaffAssignmentRowOptions } from './StaffAssignmentRow';
import AssignAttorneyModal from '../modal/AssignAttorneyModal';
import { AssignAttorneyModalRef } from '../modal/assignAttorneyModal.types';
import { render, screen, waitFor } from '@testing-library/react';
import Api2 from '@/lib/models/api2';
import { TRIAL_ATTORNEYS } from '@common/cams/test-utilities/attorneys.mock';
import { BrowserRouter } from 'react-router-dom';
import { getCaseNumber } from '@/lib/utils/caseNumber';
import { formatDate } from '@/lib/utils/datetime';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { CaseSummary } from '@common/cams/cases';
import Actions, { ResourceActions } from '@common/cams/actions';
import { Staff } from '@common/cams/users';
import { CamsRole, OversightRoleType } from '@common/cams/roles';

describe('StaffAssignmentRow tests', () => {
  const bCase: ResourceActions<CaseSummary> = {
    ...MockData.getCaseSummary(),
    _actions: [Actions.ManageAssignments],
  };

  function renderWithProps(props: Partial<TestComponentProps> = {}) {
    const defaultProps: TestComponentProps = {
      bCase,
      labels: [],
    };

    const renderProps = { ...defaultProps, ...props };
    render(
      <BrowserRouter>
        <TestComponent {...renderProps} />
      </BrowserRouter>,
    );
  }

  type TestComponentProps = {
    bCase: ResourceActions<CaseSummary>;
    labels: [];
  };

  function TestComponent(props: TestComponentProps) {
    const modalRef = useRef<AssignAttorneyModalRef>(null);

    const options: StaffAssignmentRowOptions = {
      modalId: 'test-modal-id',
      modalRef,
    };
    return (
      <div>
        <table>
          <tbody>
            <StaffAssignmentRow
              labels={props.labels}
              bCase={props.bCase}
              idx={0}
              options={options}
            />
          </tbody>
        </table>
        <AssignAttorneyModal
          modalId={'test-modal-id'}
          ref={modalRef}
          assignmentChangeCallback={vi.fn()}
        />
      </div>
    );
  }

  const mockStaffByRole: Record<OversightRoleType, Staff[]> = {
    [CamsRole.OversightAttorney]: TRIAL_ATTORNEYS,
    [CamsRole.OversightAuditor]: [],
    [CamsRole.OversightParalegal]: [],
  };

  vi.spyOn(Api2, 'getOversightStaff').mockResolvedValue({ data: mockStaffByRole });

  test('should render a row', async () => {
    const assignedAttorney = MockData.getAttorneyAssignment();

    renderWithProps({ bCase: { ...bCase, assignments: [assignedAttorney] } });

    let rows: NodeListOf<HTMLTableCellElement> | undefined;
    await waitFor(() => {
      const firstTable = document.querySelector('table');
      rows = firstTable?.querySelectorAll('td');
      expect(rows?.length).toEqual(5);
    });
    expect(rows?.[0]).toHaveTextContent(getCaseNumber(bCase.caseId));
    expect(rows?.[0]).toHaveTextContent(bCase.courtDivisionName);
    expect(rows?.[1]).toHaveTextContent(bCase.caseTitle);
    expect(rows?.[2]).toHaveTextContent(bCase.chapter);
    expect(rows?.[3]).toHaveTextContent(formatDate(bCase.dateFiled));
    expect(rows?.[4]).toHaveTextContent(assignedAttorney.name);
    expect(screen.getByTestId('attorney-list-0')).toBeVisible();
  });

  test('should show "unassigned" if there is not an assigned attorney', async () => {
    renderWithProps();

    let cols: NodeListOf<HTMLTableCellElement> | undefined;
    await waitFor(() => {
      const firstTable = document.querySelector('table');
      cols = firstTable?.querySelectorAll('td');
      expect(cols?.[4]).toHaveTextContent('(unassigned)');
    });
    const button = cols?.[4].querySelector('button');
    expect(button).toHaveClass(UswdsButtonStyle.Unstyled);
    expect(button).toHaveTextContent('Edit');
    expect(button).toHaveAttribute('title', 'Edit Staff Assignments');
    expect(button).toHaveAttribute('data-testid', 'open-modal-button_0');
  });

  test('should show assigned attorney names for assigned attorneys', async () => {
    const assignments = MockData.buildArray(
      () => MockData.getAttorneyAssignment({ caseId: bCase.caseId }),
      2,
    );

    renderWithProps({ bCase: { ...bCase, assignments } });

    await waitFor(() => {
      const firstTable = document.querySelector('table');
      const cols = firstTable?.querySelectorAll('td');
      assignments.forEach((assignment) => {
        expect(cols?.[4]).toHaveTextContent(assignment.name);
        const button = cols?.[4].querySelector('button');
        expect(button).toHaveClass(UswdsButtonStyle.Unstyled);
        expect(button).toHaveTextContent('Edit');
        expect(button).toHaveAttribute('title', 'Edit Staff Assignments');
        expect(button).toHaveAttribute('data-testid', 'open-modal-button_0');
      });
    });
  });

  test('should not show assign/edit button', async () => {
    const assignments = MockData.buildArray(
      () => MockData.getAttorneyAssignment({ caseId: bCase.caseId }),
      2,
    );

    const myCase = { ...bCase, _actions: [], assignments };
    renderWithProps({ bCase: myCase });

    await waitFor(() => {
      const firstTable = document.querySelector('table');
      const cols = firstTable?.querySelectorAll('td');
      assignments.forEach((assignment) => {
        expect(cols?.[4]).toHaveTextContent(assignment.name);
        const button = cols?.[4].querySelector('button');
        expect(button).not.toBeInTheDocument();
      });
    });
  });

  test('should render a list of assigned attorneys', async () => {
    const assignments = [MockData.getAttorneyAssignment()];

    renderWithProps({ bCase: { ...bCase, assignments } });

    let staffList;
    await waitFor(
      () => {
        staffList = document.querySelector('.attorney-list-container');
      },
      { timeout: 2000 },
    );
    expect(staffList).toBeInTheDocument();
    expect(screen.getByTestId('staff-name-0')).toBeInTheDocument();
    expect(screen.getByTestId('staff-name-0')).toHaveTextContent(assignments[0].name);
  });
});
