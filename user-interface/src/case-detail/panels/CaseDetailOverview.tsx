import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import { CaseNumber } from '@/lib/components/CaseNumber';
import { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import Icon from '@/lib/components/uswds/Icon';
import { OpenModalButton } from '@/lib/components/uswds/modal/OpenModalButton';
import { getCaseNumber } from '@/lib/utils/caseNumber';
import { formatDate, sortByDateReverse } from '@/lib/utils/datetime';
import { consolidationTypeMap } from '@/lib/utils/labels';
import AssignAttorneyModal from '@/staff-assignment/modal/AssignAttorneyModal';
import {
  AssignAttorneyModalCallbackProps,
  AssignAttorneyModalRef,
} from '@/staff-assignment/modal/assignAttorneyModal.types';
import Actions from '@common/cams/actions';
import { CaseDetail } from '@common/cams/cases';
import { isJointAdministrationChildCase, Transfer } from '@common/cams/events';
import { AttorneyUser } from '@common/cams/users';
import { useRef } from 'react';

import { OpenModalButtonRef } from '../../lib/components/uswds/modal/modal-refs';

const informationUnavailable = 'Information is not available.';
const taxIdUnavailable = 'Tax ID information is not available.';

export interface CaseDetailOverviewProps {
  caseDetail: CaseDetail;
  onCaseAssignment: (props: AssignAttorneyModalCallbackProps) => void;
  showReopenDate: boolean;
}

export default function CaseDetailOverview(props: CaseDetailOverviewProps) {
  const { caseDetail, onCaseAssignment, showReopenDate } = props;

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
      <div className="grid-row grid-gap-lg">
        <span className="case-card-list grid-col-6">
          <div className="date-information padding-bottom-4 case-card">
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
          <div className="assigned-staff-information padding-bottom-4 case-card">
            <h3>
              Assigned Staff{' '}
              {Actions.contains(caseDetail, Actions.ManageAssignments) &&
                caseDetail.chapter === '15' && (
                  <OpenModalButton
                    ariaLabel="Edit assigned staff"
                    modalId={'assignmentModalId'}
                    modalRef={assignmentModalRef}
                    openProps={{ bCase: caseDetail, callback: handleCaseAssignment }}
                    ref={openModalButtonRef}
                    title="Open Staff Assignment window"
                    uswdsStyle={UswdsButtonStyle.Unstyled}
                  >
                    <IconLabel icon="edit" label="Edit" />
                  </OpenModalButton>
                )}
            </h3>
            <div className="assigned-staff-list">
              {caseDetail.regionId && (
                <div
                  aria-label="assigned region and office"
                  className="case-detail-region-id"
                  data-testid="case-detail-region-id"
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
                          <li className="individual-assignee" key={idx}>
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
          <div className="judge-information padding-bottom-4 case-card">
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
          <div className="debtor-information padding-bottom-4 case-card">
            <h3>Debtor</h3>
            <ul className="usa-list usa-list--unstyled">
              <li aria-label="debtor name" data-testid="case-detail-debtor-name">
                {caseDetail.debtor.name}
              </li>
              {caseDetail.debtor.taxId && (
                <li
                  aria-label="debtor employer identification number"
                  data-testid="case-detail-debtor-taxId"
                >
                  <span className="case-detail-item-name">EIN:</span>
                  <span className="case-detail-item-value">{caseDetail.debtor.taxId}</span>
                </li>
              )}
              {caseDetail.debtor.ssn && (
                <li aria-label="debtor social security number" data-testid="case-detail-debtor-ssn">
                  <span className="case-detail-item-name">SSN/ITIN:</span>
                  <span className="case-detail-item-value">{caseDetail.debtor.ssn}</span>
                </li>
              )}
              {!caseDetail.debtor.taxId && !caseDetail.debtor.ssn && (
                <li
                  aria-label="debtor tax identification"
                  data-testid="case-detail-debtor-no-taxids"
                >
                  {taxIdUnavailable}
                </li>
              )}
              <li aria-label="debtor type" data-testid="case-detail-debtor-type">
                {caseDetail.debtorTypeLabel}
              </li>
            </ul>
            {caseDetail.debtor.address1 && (
              <div aria-label="debtor address line 1" data-testid="case-detail-debtor-address1">
                {caseDetail.debtor.address1}
              </div>
            )}
            {caseDetail.debtor.address2 && (
              <div aria-label="debtor address line 2" data-testid="case-detail-debtor-address2">
                {caseDetail.debtor.address2}
              </div>
            )}
            {caseDetail.debtor.address3 && (
              <div aria-label="debtor address line 3" data-testid="case-detail-debtor-address3">
                {caseDetail.debtor.address3}
              </div>
            )}
            {caseDetail.debtor.cityStateZipCountry && (
              <div
                aria-label="debtor city, state, zip, country"
                data-testid="case-detail-debtor-cityStateZipCountry"
              >
                {caseDetail.debtor.cityStateZipCountry}
              </div>
            )}
          </div>
          <div className="debtor-counsel-information padding-bottom-4 case-card">
            <h3>Debtor&apos;s Counsel</h3>
            {caseDetail.debtorAttorney && (
              <>
                <div
                  aria-label="debtor counsel name"
                  className="padding-bottom-1"
                  data-testid="case-detail-debtor-counsel-name"
                >
                  {caseDetail.debtorAttorney.name}
                </div>
                {caseDetail.debtorAttorney.office && (
                  <div
                    aria-label="debtor counsel office"
                    className="padding-bottom-1"
                    data-testid="case-detail-debtor-counsel-office"
                  >
                    {caseDetail.debtorAttorney.office}
                  </div>
                )}
                <div className="padding-bottom-1">
                  {caseDetail.debtorAttorney.address1 && (
                    <div
                      aria-label="debtor counsel address line 1"
                      data-testid="case-detail-debtor-counsel-address1"
                    >
                      {caseDetail.debtorAttorney.address1}
                    </div>
                  )}
                  {caseDetail.debtorAttorney.address2 && (
                    <div
                      aria-label="debtor counsel address line 2"
                      data-testid="case-detail-debtor-counsel-address2"
                    >
                      {caseDetail.debtorAttorney.address2}
                    </div>
                  )}
                  {caseDetail.debtorAttorney.address3 && (
                    <div
                      aria-label="debtor counsel address line 3"
                      data-testid="case-detail-debtor-counsel-address3"
                    >
                      {caseDetail.debtorAttorney.address3}
                    </div>
                  )}
                  {caseDetail.debtorAttorney.cityStateZipCountry && (
                    <div
                      aria-label="debtor counsel city, state, zip, country"
                      data-testid="case-detail-debtor-counsel-cityStateZipCountry"
                    >
                      {caseDetail.debtorAttorney.cityStateZipCountry}
                    </div>
                  )}
                </div>
                {caseDetail.debtorAttorney.phone && (
                  <div
                    aria-label="debtor counsel phone"
                    className="padding-bottom-1"
                    data-testid="case-detail-debtor-counsel-phone"
                  >
                    {caseDetail.debtorAttorney.phone}
                  </div>
                )}
                {caseDetail.debtorAttorney.email && (
                  <div
                    aria-label="debtor counsel email"
                    className="padding-bottom-1"
                    data-testid="case-detail-debtor-counsel-email"
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
              <div aria-label="debtor attorney" data-testid="case-detail-no-debtor-attorney">
                {informationUnavailable}
              </div>
            )}
          </div>
        </span>
        <span className="case-card-list grid-col-6">
          {!!caseDetail.consolidation?.length && caseDetail.consolidation.length > 0 && (
            <>
              <h3>Consolidation</h3>
              <div className="consolidation case-card">
                <h4>{consolidationTypeMap.get(caseDetail.consolidation[0].consolidationType)}</h4>
                <div>
                  {caseDetail.consolidation[0].documentType === 'CONSOLIDATION_FROM' && (
                    <span className="case-detail-item-name">Lead Case: (this case)</span>
                  )}
                  {caseDetail.consolidation[0].documentType === 'CONSOLIDATION_TO' && (
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
                {caseDetail.consolidation[0].documentType === 'CONSOLIDATION_FROM' && (
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
                This case was transfered {isAmbiguousTransferOut ? 'to' : 'from'} another court.
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
                      <li className="transfer" key={idx}>
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
        </span>
      </div>
      <AssignAttorneyModal
        alertMessage={
          isJointAdministrationChildCase(caseDetail.consolidation)
            ? {
                message: 'The assignees for this case will not match the lead case.',
                timeOut: 0,
                type: UswdsAlertStyle.Warning,
              }
            : undefined
        }
        assignmentChangeCallback={() => {}}
        modalId={'assignmentModalId'}
        ref={assignmentModalRef}
      ></AssignAttorneyModal>
    </>
  );
}
