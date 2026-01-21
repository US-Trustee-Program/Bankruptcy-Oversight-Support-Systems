import { isJointAdministrationMemberCase } from '@common/cams/events';
import { CaseDetail } from '@common/cams/cases';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import AssignAttorneyModal from '@/staff-assignment/modal/AssignAttorneyModal';
import {
  AssignAttorneyModalCallbackProps,
  AssignAttorneyModalRef,
} from '@/staff-assignment/modal/assignAttorneyModal.types';
import OpenModalButton from '@/lib/components/uswds/modal/OpenModalButton';
import { useRef } from 'react';
import { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import Actions from '@common/cams/actions';
import { AttorneyUser } from '@common/cams/users';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import { OpenModalButtonRef } from '@/lib/components/uswds/modal/modal-refs';
import { getCaseNumber } from '@/lib/utils/caseNumber';
import LegacyFormattedContact from '@/lib/components/cams/LegacyFormattedContact';

export interface CaseDetailTrusteeAndAssignedStaffProps {
  caseDetail: CaseDetail;
  onCaseAssignment: (props: AssignAttorneyModalCallbackProps) => void;
}

function canEditAssignedStaff(caseDetail: CaseDetail): boolean {
  return (
    Actions.contains(caseDetail, Actions.ManageAssignments) &&
    caseDetail.chapter === '15' &&
    !isJointAdministrationMemberCase(caseDetail.consolidation)
  );
}

function CaseDetailTrusteeAndAssignedStaff(
  props: Readonly<CaseDetailTrusteeAndAssignedStaffProps>,
) {
  const { caseDetail, onCaseAssignment } = props;

  const assignmentModalRef = useRef<AssignAttorneyModalRef>(null);
  const openModalButtonRef = useRef<OpenModalButtonRef>(null);

  function handleCaseAssignment(props: AssignAttorneyModalCallbackProps) {
    onCaseAssignment(props);
    assignmentModalRef.current?.hide();
    openModalButtonRef.current?.focus();
  }

  return (
    <>
      <div className="grid-col-12 tablet:grid-col-10 desktop:grid-col-8 record-detail-container">
        <div className="record-detail-card-list">
          <div className="assigned-staff-information record-detail-card">
            <h3>
              Assigned Staff{' '}
              {canEditAssignedStaff(caseDetail) && (
                <OpenModalButton
                  uswdsStyle={UswdsButtonStyle.Unstyled}
                  modalId={'assignmentModalId'}
                  modalRef={assignmentModalRef}
                  ref={openModalButtonRef}
                  openProps={{ bCase: caseDetail, callback: handleCaseAssignment }}
                  ariaLabel="Edit assigned staff"
                  title="Open Staff Assignment window"
                  className="h3-icon-button"
                >
                  <IconLabel icon="edit" label="Edit" />
                </OpenModalButton>
              )}
            </h3>
            {caseDetail.regionId && (
              <div
                className="case-detail-region-id"
                data-testid="case-detail-region-id"
                aria-label="assigned region and office"
              >
                Region {caseDetail.regionId.replace(/^0*/, '')} - {caseDetail.officeName} Office
              </div>
            )}
            <div className="assigned-staff-list">
              {(typeof caseDetail.assignments === 'undefined' ||
                caseDetail.assignments.length === 0) && (
                <span className="unassigned-placeholder">(unassigned)</span>
              )}
              {caseDetail.assignments && caseDetail.assignments.length > 0 && (
                <ul className="usa-list usa-list--unstyled">
                  {caseDetail.assignments &&
                    caseDetail.assignments.length > 0 &&
                    (caseDetail.assignments as Array<AttorneyUser>)?.map(
                      (staff: AttorneyUser, idx: number) => {
                        return (
                          <li key={idx} className="individual-assignee">
                            <span className="assignee-name">{staff.name}</span>
                            <span className="vertical-divider"> | </span>
                            <span className="assignee-role">Trial Attorney</span>
                          </li>
                        );
                      },
                    )}
                </ul>
              )}
            </div>
          </div>
        </div>
        <div className="record-detail-card-list">
          {caseDetail.trustee && (
            <div className="assigned-staff-information record-detail-card">
              <h3>Trustee</h3>
              <div className="trustee-name">{caseDetail.trustee.name}</div>
              <LegacyFormattedContact
                legacy={caseDetail.trustee.legacy}
                testIdPrefix="case-detail-trustee"
                emailSubject={`${getCaseNumber(caseDetail.caseId)} - ${caseDetail.caseTitle}`}
              />
            </div>
          )}
        </div>
      </div>
      <AssignAttorneyModal
        ref={assignmentModalRef}
        modalId={'assignmentModalId'}
        alertMessage={
          isJointAdministrationMemberCase(caseDetail.consolidation)
            ? {
                message: 'The assignees for this case will not match the lead case.',
                type: UswdsAlertStyle.Warning,
                timeOut: 0,
              }
            : undefined
        }
        assignmentChangeCallback={() => {}}
      ></AssignAttorneyModal>
    </>
  );
}

export default CaseDetailTrusteeAndAssignedStaff;
