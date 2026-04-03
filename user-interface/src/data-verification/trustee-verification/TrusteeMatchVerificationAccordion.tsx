import './TrusteeMatchVerificationAccordion.scss';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Accordion } from '@/lib/components/uswds/Accordion';
import { NewTabLink } from '@/lib/components/cams/NewTabLink/NewTabLink';
import Icon from '@/lib/components/uswds/Icon';
import { TrusteeMatchVerification } from '@common/cams/trustee-match-verification';
import { CandidateScore } from '@common/cams/dataflow-events';
import { CourtDivisionDetails } from '@common/cams/courts';
import { formatDate } from '@/lib/utils/datetime';
import { formatAppointmentStatus } from '@common/cams/trustee-appointments';
import { formatChapterType } from '@common/cams/trustees';
import { getCaseNumber, getCaseIdParts } from '@common/cams/cases';
import { AlertDetails, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import Api2 from '@/lib/models/api2';
import TrusteeMatchRejectionModal, {
  TrusteeMatchRejectionModalImperative,
} from './TrusteeMatchRejectionModal';
import TrusteeMatchConfirmationModal, {
  TrusteeMatchConfirmationModalImperative,
} from './TrusteeMatchConfirmationModal';

type TrusteeSearchLinkProps = {
  linkLabel: string;
  linkMessage?: string;
  className?: string;
};

function TrusteeSearchLink({
  linkLabel,
  linkMessage,
  className,
}: Readonly<TrusteeSearchLinkProps>) {
  const classes = ['search-link-container', className].filter(Boolean).join(' ');
  return (
    <div className={classes}>
      {linkMessage && <span className="link-message">{linkMessage}</span>}
      <Link to="/trustee/search" className="search-trustee-link">
        <Icon name="search" />
        {linkLabel}
      </Link>
    </div>
  );
}

export interface TrusteeMatchVerificationAccordionProps {
  order: TrusteeMatchVerification;
  statusType: Map<string, string>;
  orderType: Map<string, string>;
  fieldHeaders: string[];
  courts?: CourtDivisionDetails[];
  hidden?: boolean;
  onOrderUpdate: (alertDetails: AlertDetails, order: TrusteeMatchVerification) => void;
}

export function TrusteeMatchVerificationAccordion(props: TrusteeMatchVerificationAccordionProps) {
  const { order, hidden, statusType, orderType, fieldHeaders, courts = [], onOrderUpdate } = props;
  const [isProcessing, setIsProcessing] = useState(false);
  const rejectionModalRef = useRef<TrusteeMatchRejectionModalImperative>(null);
  const confirmationModalRef = useRef<TrusteeMatchConfirmationModalImperative>(null);

  const { divisionCode } = getCaseIdParts(order.caseId);
  const courtDetails = courts.find((c) => c.courtDivisionCode === divisionCode);
  const courtName = courtDetails?.courtName ?? order.courtId;

  const { legacy } = order.dxtrTrustee;
  const addressLines = [
    legacy?.address1,
    legacy?.address2,
    legacy?.address3,
    legacy?.cityStateZipCountry,
  ].filter(Boolean) as string[];

  const preselected =
    order.matchCandidates.length > 0
      ? order.matchCandidates.reduce((best, c) => (c.totalScore > best.totalScore ? c : best))
      : undefined;

  type ViewMode =
    | 'resolved'
    | 'pending-with-candidate'
    | 'readonly-with-candidate'
    | 'no-candidates';
  let viewMode: ViewMode;
  if (order.status === 'approved') {
    viewMode = 'resolved';
  } else if (preselected && order.status === 'pending') {
    viewMode = 'pending-with-candidate';
  } else if (preselected) {
    viewMode = 'readonly-with-candidate';
  } else {
    viewMode = 'no-candidates';
  }

  async function handleApprove(candidate: CandidateScore) {
    setIsProcessing(true);
    try {
      await Api2.patchTrusteeVerificationOrderApproval(order.id, candidate.trusteeId);
      onOrderUpdate(
        {
          message: `Trustee ${candidate.trusteeName} appointed to case ${getCaseNumber(order.caseId)}.`,
          type: UswdsAlertStyle.Success,
          timeOut: 8,
        },
        { ...order, status: 'approved', resolvedTrusteeId: candidate.trusteeId },
      );
    } catch {
      onOrderUpdate(
        { message: 'Failed to confirm trustee match.', type: UswdsAlertStyle.Error, timeOut: 8 },
        order,
      );
    } finally {
      confirmationModalRef.current?.hide();
      setIsProcessing(false);
    }
  }

  async function handleReject(reason: string) {
    setIsProcessing(true);
    try {
      await Api2.patchTrusteeVerificationOrderRejection(order.id, reason);
      onOrderUpdate(
        { message: 'Trustee match rejected.', type: UswdsAlertStyle.Warning, timeOut: 8 },
        { ...order, status: 'rejected', reason },
      );
    } catch {
      onOrderUpdate(
        { message: 'Failed to reject trustee match.', type: UswdsAlertStyle.Error, timeOut: 8 },
        order,
      );
    } finally {
      rejectionModalRef.current?.hide();
      setIsProcessing(false);
    }
  }

  function openConfirmation(candidate: CandidateScore) {
    confirmationModalRef.current?.show(candidate);
  }

  function openRejection() {
    rejectionModalRef.current?.show();
  }

  type TrusteeCandidateRowProps = {
    candidate: CandidateScore;
    showScore?: boolean;
    onApprove?: (candidate: CandidateScore) => void;
    isProcessing?: boolean;
  };

  function TrusteeCandidateRow({
    candidate,
    showScore = false,
    onApprove,
    isProcessing,
  }: TrusteeCandidateRowProps) {
    const rowAddressLines = candidate.address
      ? [
          candidate.address.address1,
          candidate.address.address2,
          candidate.address.address3,
          `${candidate.address.city}, ${candidate.address.state} ${candidate.address.zipCode}`,
        ].filter(Boolean)
      : [];

    return (
      <div className="trustee-data-row grid-row grid-gap-lg">
        <div
          className="trustee-data-cell grid-col-2"
          data-cell="Name"
          data-testid={`candidate-name-${candidate.trusteeId}`}
        >
          {candidate.trusteeName}
        </div>
        {showScore && (
          <div className="trustee-data-cell grid-col-1" data-cell="Score">
            {candidate.totalScore}
          </div>
        )}
        <div className="trustee-data-cell grid-col-2" data-cell="Address">
          {rowAddressLines.map((line, i, arr) => (
            <span key={i}>
              {line}
              {i < arr.length - 1 && <br />}
            </span>
          ))}
        </div>
        <div className="trustee-data-cell grid-col-1" data-cell="Phone">
          {candidate.phone
            ? `${candidate.phone.number}${candidate.phone.extension ? ` x${candidate.phone.extension}` : ''}`
            : ''}
        </div>
        <div className="trustee-data-cell grid-col-2" data-cell="Email">
          {candidate.email ?? ''}
        </div>
        <div
          className={`trustee-data-cell ${showScore ? 'grid-col-2' : 'grid-col-3'}`}
          data-cell="Trustee Appt."
        >
          {candidate.appointments?.map((appt, i, arr) => (
            <span key={i}>
              {appt.courtName}
              {appt.courtDivisionName ? ` (${appt.courtDivisionName})` : ''}: Chap{' '}
              {formatChapterType(appt.chapter)} - {formatAppointmentStatus(appt.status)}
              {i < arr.length - 1 && <br />}
            </span>
          ))}
        </div>
        <div className="trustee-data-cell grid-col-2 text-no-wrap" data-cell="Action">
          {onApprove && (
            <button
              type="button"
              data-testid={`approve-candidate-${candidate.trusteeId}`}
              onClick={() => onApprove(candidate)}
              disabled={isProcessing}
              className="match-trustee-link"
            >
              <Icon name="check" />
              Match Trustee
            </button>
          )}
        </div>
      </div>
    );
  }

  type CandidateTableProps = {
    candidates: CandidateScore[];
    showScore?: boolean;
    onApprove?: (candidate: CandidateScore) => void;
    isProcessing?: boolean;
  };

  function CandidateTable({
    candidates,
    showScore = false,
    onApprove,
    isProcessing,
  }: CandidateTableProps) {
    return (
      <div className="trustee-data-grid trustee-candidates-grid">
        <div className="trustee-data-header grid-row grid-gap-lg">
          <div className="trustee-data-cell grid-col-2">Name</div>
          {showScore && <div className="trustee-data-cell grid-col-1">Score</div>}
          <div className="trustee-data-cell grid-col-2">Address</div>
          <div className="trustee-data-cell grid-col-1">Phone</div>
          <div className="trustee-data-cell grid-col-2">Email</div>
          <div className={`trustee-data-cell ${showScore ? 'grid-col-2' : 'grid-col-3'}`}>
            Trustee Appointment
          </div>
          <div className="trustee-data-cell grid-col-2">Action</div>
        </div>
        {candidates.map((candidate) => (
          <TrusteeCandidateRow
            key={candidate.trusteeId}
            candidate={candidate}
            showScore={showScore}
            onApprove={onApprove}
            isProcessing={isProcessing}
          />
        ))}
      </div>
    );
  }

  return (
    <>
      <Accordion key={order.id} id={`order-list-${order.id}`} hidden={hidden}>
        <section
          className="accordion-heading grid-row grid-gap-lg"
          data-testid={`accordion-heading-${order.id}`}
        >
          <div
            className="accordion-header-field grid-col-6 text-no-wrap"
            aria-label={`${fieldHeaders[0]} – ${courtName}.`}
            data-cell={fieldHeaders[0]}
          >
            {courtName}
          </div>
          <div
            className="accordion-header-field grid-col-2 text-no-wrap"
            title="Event date"
            aria-label={`${fieldHeaders[1]} on ${formatDate(order.createdOn ?? order.updatedOn)}.`}
            data-cell={fieldHeaders[1]}
          >
            {formatDate(order.createdOn ?? order.updatedOn)}
          </div>
          <div
            className="accordion-header-field grid-col-2 order-type text-no-wrap"
            data-cell={fieldHeaders[2]}
          >
            <span
              className="event-type-label"
              aria-label={`${fieldHeaders[2]} - ${orderType.get(order.orderType)}.`}
            >
              {orderType.get(order.orderType)}
            </span>
          </div>
          <div
            className="accordion-header-field grid-col-2 order-status text-no-wrap"
            data-cell={fieldHeaders[3]}
          >
            <span
              className={`${order.status} event-status-label`}
              aria-label={`${fieldHeaders[3]} - ${statusType.get(order.status)}.`}
            >
              {statusType.get(order.status)}
            </span>
          </div>
        </section>
        <section
          className="accordion-content trustee-match-content"
          data-testid={`accordion-content-${order.id}`}
        >
          {viewMode === 'resolved' ? (
            <p className="resolved-statement" data-testid="resolved-statement">
              Trustee{' '}
              {order.matchCandidates.find((c) => c.trusteeId === order.resolvedTrusteeId)
                ?.trusteeName ?? order.resolvedTrusteeId}{' '}
              was appointed to case:{' '}
              <NewTabLink to={`/case-detail/${order.caseId}`} label={getCaseNumber(order.caseId)} />
            </p>
          ) : (
            <>
              <p className="problem-statement">
                Trustee sent from the court does not match a CAMS Trustee for case:{' '}
                <NewTabLink
                  to={`/case-detail/${order.caseId}`}
                  label={getCaseNumber(order.caseId)}
                />
              </p>

              <h3>Trustee Information Sent By Court</h3>
              <div className="trustee-data-grid trustee-info-grid" data-testid="dxtr-trustee-info">
                <div className="trustee-data-header grid-row grid-gap-lg">
                  <div className="trustee-data-cell grid-col-2">Name</div>
                  <div className="trustee-data-cell grid-col-2">Address</div>
                  <div className="trustee-data-cell grid-col-1">Phone</div>
                  <div className="trustee-data-cell grid-col-2">Email</div>
                  <div className="trustee-data-cell grid-col-3 no-border"></div>
                  <div className="trustee-data-cell grid-col-2 no-border"></div>
                </div>
                <div className="trustee-data-row grid-row grid-gap-lg">
                  <div
                    className="trustee-data-cell grid-col-2"
                    data-cell="Name"
                    data-testid="dxtr-trustee-name"
                  >
                    {order.dxtrTrustee.fullName}
                  </div>
                  <div className="trustee-data-cell grid-col-2" data-cell="Address">
                    {addressLines.map((line, i) => (
                      <span key={i}>
                        {line}
                        {i < addressLines.length - 1 && <br />}
                      </span>
                    ))}
                  </div>
                  <div className="trustee-data-cell grid-col-1" data-cell="Phone">
                    {legacy?.phone ?? ''}
                  </div>
                  <div className="trustee-data-cell grid-col-2" data-cell="Email">
                    {legacy?.email ?? ''}
                  </div>
                  <div className="trustee-data-cell grid-col-3 no-border"></div>
                  <div className="trustee-data-cell grid-col-2 no-border"></div>
                </div>
              </div>

              <h3>CAMS Strongest Match</h3>
              {viewMode === 'pending-with-candidate' && preselected && (
                <div className="trustee-match-candidate-section" data-testid="candidate-info">
                  <CandidateTable
                    candidates={[preselected]}
                    onApprove={openConfirmation}
                    isProcessing={isProcessing}
                  />
                  <TrusteeSearchLink
                    linkMessage="There are no other suggested matches in CAMS."
                    linkLabel="Search for a different trustee"
                  />
                </div>
              )}

              {viewMode === 'pending-with-candidate' && (
                <button
                  type="button"
                  data-testid="reject-button"
                  onClick={openRejection}
                  disabled={isProcessing}
                  className="reject-task-link"
                >
                  <Icon name="delete" />
                  Reject Task
                </button>
              )}
              {viewMode === 'readonly-with-candidate' && preselected && (
                <>
                  <CandidateTable candidates={[preselected]} />
                  <TrusteeSearchLink
                    linkMessage="There are no other suggested matches in CAMS."
                    linkLabel="Search for a different trustee."
                  />
                </>
              )}
              {viewMode === 'no-candidates' && (
                <TrusteeSearchLink
                  className="no-candidates-message"
                  linkMessage="There are no suggested matches in CAMS."
                  linkLabel="Search for a trustee"
                />
              )}
            </>
          )}
        </section>
      </Accordion>
      <TrusteeMatchRejectionModal ref={rejectionModalRef} id={order.id} onConfirm={handleReject} />
      <TrusteeMatchConfirmationModal
        ref={confirmationModalRef}
        id={order.id}
        onConfirm={handleApprove}
      />
    </>
  );
}
