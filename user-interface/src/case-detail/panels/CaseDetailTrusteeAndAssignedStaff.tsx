import { isJointAdministrationMemberCase } from '@common/cams/events';
import { CaseDetail } from '@common/cams/cases';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import AssignAttorneyModal from '@/staff-assignment/modal/AssignAttorneyModal';
import {
  AssignAttorneyModalCallbackProps,
  AssignAttorneyModalRef,
} from '@/staff-assignment/modal/assignAttorneyModal.types';
import OpenModalButton from '@/lib/components/uswds/modal/OpenModalButton';
import { useEffect, useRef, useState } from 'react';
import { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import Actions from '@common/cams/actions';
import { AttorneyUser } from '@common/cams/users';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import { OpenModalButtonRef } from '@/lib/components/uswds/modal/modal-refs';
import { getCaseNumber } from '@/lib/utils/caseNumber';
import LegacyFormattedContact from '@/lib/components/cams/LegacyFormattedContact';
import { Link } from 'react-router-dom';
import { Trustee } from '@common/cams/trustees';
import Api2 from '@/lib/models/api2';
import CommsLink from '@/lib/components/cams/CommsLink/CommsLink';
import { formatMeetingId } from '@/lib/utils/zoomInfo';

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

  const [trustee, setTrustee] = useState<Trustee | null>(null);
  const [trusteeLoading, setTrusteeLoading] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    const { trusteeId } = caseDetail;

    // Reset state when trusteeId changes or is removed
    if (!trusteeId) {
      setTrustee(null);
      setTrusteeLoading(false);
      return () => {
        isCurrent = false;
      };
    }

    setTrustee(null);
    setTrusteeLoading(true);

    Api2.getTrustee(trusteeId)
      .then((response) => {
        if (!isCurrent) return;
        setTrustee(response.data);
      })
      .catch(() => {
        if (!isCurrent) return;
        setTrustee(null);
      })
      .finally(() => {
        if (!isCurrent) return;
        setTrusteeLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [caseDetail.trusteeId]);

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
              <div className="trustee-name">
                {caseDetail.trusteeId ? (
                  <Link
                    to={`/trustees/${caseDetail.trusteeId}`}
                    data-testid="case-detail-trustee-link"
                    aria-label={`View trustee profile for ${caseDetail.trustee.name}`}
                  >
                    {caseDetail.trustee.name}
                  </Link>
                ) : (
                  caseDetail.trustee.name
                )}
              </div>
              <LegacyFormattedContact
                legacy={caseDetail.trustee.legacy}
                testIdPrefix="case-detail-trustee"
                emailSubject={`${getCaseNumber(caseDetail.caseId)} - ${caseDetail.caseTitle}`}
              />
              {caseDetail.trusteeId && trusteeLoading && (
                <div data-testid="case-detail-zoom-loading">Loading 341 meeting info...</div>
              )}
              {caseDetail.trusteeId && !trusteeLoading && trustee && (
                <>
                  {!trustee.zoomInfo && (
                    <div data-testid="case-detail-zoom-empty">No 341 meeting information</div>
                  )}
                  {trustee.zoomInfo && (
                    <div data-testid="case-detail-zoom-info" className="case-detail-zoom-info">
                      <h4>341 Meeting</h4>
                      <div data-testid="case-detail-zoom-link">
                        <CommsLink
                          contact={{ website: trustee.zoomInfo.link }}
                          mode="website"
                          label="Zoom Link"
                        />
                      </div>
                      <div data-testid="case-detail-zoom-phone">
                        <CommsLink
                          contact={{ phone: { number: trustee.zoomInfo.phone } }}
                          mode="phone-dialer"
                        />
                      </div>
                      <div data-testid="case-detail-zoom-meeting-id">
                        Meeting ID: {formatMeetingId(trustee.zoomInfo.meetingId)}
                      </div>
                      <div data-testid="case-detail-zoom-passcode">
                        Passcode: {trustee.zoomInfo.passcode}
                      </div>
                    </div>
                  )}
                </>
              )}
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
