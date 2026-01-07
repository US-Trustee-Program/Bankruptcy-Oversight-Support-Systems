import './CaseDetailOverview.scss';
import { getCaseNumber } from '@/lib/utils/caseNumber';
import { isJointAdministrationChildCase } from '@common/cams/events';
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
import useFeatureFlags, { VIEW_TRUSTEE_ON_CASE } from '@/lib/hooks/UseFeatureFlags';
import DatesCard from './cards/DatesCard';
import DebtorCard from './cards/DebtorCard';
import { composeCaseTitle } from '../caseDetailHelper';

const informationUnavailable = 'Information is not available.';

export interface CaseDetailOverviewProps {
  caseDetail: CaseDetail;
  showReopenDate: boolean;
  onCaseAssignment: (props: AssignAttorneyModalCallbackProps) => void;
}

function CaseDetailOverview(props: Readonly<CaseDetailOverviewProps>) {
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
          <DatesCard
            dateFiled={caseDetail.dateFiled}
            reopenedDate={caseDetail.reopenedDate}
            closedDate={caseDetail.closedDate}
            dismissedDate={caseDetail.dismissedDate}
            showReopenDate={showReopenDate}
          />
          {!featureFlags[VIEW_TRUSTEE_ON_CASE] && (
            <div className="assigned-staff-information usa-card">
              <div className="usa-card__container">
                <div className="usa-card__body">
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
                        Region {caseDetail.regionId.replace(/^0*/, '')} - {caseDetail.officeName}{' '}
                        Office
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
            </div>
          )}
          {!featureFlags[VIEW_TRUSTEE_ON_CASE] && (
            <div className="judge-information usa-card">
              <div className="usa-card__container">
                <div className="usa-card__body">
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
              </div>
            </div>
          )}
        </div>
        <DebtorCard
          title={`Debtor - ${caseDetail.debtor.name}`}
          debtor={caseDetail.debtor}
          debtorTypeLabel={caseDetail.debtorTypeLabel}
          attorney={caseDetail.debtorAttorney}
          caseId={getCaseNumber(caseDetail.caseId)}
          caseTitle={composeCaseTitle(caseDetail)}
          testIdPrefix="case-detail-debtor"
        />
        {caseDetail.jointDebtor && (
          <DebtorCard
            title={`Joint Debtor - ${caseDetail.jointDebtor.name}`}
            debtor={caseDetail.jointDebtor}
            attorney={caseDetail.jointDebtorAttorney}
            caseId={getCaseNumber(caseDetail.caseId)}
            caseTitle={composeCaseTitle(caseDetail)}
            testIdPrefix="case-detail-joint-debtor"
          />
        )}
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

export default CaseDetailOverview;
