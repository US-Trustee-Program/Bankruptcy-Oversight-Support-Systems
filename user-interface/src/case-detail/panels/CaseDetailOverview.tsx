import { getCaseNumber } from '@/lib/utils/caseNumber';
import { formatDate, sortByDateReverse } from '@/lib/utils/datetime';
import { CaseNumber } from '@/lib/components/CaseNumber';
import { isJointAdministrationChildCase, Transfer } from '@common/cams/events';
import { CaseDetail, isChildCase, isLeadCase } from '@common/cams/cases';
import { consolidationTypeMap } from '@/lib/utils/labels';
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
import Icon from '@/lib/components/uswds/Icon';
import { OpenModalButtonRef } from '../../lib/components/uswds/modal/modal-refs';
import useFeatureFlags, { VIEW_TRUSTEE_ON_CASE } from '@/lib/hooks/UseFeatureFlags';

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

  function sortTransfers(a: Transfer, b: Transfer) {
    return sortByDateReverse(a.orderDate, b.orderDate);
  }

  function handleCaseAssignment(props: AssignAttorneyModalCallbackProps) {
    onCaseAssignment(props);
    assignmentModalRef.current?.hide();
    openModalButtonRef.current?.focus();
  }

  const isAmbiguousTransferIn =
    !!caseDetail.petitionCode && ['TI', 'TV'].includes(caseDetail.petitionCode);
  const isAmbiguousTransferOut = !!caseDetail.transferDate;
  const isAmbiguousTransfer =
    caseDetail.transfers?.length === 0 && (isAmbiguousTransferIn || isAmbiguousTransferOut);
  const isVerifiedTransfer = !!caseDetail.transfers?.length && caseDetail.transfers.length > 0;

  return (
    <>
      <div className="grid-col-12 tablet:grid-col-10 desktop:grid-col-8 case-detail-container">
        <div className="case-card-list">
          <div className="date-information case-card">
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
            <div className="assigned-staff-information case-card">
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
          <div className="judge-information case-card">
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
        <div className="case-card-list">
          <div className="debtor-information case-card">
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
            <div>
              {caseDetail.debtor.address1 && (
                <div data-testid="case-detail-debtor-address1" aria-label="debtor address line 1">
                  {caseDetail.debtor.address1}
                </div>
              )}
              {caseDetail.debtor.address2 && (
                <div data-testid="case-detail-debtor-address2" aria-label="debtor address line 2">
                  {caseDetail.debtor.address2}
                </div>
              )}
              {caseDetail.debtor.address3 && (
                <div data-testid="case-detail-debtor-address3" aria-label="debtor address line 3">
                  {caseDetail.debtor.address3}
                </div>
              )}
              {caseDetail.debtor.cityStateZipCountry && (
                <div
                  data-testid="case-detail-debtor-cityStateZipCountry"
                  aria-label="debtor city, state, zip, country"
                >
                  {caseDetail.debtor.cityStateZipCountry}
                </div>
              )}
            </div>
          </div>
          <div className="debtor-counsel-information case-card">
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
                <div>
                  {caseDetail.debtorAttorney.address1 && (
                    <div
                      data-testid="case-detail-debtor-counsel-address1"
                      aria-label="debtor counsel address line 1"
                    >
                      {caseDetail.debtorAttorney.address1}
                    </div>
                  )}
                  {caseDetail.debtorAttorney.address2 && (
                    <div
                      data-testid="case-detail-debtor-counsel-address2"
                      aria-label="debtor counsel address line 2"
                    >
                      {caseDetail.debtorAttorney.address2}
                    </div>
                  )}
                  {caseDetail.debtorAttorney.address3 && (
                    <div
                      data-testid="case-detail-debtor-counsel-address3"
                      aria-label="debtor counsel address line 3"
                    >
                      {caseDetail.debtorAttorney.address3}
                    </div>
                  )}
                  {caseDetail.debtorAttorney.cityStateZipCountry && (
                    <div
                      data-testid="case-detail-debtor-counsel-cityStateZipCountry"
                      aria-label="debtor counsel city, state, zip, country"
                    >
                      {caseDetail.debtorAttorney.cityStateZipCountry}
                    </div>
                  )}
                </div>
                {caseDetail.debtorAttorney.phone && (
                  <div
                    data-testid="case-detail-debtor-counsel-phone"
                    aria-label="debtor counsel phone"
                  >
                    {caseDetail.debtorAttorney.phone}
                  </div>
                )}
                {caseDetail.debtorAttorney.email && (
                  <div
                    data-testid="case-detail-debtor-counsel-email"
                    aria-label="debtor counsel email"
                  >
                    <a
                      href={`mailto:${caseDetail.debtorAttorney.email}?subject=${getCaseNumber(
                        caseDetail.caseId,
                      )} - ${caseDetail.caseTitle}`}
                    >
                      {caseDetail.debtorAttorney.email}
                      <Icon className="link-icon" name="mail_outline" />
                    </a>
                  </div>
                )}
              </>
            )}
            {!caseDetail.debtorAttorney && (
              <div data-testid="case-detail-no-debtor-attorney" aria-label="debtor attorney">
                {informationUnavailable}
              </div>
            )}
          </div>
          {!!caseDetail.consolidation?.length && caseDetail.consolidation.length > 0 && (
            <>
              <h3>Consolidation</h3>
              <div className="consolidation case-card">
                <h4>{consolidationTypeMap.get(caseDetail.consolidation[0].consolidationType)}</h4>
                <div>
                  {isLeadCase(caseDetail) && (
                    <span className="case-detail-item-name">Lead Case: (this case)</span>
                  )}
                  {isChildCase(caseDetail) && (
                    <>
                      <span className="case-detail-item-name">Lead Case:</span>
                      <CaseNumber
                        caseId={caseDetail.consolidation[0].otherCase.caseId}
                        className="usa-link case-detail-item-value"
                        data-testid={`case-detail-consolidation-link`}
                      />{' '}
                      <span className="case-detail-title-value">
                        {caseDetail.consolidation[0].otherCase.caseTitle}
                      </span>
                    </>
                  )}
                </div>
                {isLeadCase(caseDetail) && (
                  <div>
                    <span className="case-detail-consolidated-case-count">
                      Cases Consolidated: {caseDetail.consolidation.length + 1}
                    </span>
                  </div>
                )}
                <div>
                  <span className="case-detail-item-name">Order Filed:</span>
                  <span
                    className="case-detail-item-value"
                    data-testid={`case-detail-consolidation-order`}
                  >
                    {formatDate(caseDetail.consolidation[0].orderDate)}
                  </span>
                </div>
              </div>
            </>
          )}
          {isAmbiguousTransfer && (
            <>
              <h3>Transferred Case</h3>
              <p data-testid="ambiguous-transfer-text">
                This case was transferred {isAmbiguousTransferOut ? 'to' : 'from'} another court.
                Review the docket for further details.
              </p>
            </>
          )}
          {isVerifiedTransfer && (
            <>
              <h3 data-testid="verified-transfer-header">Transferred Case</h3>
              <ul className="usa-list usa-list--unstyled transfers case-card">
                {caseDetail.transfers
                  ?.sort(sortTransfers)
                  .map((transfer: Transfer, idx: number) => {
                    return (
                      <li key={idx} className="transfer">
                        <h4>
                          Transferred {transfer.documentType === 'TRANSFER_FROM' ? 'from' : 'to'}:
                        </h4>
                        <div>
                          <span className="case-detail-item-name">Case Number:</span>
                          <CaseNumber
                            caseId={transfer.otherCase.caseId}
                            className="usa-link case-detail-item-value"
                            data-testid={`case-detail-transfer-link-${idx}`}
                          />
                        </div>
                        <div className="transfer-court">
                          <span className="case-detail-item-name">
                            {transfer.documentType === 'TRANSFER_FROM' ? 'Previous' : 'New'} Court:
                          </span>
                          <span
                            className="case-detail-item-value"
                            data-testid={`case-detail-transfer-court-${idx}`}
                          >
                            {transfer.otherCase.courtName} - {transfer.otherCase.courtDivisionName}
                          </span>
                        </div>
                        <div>
                          <span className="case-detail-item-name">Order Filed:</span>
                          <span
                            className="case-detail-item-value"
                            data-testid={`case-detail-transfer-order-${idx}`}
                          >
                            {formatDate(transfer.orderDate)}
                          </span>
                        </div>
                      </li>
                    );
                  })}
              </ul>
            </>
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
