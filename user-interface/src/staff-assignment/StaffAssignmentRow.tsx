import { useEffect, useState } from 'react';
import { TableRow, TableRowData } from '@/lib/components/uswds/Table';
import { ToggleModalButton } from '@/lib/components/uswds/modal/ToggleModalButton';
import { CaseNumber } from '@/lib/components/CaseNumber';
import { formatDate } from '@/lib/utils/datetime';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { useApi2 } from '@/lib/hooks/UseApi2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Actions from '@common/cams/actions';
import { SearchResultsRowProps } from '@/search-results/SearchResults';
import { AssignAttorneyModalRef, CallbackProps } from './modal/AssignAttorneyModal';
import { CaseBasics } from '@common/cams/cases';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';

export type StaffAssignmentRowOptions = {
  modalId: string;
  modalRef: React.RefObject<AssignAttorneyModalRef>;
};

export type StaffAssignmentRowProps = SearchResultsRowProps & {
  options: StaffAssignmentRowOptions;
};

function deepCopy(obj: object) {
  return JSON.parse(JSON.stringify(obj));
}

export function StaffAssignmentRow(props: StaffAssignmentRowProps) {
  const { bCase, idx, options, ...otherProps } = props;
  const { modalId, modalRef } = options as StaffAssignmentRowOptions;
  if (idx === 0) console.log(`loading row ${idx}`);

  const [bCaseCopy, setBCaseCopy] = useState<CaseBasics>(deepCopy(bCase));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const api = useApi2();
  const globalAlert = useGlobalAlert();

  function updateCase(props: CallbackProps) {
    const { bCase, selectedAttorneyList, previouslySelectedList, status, apiResult } = props;

    if (status === 'error') {
      globalAlert?.show({
        message: (apiResult as Error).message,
        type: UswdsAlertStyle.Error,
        timeout: 8,
      });
    } else if (bCase) {
      const messageArr = [];
      const addedAssignments = selectedAttorneyList.filter(
        (el) => !previouslySelectedList.includes(el),
      );
      const removedAssignments = previouslySelectedList.filter(
        (el) => !selectedAttorneyList.includes(el),
      );

      if (addedAssignments.length > 0) {
        messageArr.push(
          `${addedAssignments.map((attorney) => attorney.name).join(', ')} assigned to`,
        );
      }
      if (removedAssignments.length > 0) {
        messageArr.push(
          `${removedAssignments.map((attorney) => attorney.name).join(', ')} unassigned from`,
        );
      }

      const alertMessage =
        messageArr.join(' case and ') + ` case ${getCaseNumber(bCase.caseId)} ${bCase.caseTitle}.`;

      globalAlert?.show({ message: alertMessage, type: UswdsAlertStyle.Success, timeout: 8 });

      options.modalRef.current?.hide();
    }
  }

  useEffect(() => {
    if (!isLoading) return;
    api
      .getCaseAssignments(bCase.caseId)
      .then((response) => {
        const assignments = response.data.map((assignment) => {
          return { id: assignment.userId, name: assignment.name };
        });
        setBCaseCopy({ ...bCaseCopy, assignments });
      })
      .catch((_reason) => {})
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    if (modalRef.current && modalRef.current.setSubmitCallback) {
      modalRef.current.setSubmitCallback(updateCase);
    }
  }, [modalRef]);

  let assignmentJsx;
  let actionButton;

  const commonModalButtonProps = {
    className: 'case-assignment-modal-toggle',
    buttonIndex: `toggle-button-${idx}`,
    toggleProps: { bCase: bCaseCopy },
    modalId,
    modalRef,
  };

  if (bCaseCopy.assignments && bCaseCopy.assignments.length > 0) {
    assignmentJsx = bCaseCopy.assignments?.map((attorney, key: number) => (
      <span key={key}>
        {attorney.name}
        <br />
      </span>
    ));
    actionButton = (
      <ToggleModalButton
        {...commonModalButtonProps}
        uswdsStyle={UswdsButtonStyle.Outline}
        toggleAction="open"
        title="edit assignments"
      >
        Edit
      </ToggleModalButton>
    );
  } else {
    assignmentJsx = <>(unassigned)</>;
    actionButton = (
      <ToggleModalButton {...commonModalButtonProps} toggleAction="open" title="add assignments">
        Assign
      </ToggleModalButton>
    );
  }

  return (
    <TableRow {...otherProps} key={idx}>
      <TableRowData dataSortValue={bCase.caseId}>
        <span className="no-wrap">
          <CaseNumber caseId={bCase.caseId} /> ({bCase.courtDivisionName})
        </span>
      </TableRowData>
      <TableRowData>{bCase.caseTitle}</TableRowData>
      <TableRowData>{bCase.chapter}</TableRowData>
      <TableRowData>{formatDate(bCase.dateFiled)}</TableRowData>
      <TableRowData data-testid={`attorney-list-${idx}`} className="attorney-list">
        <span className="mobile-title">Assigned Attorney:</span>
        {isLoading && (
          <div className="table-flex-container">
            <div className="attorney-list-container">
              <LoadingSpinner caption="Loading..." />
            </div>
          </div>
        )}
        {!isLoading && (
          <div className="table-flex-container">
            <div className="attorney-list-container">{assignmentJsx}</div>
            <div className="table-column-toolbar">
              {Actions.contains(bCase, Actions.ManageAssignments) && actionButton}
            </div>
          </div>
        )}
      </TableRowData>
    </TableRow>
  );
}
