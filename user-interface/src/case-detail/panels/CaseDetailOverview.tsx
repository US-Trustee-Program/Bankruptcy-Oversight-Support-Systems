import { getCaseNumber } from '@/lib/utils/caseNumber';
import { formatDate } from '@/lib/utils/datetime';
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
import useFeatureFlags, { VIEW_TRUSTEE_ON_CASE } from '@/lib/hooks/UseFeatureFlags';
import LegacyFormattedContact from '@/lib/components/cams/LegacyFormattedContact';

const informationUnavailable = 'Information is not available.';
const taxIdUnavailable = 'Tax ID information is not available.';

export interface CaseDetailOverviewProps {
  caseDetail: CaseDetail;
  showReopenDate: boolean;
  onCaseAssignment: (props: AssignAttorneyModalCallbackProps) => void;
}

export default function CaseDetailOverview(props: CaseDetailOverviewProps) {
  const { caseDetail, showReopenDate, onCaseAssignment } = props;
  const featureFlags = useFeatureFlags();

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
          <div className="date-information record-detail-card">
            <h3>Dates</h3>
            <div className="date-list">
              <ul className="usa-list usa-list--unstyled">
                <li data-testid="case-detail-filed-date">
                  <span className="case-detail-item-name">Case Filed:</span>
                  <span className="case-detail-item-value">{formatDate(caseDetail.dateFiled)}</span>
                </li>
                {caseDetail.reopenedDate && showReopenDate && (
                  <li data-testid="case-detail-reopened-date">
                    <span className="case-detail-item-name">Reopened by court:</span>
                    <span className="case-detail-item-value">
                      {formatDate(caseDetail.reopenedDate)}
                    </span>
                  </li>
                )}
                {!showReopenDate && caseDetail.closedDate && (
                  <li data-testid="case-detail-closed-date">
                    <span className="case-detail-item-name">Closed by court:</span>
                    <span className="case-detail-item-value">
                      {formatDate(caseDetail.closedDate)}
                    </span>
                  </li>
                )}
                {caseDetail.dismissedDate && (
                  <li data-testid="case-detail-dismissed-date">
                    <span className="case-detail-item-name">Dismissed by court:</span>
                    <span className="case-detail-item-value">
                      {formatDate(caseDetail.dismissedDate)}
                    </span>
                  </li>
                )}
              </ul>
            </div>
          </div>
          {!featureFlags[VIEW_TRUSTEE_ON_CASE] && (
            <div className="assigned-staff-information record-detail-card">
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
          )}
          {!featureFlags[VIEW_TRUSTEE_ON_CASE] && (
            <div className="judge-information record-detail-card">
              <h3>Judge</h3>
              {caseDetail.judgeName && (
                <div className="case-detail-judge-name" data-testid="case-detail-judge-name">
                  {caseDetail.judgeName}
                </div>
              )}
              {!caseDetail.judgeName && (
                <div className="case-detail-judge-name" data-testid="case-detail-no-judge-name">
                  {informationUnavailable}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="record-detail-card-list">
          <div className="debtor-information record-detail-card">
            <h3>Debtor</h3>
            <div data-testid="case-detail-debtor-name" aria-label="debtor name">
              {caseDetail.debtor.name}
            </div>
            {caseDetail.debtor.taxId && (
              <div
                data-testid="case-detail-debtor-taxId"
                aria-label="debtor employer identification number"
              >
                <span className="case-detail-item-name">EIN:</span>
                <span className="case-detail-item-value">{caseDetail.debtor.taxId}</span>
              </div>
            )}
            {caseDetail.debtor.ssn && (
              <div
                data-testid="case-detail-debtor-ssn"
                aria-label="debtor social security number or individual taxpayer identification number"
              >
                <span className="case-detail-item-name">SSN/ITIN:</span>
                <span className="case-detail-item-value">{caseDetail.debtor.ssn}</span>
              </div>
            )}
            {!caseDetail.debtor.taxId && !caseDetail.debtor.ssn && (
              <div
                data-testid="case-detail-debtor-no-taxids"
                aria-label="debtor tax identification"
              >
                {taxIdUnavailable}
              </div>
            )}
            <div data-testid="case-detail-debtor-type" aria-label="debtor type">
              {caseDetail.debtorTypeLabel}
            </div>
            <LegacyFormattedContact legacy={caseDetail.debtor} testIdPrefix="case-detail-debtor" />
          </div>
          <div className="debtor-counsel-information record-detail-card">
            <h3>Debtor&apos;s Counsel</h3>
            {caseDetail.debtorAttorney && (
              <>
                <div data-testid="case-detail-debtor-counsel-name" aria-label="debtor counsel name">
                  {caseDetail.debtorAttorney.name}
                </div>
                {caseDetail.debtorAttorney.office && (
                  <div
                    data-testid="case-detail-debtor-counsel-office"
                    aria-label="debtor counsel office"
                  >
                    {caseDetail.debtorAttorney.office}
                  </div>
                )}
                <LegacyFormattedContact
                  legacy={caseDetail.debtorAttorney}
                  testIdPrefix="case-detail-debtor-counsel"
                  emailSubject={`${getCaseNumber(caseDetail.caseId)} - ${caseDetail.caseTitle}`}
                />
              </>
            )}
            {!caseDetail.debtorAttorney && (
              <div data-testid="case-detail-no-debtor-attorney" aria-label="debtor attorney">
                {informationUnavailable}
              </div>
            )}
          </div>
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
