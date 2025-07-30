import { isJointAdministrationChildCase } from '@common/cams/events';
import { CaseDetail } from '@common/cams/cases';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import AssignAttorneyModal from '@/staff-assignment/modal/AssignAttorneyModal';
import {
  AssignAttorneyModalCallbackProps,
  AssignAttorneyModalRef,
} from '@/staff-assignment/modal/assignAttorneyModal.types';
import { OpenModalButton } from '@/lib/components/uswds/modal/OpenModalButton';
import { useRef } from 'react';
import { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import Actions from '@common/cams/actions';
import { AttorneyUser } from '@common/cams/users';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import { OpenModalButtonRef } from '../../lib/components/uswds/modal/modal-refs';
import { getCaseNumber } from '@/lib/utils/caseNumber';
import Icon from '@/lib/components/uswds/Icon';

export interface CaseDetailTrusteeAndAssignedStaffProps {
  caseDetail: CaseDetail;
  onCaseAssignment: (props: AssignAttorneyModalCallbackProps) => void;
}

export default function CaseDetailTrusteeAndAssignedStaff(
  props: CaseDetailTrusteeAndAssignedStaffProps,
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
      <div className="grid-row grid-gap-lg">
        <div className="case-card-list grid-col-6">
          <div className="assigned-staff-information padding-bottom-4 case-card">
            <h3>
              Assigned Staff{' '}
              {Actions.contains(caseDetail, Actions.ManageAssignments) &&
                caseDetail.chapter === '15' && (
                  <OpenModalButton
                    uswdsStyle={UswdsButtonStyle.Unstyled}
                    modalId={'assignmentModalId'}
                    modalRef={assignmentModalRef}
                    ref={openModalButtonRef}
                    openProps={{ bCase: caseDetail, callback: handleCaseAssignment }}
                    ariaLabel="Edit assigned staff"
                    title="Open Staff Assignment window"
                  >
                    <IconLabel icon="edit" label="Edit" />
                  </OpenModalButton>
                )}
            </h3>
            <div className="assigned-staff-list">
              {caseDetail.regionId && (
                <div
                  className="case-detail-region-id"
                  data-testid="case-detail-region-id"
                  aria-label="assigned region and office"
                >
                  Region {caseDetail.regionId.replace(/^0*/, '')} - {caseDetail.officeName} Office
                </div>
              )}
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
        <div className="case-card-list grid-col-6">
          {caseDetail.trustee && (
            <div className="assigned-staff-information padding-bottom-4 case-card">
              <h3>Trustee</h3>
              <div className="trustee-name padding-bottom-1">{caseDetail.trustee.name}</div>
              {caseDetail.trustee.email && (
                <div
                  className="padding-bottom-1"
                  data-testid="case-detail-trustee-email"
                  aria-label="trustee email"
                >
                  <a
                    href={`mailto:${caseDetail.trustee.email}?subject=${getCaseNumber(
                      caseDetail.caseId,
                    )} - ${caseDetail.caseTitle}`}
                  >
                    {caseDetail.trustee.email}
                    <Icon className="link-icon" name="mail_outline" />
                  </a>
                </div>
              )}
              <div className="padding-bottom-1 trustee-phone-number">
                {caseDetail.trustee.phone}
              </div>
              <div className="padding-bottom-1">
                <div className="trustee-address">{caseDetail.trustee.address1}</div>
                <div className="trustee-address">{caseDetail.trustee.address2}</div>
                <div className="trustee-address">{caseDetail.trustee.address3}</div>
                <div
                  className="city-state-postal-code"
                  aria-label="trustee city, state, zip, country"
                >
                  <span className="trustee-city">{caseDetail.trustee.cityStateZipCountry}</span>,
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <AssignAttorneyModal
        ref={assignmentModalRef}
        modalId={'assignmentModalId'}
        alertMessage={
          isJointAdministrationChildCase(caseDetail.consolidation)
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
