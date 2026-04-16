import { useRef } from 'react';
import { TableRow, TableRowData } from '@/lib/components/uswds/Table';
import OpenModalButton from '@/lib/components/uswds/modal/OpenModalButton';
import { CaseNumber } from '@/lib/components/CaseNumber';
import { formatDate } from '@/lib/utils/datetime';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import Actions from '@common/cams/actions';
import { SearchResultsRowProps } from '@/search-results/SearchResults';
import {
  AssignAttorneyModalRef,
  AssignAttorneyModalCallbackProps,
} from '../modal/assignAttorneyModal.types';
import Internal from './StaffAssignmentRow.internal';
import { OpenModalButtonRef } from '@/lib/components/uswds/modal/modal-refs';
import { CaseAssignment } from '@common/cams/assignments';
import { CamsUserReference } from '@common/cams/users';

export type StaffAssignmentRowOptions = {
  modalId: string;
  modalRef: React.RefObject<AssignAttorneyModalRef | null>;
};

type StaffAssignmentRowProps = SearchResultsRowProps & {
  options: StaffAssignmentRowOptions;
};

export function StaffAssignmentRow(props: StaffAssignmentRowProps) {
  const { bCase, idx, options, ...otherProps } = props;
  const { modalId, modalRef } = options as StaffAssignmentRowOptions;

  const initialState = {
    assignments: bCase.assignments ?? [],
    isLoading: true,
    bCase,
    modalRef,
  };

  const openAssignmentsModalButtonRef = useRef<OpenModalButtonRef>(null);
  const { state, actions } = Internal.useStateActions(initialState);

  function handleAssignmentModalCallback(props: AssignAttorneyModalCallbackProps) {
    actions.updateAssignmentsCallback(props).then(() => {
      modalRef.current?.hide();
    });
  }

  function buildActionButton() {
    const commonModalButtonProps = {
      className: 'case-assignment-modal-toggle',
      buttonIndex: `${idx}`,
      openProps: {
        bCase: { ...bCase, assignments: state.assignments },
        callback: handleAssignmentModalCallback,
      },
      modalId,
      modalRef,
      ref: openAssignmentsModalButtonRef,
    };

    return (
      <OpenModalButton
        uswdsStyle={UswdsButtonStyle.Unstyled}
        aria-label="Edit Staff Assignments"
        title="Edit Staff Assignments"
        {...commonModalButtonProps}
      >
        <IconLabel icon="edit" label="Edit" />
      </OpenModalButton>
    );
  }

  function buildAssignmentList(
    assignments: Partial<CaseAssignment>[] | undefined,
    leadTrialAttorney: CamsUserReference | undefined,
  ) {
    const nonLeadAssignments =
      assignments?.filter((a) => a.userId && a.userId !== leadTrialAttorney?.id) ?? [];

    if (!leadTrialAttorney && nonLeadAssignments.length === 0) {
      return <span className="unassigned">(unassigned)</span>;
    }

    const displayItems: { key: React.Key; label: string; testId: string }[] = [];

    if (leadTrialAttorney) {
      displayItems.push({
        key: 'lead',
        label: `${leadTrialAttorney.name} (Lead)`,
        testId: 'staff-name-lead',
      });
    }

    nonLeadAssignments.forEach((attorney, index) => {
      displayItems.push({
        key: index,
        label: attorney.name ?? '',
        testId: `staff-name-${index}`,
      });
    });

    return displayItems.map((item) => (
      <span key={item.key} data-testid={item.testId}>
        {item.label}
        <br />
      </span>
    ));
  }

  return (
    <TableRow {...otherProps} key={idx}>
      <TableRowData>
        <span className="no-wrap">
          <CaseNumber caseId={bCase.caseId} /> ({bCase.courtDivisionName})
        </span>
      </TableRowData>
      <TableRowData>{bCase.caseTitle}</TableRowData>
      <TableRowData>{bCase.chapter}</TableRowData>
      <TableRowData>{formatDate(bCase.dateFiled)}</TableRowData>
      <TableRowData data-testid={`attorney-list-${idx}`} className="attorney-list">
        <span className="mobile-title">Assigned Attorney:</span>
        <div className="table-flex-container">
          <div className="attorney-list-container">
            {buildAssignmentList(state.assignments, state.bCase.leadTrialAttorney)}
          </div>
          <div className="table-column-toolbar">
            {Actions.contains(bCase, Actions.ManageAssignments) && buildActionButton()}
          </div>
        </div>
      </TableRowData>
    </TableRow>
  );
}
