import MockData from '@common/cams/test-utilities/mock-data';
import { StaffAssignmentRow, StaffAssignmentRowOptions } from './StaffAssignmentRow';
import AssignAttorneyModal, { AssignAttorneyModalRef } from './modal/AssignAttorneyModal';
import { useRef } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import Api2 from '@/lib/hooks/UseApi2';
import { buildResponseBodySuccess } from '@common/api/response';
import { CaseAssignment } from '@common/cams/assignments';
import { ATTORNEYS } from '@common/cams/test-utilities/attorneys.mock';
import { AttorneyUser } from '@common/cams/users';
import { BrowserRouter } from 'react-router-dom';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import { formatDate } from '@/lib/utils/datetime';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { CaseBasics } from '@common/cams/cases';
import Actions, { ResourceActions } from '@common/cams/actions';
//import { GlobalAlertRef } from '@/lib/components/cams/GlobalAlert/GlobalAlert';
//import * as globalAlertHook from '@/lib/hooks/UseGlobalAlert';
import testingUtilities from '@/lib/testing/testing-utilities';

describe('StaffAssignmentRow tests', () => {
  const bCase: ResourceActions<CaseBasics> = {
    ...MockData.getCaseBasics(),
    _actions: [Actions.ManageAssignments],
  };

  function renderWithProps(props: Partial<TestComponentProps> = {}) {
    const defaultProps: TestComponentProps = {
      bCase,
    };

    const renderProps = { ...defaultProps, ...props };
    render(
      <BrowserRouter>
        <TestComponent {...renderProps} />
      </BrowserRouter>,
    );
  }

  type TestComponentProps = {
    bCase: ResourceActions<CaseBasics>;
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
            <StaffAssignmentRow bCase={props.bCase} idx={0} options={options} />
          </tbody>
        </table>
        <AssignAttorneyModal modalId={'test-modal-id'} ref={modalRef} />
      </div>
    );
  }

  vi.spyOn(Api2, 'getAttorneys').mockResolvedValue(
    buildResponseBodySuccess<AttorneyUser[]>(ATTORNEYS),
  );

  test('should render a row', async () => {
    const assignedAttorney = MockData.getAttorneyAssignment();
    const caseAssignmentSpy = vi
      .spyOn(Api2, 'getCaseAssignments')
      .mockResolvedValue(buildResponseBodySuccess<CaseAssignment[]>([assignedAttorney]));

    renderWithProps();

    await waitFor(() => {
      const firstTable = document.querySelector('table');
      const rows = firstTable?.querySelectorAll('td');
      expect(rows?.length).toEqual(5);
      expect(rows?.[0]).toHaveTextContent(getCaseNumber(bCase.caseId));
      expect(rows?.[0]).toHaveTextContent(bCase.courtDivisionName);
      expect(rows?.[1]).toHaveTextContent(bCase.caseTitle);
      expect(rows?.[2]).toHaveTextContent(bCase.chapter);
      expect(rows?.[3]).toHaveTextContent(formatDate(bCase.dateFiled));
      expect(rows?.[4]).toHaveTextContent(assignedAttorney.name);
      expect(screen.getByTestId('attorney-list-0')).toBeVisible();
      expect(caseAssignmentSpy).toHaveBeenCalledWith(bCase.caseId);
    });
  });

  test('should show "unassigned" if there is not an assigned attorney', async () => {
    vi.spyOn(Api2, 'getCaseAssignments').mockResolvedValue(
      buildResponseBodySuccess<CaseAssignment[]>([]),
    );

    renderWithProps();

    await waitFor(() => {
      const firstTable = document.querySelector('table');
      const cols = firstTable?.querySelectorAll('td');
      expect(cols?.[4]).toHaveTextContent('(unassigned)');
      const button = cols?.[4].querySelector('button');
      expect(button).not.toHaveClass(UswdsButtonStyle.Outline);
      expect(button).toHaveTextContent('Assign');
      expect(button).toHaveAttribute('title', 'add assignments');
      expect(button).toHaveAttribute('data-open-modal', 'true');
    });
  });

  test('should show assigned attorney names for assigned attorneys', async () => {
    const assignments = MockData.buildArray(MockData.getAttorneyAssignment, 2);
    vi.spyOn(Api2, 'getCaseAssignments').mockResolvedValue(
      buildResponseBodySuccess<CaseAssignment[]>(assignments),
    );

    renderWithProps();

    await waitFor(() => {
      const firstTable = document.querySelector('table');
      const cols = firstTable?.querySelectorAll('td');
      assignments.forEach((assignment) => {
        expect(cols?.[4]).toHaveTextContent(assignment.name);
        const button = cols?.[4].querySelector('button');
        expect(button).toHaveClass(UswdsButtonStyle.Outline);
        expect(button).toHaveTextContent('Edit');
        expect(button).toHaveAttribute('title', 'edit assignments');
        expect(button).toHaveAttribute('data-open-modal', 'true');
      });
    });
  });

  test('should not show assign/edit button', async () => {
    const assignments = MockData.buildArray(MockData.getAttorneyAssignment, 2);
    vi.spyOn(Api2, 'getCaseAssignments').mockResolvedValue(
      buildResponseBodySuccess<CaseAssignment[]>(assignments),
    );

    const myCase = { ...bCase, _actions: [] };
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

  test('should show error alert when an error is thrown by api.getCaseAssignments', async () => {
    vi.spyOn(Api2, 'getCaseAssignments').mockRejectedValue('some error');
    const globalAlertSpy = testingUtilities.spyOnGlobalAlert();

    renderWithProps();

    await waitFor(() => {
      expect(globalAlertSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Could not get staff assignments for case '),
      );
    });
  });

  // TODO: Test useStaffAssignmentRowActions.actions.getCaseAssignments()
});
