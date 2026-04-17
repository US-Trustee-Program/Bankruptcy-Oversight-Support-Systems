import './TrusteeMatchVerificationAccordion.scss';
import { useRef, useState } from 'react';
import { Accordion } from '@/lib/components/uswds/Accordion';
import { NewTabLink } from '@/lib/components/cams/NewTabLink/NewTabLink';
import Icon from '@/lib/components/uswds/Icon';
import { TrusteeMatchVerification } from '@common/cams/trustee-match-verification';
import { CandidateScore, UNSCORED } from '@common/cams/dataflow-events';
import { CourtDivisionDetails } from '@common/cams/courts';
import { formatDate } from '@/lib/utils/datetime';
import { formatAppointmentStatus } from '@common/cams/trustee-appointments';
import { formatChapterType } from '@common/cams/trustees';
import { AlertDetails, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { TrusteeAppointmentSyncErrorCode } from '@common/cams/dataflow-events';
import { getCaseNumber, getCaseIdParts } from '@common/cams/cases';
import Api2 from '@/lib/models/api2';
import TrusteeMatchRejectionModal, {
  TrusteeMatchRejectionModalImperative,
} from './TrusteeMatchRejectionModal';
import TrusteeMatchConfirmationModal, {
  TrusteeMatchConfirmationModalImperative,
} from './TrusteeMatchConfirmationModal';
import TrusteeSearchModal, { TrusteeSearchModalImperative } from './TrusteeSearchModal';
import { TrusteeSearchResult } from '@common/cams/trustee-search';

type TrusteeSearchLinkProps = {
  linkLabel: string;
  linkMessage?: string;
  className?: string;
  onClick: () => void;
};

function TrusteeSearchLink({
  linkLabel,
  linkMessage,
  className,
  onClick,
}: Readonly<TrusteeSearchLinkProps>) {
  const classes = ['search-link-container', className].filter(Boolean).join(' ');
  return (
    <div className={classes}>
      {linkMessage && <span className="link-message">{linkMessage}</span>}
      <button type="button" onClick={onClick} className="search-trustee-link">
        <Icon name="search" />
        {linkLabel}
      </button>
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
  const searchModalRef = useRef<TrusteeSearchModalImperative>(null);

  const { divisionCode } = getCaseIdParts(order.caseId);
  const courtDetails = courts.find((c) => c.courtDivisionCode === divisionCode);
  const courtName = order.courtName ?? courtDetails?.courtName ?? order.courtId;

  const isMultipleMatch =
    order.mismatchReason === TrusteeAppointmentSyncErrorCode.MultipleTrusteesMatch;
  const isInactiveStatus =
    order.mismatchReason === TrusteeAppointmentSyncErrorCode.PerfectMatchInactiveStatus;
  const taskTypeLabel = isMultipleMatch
    ? 'Multiple Match'
    : isInactiveStatus
      ? 'Inactive trustee'
      : orderType.get(order.orderType);

  const { legacy } = order.dxtrTrustee;
  const addressLines = [
    legacy?.address1,
    legacy?.address2,
    legacy?.address3,
    legacy?.cityStateZipCountry,
  ].filter(Boolean) as string[];

  // For multiple match scenarios, show all candidates ranked by score
  // For other scenarios, show only the strongest match
  const candidatesToShow = isMultipleMatch
    ? [...order.matchCandidates].sort((a, b) => b.totalScore - a.totalScore)
    : order.matchCandidates.length > 0
      ? [order.matchCandidates.reduce((best, c) => (c.totalScore > best.totalScore ? c : best))]
      : [];

  const preselected = candidatesToShow.length > 0 ? candidatesToShow[0] : undefined;

  type ViewMode =
    | 'resolved'
    | 'pending-with-candidate'
    | 'pending-multiple-candidates'
    | 'readonly-with-candidate'
    | 'no-candidates';
  let viewMode: ViewMode;
  if (order.status === 'approved') {
    viewMode = 'resolved';
  } else if (isMultipleMatch && order.status === 'pending' && order.matchCandidates.length > 0) {
    viewMode = 'pending-multiple-candidates';
  } else if (preselected && order.status === 'pending') {
    viewMode = 'pending-with-candidate';
  } else if (preselected) {
    viewMode = 'readonly-with-candidate';
  } else {
    viewMode = 'no-candidates';
  }

  const sortedCandidates = isMultipleMatch
    ? [...order.matchCandidates].sort((a, b) => b.totalScore - a.totalScore)
    : order.matchCandidates;

  async function approveTrustee({
    trusteeId,
    trusteeName,
  }: {
    trusteeId: string;
    trusteeName: string;
  }) {
    await Api2.patchTrusteeVerificationOrderApproval(order.id, trusteeId, trusteeName);
    onOrderUpdate(
      {
        message: `Trustee ${trusteeName} appointed to case ${getCaseNumber(order.caseId)}.`,
        type: UswdsAlertStyle.Success,
        timeOut: 8,
      },
      {
        ...order,
        status: 'approved',
        resolvedTrusteeId: trusteeId,
        resolvedTrusteeName: trusteeName,
      },
    );
  }

  async function handleApprove(candidate: CandidateScore) {
    setIsProcessing(true);
    try {
      await approveTrustee({ trusteeId: candidate.trusteeId, trusteeName: candidate.trusteeName });
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

  function openSearch() {
    searchModalRef.current?.show();
  }

  async function handleManualMatch(result: TrusteeSearchResult) {
    setIsProcessing(true);
    try {
      await approveTrustee({ trusteeId: result.trusteeId, trusteeName: result.name });
    } catch {
      onOrderUpdate(
        { message: 'Failed to confirm trustee match.', type: UswdsAlertStyle.Error, timeOut: 8 },
        order,
      );
    } finally {
      searchModalRef.current?.hide();
      setIsProcessing(false);
    }
  }

  function getResolvedTrusteeDisplayName(): string {
    const matchedCandidateName = order.matchCandidates.find(
      (c) => c.trusteeId === order.resolvedTrusteeId,
    )?.trusteeName;
    return order.resolvedTrusteeName ?? matchedCandidateName ?? order.resolvedTrusteeId ?? '';
  }

  type TrusteeCandidateRowProps = {
    candidate: CandidateScore;
    showScore?: boolean;
    showScoreBreakdown?: boolean;
    isSelected?: boolean;
    onSelect?: () => void;
    onApprove?: (candidate: CandidateScore) => void;
    isProcessing?: boolean;
  };

  function formatScore(score: number): string {
    return score === UNSCORED ? 'N/A' : String(score);
  }

  function TrusteeCandidateRow({
    candidate,
    showScore = false,
    showScoreBreakdown = false,
    isSelected,
    onSelect,
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

    const hasRadio = !!onSelect;
    const hasScoreBreakdown = showScoreBreakdown;

    // Grid column sizing depends on which optional columns are active
    let apptColSize = 'grid-col-3';
    if (hasRadio && hasScoreBreakdown) apptColSize = 'grid-col-2';
    else if (hasScoreBreakdown || showScore) apptColSize = 'grid-col-2';

    return (
      <div className={`trustee-data-row grid-row grid-gap-lg${isSelected ? ' selected' : ''}`}>
        {hasRadio && (
          <div className="trustee-data-cell candidate-radio-cell grid-col-1" data-cell="Select">
            <input
              type="radio"
              name="candidate-selection"
              checked={!!isSelected}
              onChange={onSelect}
              aria-label={`Select ${candidate.trusteeName}`}
              data-testid={`select-candidate-${candidate.trusteeId}`}
            />
          </div>
        )}
        <div
          className="trustee-data-cell grid-col-2"
          data-cell="Name"
          data-testid={`candidate-name-${candidate.trusteeId}`}
        >
          {candidate.trusteeName}
        </div>
        {hasScoreBreakdown && (
          <div
            className="trustee-data-cell candidate-scores-cell grid-col-2"
            data-cell="Scores"
            data-testid={`candidate-scores-${candidate.trusteeId}`}
          >
            <div>
              <span className="score-label">Total:</span> {formatScore(candidate.totalScore)}
            </div>
            <div>
              <span className="score-label">Addr:</span> {formatScore(candidate.addressScore)}
            </div>
            <div>
              <span className="score-label">Dist:</span>{' '}
              {formatScore(candidate.districtDivisionScore)}
            </div>
            <div>
              <span className="score-label">Chap:</span> {formatScore(candidate.chapterScore)}
            </div>
          </div>
        )}
        {!hasScoreBreakdown && showScore && (
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
        <div className={`trustee-data-cell ${apptColSize}`} data-cell="Trustee Appt.">
          {candidate.appointments?.map((appt, i, arr) => (
            <span key={i}>
              {appt.courtName}
              {appt.courtDivisionName ? ` (${appt.courtDivisionName})` : ''}: Chap{' '}
              {formatChapterType(appt.chapter)} - {formatAppointmentStatus(appt.status)}
              {i < arr.length - 1 && <br />}
            </span>
          ))}
        </div>
        {!hasRadio && (
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
        )}
      </div>
    );
  }

  type CandidateTableProps = {
    candidates: CandidateScore[];
    showScore?: boolean;
    showScoreBreakdown?: boolean;
    nameColumnHeader?: string;
    selectedCandidateId?: string | null;
    onSelectCandidate?: (trusteeId: string) => void;
    onApprove?: (candidate: CandidateScore) => void;
    isProcessing?: boolean;
  };

  function CandidateTable({
    candidates,
    showScore = false,
    showScoreBreakdown = false,
    nameColumnHeader = 'Name',
    selectedCandidateId,
    onSelectCandidate,
    onApprove,
    isProcessing,
  }: CandidateTableProps) {
    const hasRadio = !!onSelectCandidate;
    const hasScoreBreakdown = showScoreBreakdown;

    let apptColSize = 'grid-col-3';
    if (hasRadio && hasScoreBreakdown) apptColSize = 'grid-col-2';
    else if (hasScoreBreakdown || showScore) apptColSize = 'grid-col-2';

    const rows = candidates.map((candidate) => (
      <TrusteeCandidateRow
        key={candidate.trusteeId}
        candidate={candidate}
        showScore={showScore}
        showScoreBreakdown={showScoreBreakdown}
        isSelected={selectedCandidateId === candidate.trusteeId}
        onSelect={onSelectCandidate ? () => onSelectCandidate(candidate.trusteeId) : undefined}
        onApprove={onApprove}
        isProcessing={isProcessing}
      />
    ));

    return (
      <div className="trustee-data-grid trustee-candidates-grid">
        <div className="trustee-data-header grid-row grid-gap-lg">
          {hasRadio && <div className="trustee-data-cell grid-col-1">Select</div>}
          <div className="trustee-data-cell grid-col-2">{nameColumnHeader}</div>
          {hasScoreBreakdown && <div className="trustee-data-cell grid-col-2">Scores</div>}
          {!hasScoreBreakdown && showScore && (
            <div className="trustee-data-cell grid-col-1">Score</div>
          )}
          <div className="trustee-data-cell grid-col-2">Address</div>
          <div className="trustee-data-cell grid-col-1">Phone</div>
          <div className="trustee-data-cell grid-col-2">Email</div>
          <div className={`trustee-data-cell ${apptColSize}`}>Trustee Appointment</div>
          {!hasRadio && <div className="trustee-data-cell grid-col-2">Action</div>}
        </div>
        {hasRadio ? (
          <fieldset className="candidate-selection-fieldset">
            <legend className="usa-sr-only">Select a trustee candidate</legend>
            {rows}
          </fieldset>
        ) : (
          rows
        )}
      </div>
    );
  }

  const caseLink = (
    <NewTabLink to={`/case-detail/${order.caseId}`} label={getCaseNumber(order.caseId)} />
  );

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
              aria-label={`${fieldHeaders[2]} - ${taskTypeLabel}.`}
            >
              {taskTypeLabel}
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
              Trustee {getResolvedTrusteeDisplayName()} was appointed to case: {caseLink}
            </p>
          ) : (
            <>
              {isMultipleMatch ? (
                <p className="problem-statement">
                  Multiple potential trustee matches found for case: {caseLink}. Please review the
                  candidates below and select the correct trustee.
                </p>
              ) : isInactiveStatus ? (
                <p className="problem-statement">
                  Trustee is inactive in CAMS but was appointed to case: {caseLink}
                </p>
              ) : (
                <p className="problem-statement">
                  Trustee sent from the court does not match a CAMS Trustee for case: {caseLink}
                </p>
              )}

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

              <h3>{isMultipleMatch ? 'Potential Matches' : 'CAMS Strongest Match'}</h3>
              {viewMode === 'pending-multiple-candidates' && (
                <div
                  className="trustee-match-candidate-section"
                  data-testid="multiple-candidates-info"
                >
                  <p className="candidate-description">
                    Results are ordered from strongest to weakest match. If you don&apos;t find the
                    trustee you&apos;re looking for{' '}
                    <button
                      type="button"
                      onClick={openSearch}
                      className="search-trustee-inline-link"
                    >
                      search here
                    </button>
                    .
                  </p>
                  <p className="candidate-count" data-testid="candidate-count">
                    {sortedCandidates.length} matches
                  </p>
                  <CandidateTable
                    candidates={sortedCandidates}
                    nameColumnHeader="Trustee"
                    onApprove={openConfirmation}
                    isProcessing={isProcessing}
                  />
                </div>
              )}
              {viewMode === 'pending-multiple-candidates' && (
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
              {viewMode === 'pending-with-candidate' && preselected && (
                <div className="trustee-match-candidate-section" data-testid="candidate-info">
                  <CandidateTable
                    candidates={candidatesToShow}
                    showScore={isMultipleMatch}
                    onApprove={openConfirmation}
                    isProcessing={isProcessing}
                  />
                  <TrusteeSearchLink
                    linkMessage={
                      isMultipleMatch
                        ? 'Multiple matches found with similar scores.'
                        : 'There are no other suggested matches in CAMS.'
                    }
                    linkLabel="Search for a different trustee"
                    onClick={openSearch}
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
                  <CandidateTable
                    candidates={isMultipleMatch ? sortedCandidates : [preselected]}
                    nameColumnHeader={isMultipleMatch ? 'Trustee' : undefined}
                  />
                  <TrusteeSearchLink
                    linkMessage={
                      isMultipleMatch
                        ? 'Multiple matches found with similar scores.'
                        : 'There are no other suggested matches in CAMS.'
                    }
                    linkLabel="Search for a different trustee."
                    onClick={openSearch}
                  />
                </>
              )}
              {viewMode === 'no-candidates' && (
                <TrusteeSearchLink
                  className="no-candidates-message"
                  linkMessage="There are no suggested matches in CAMS."
                  linkLabel="Search for a trustee"
                  onClick={openSearch}
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
      <TrusteeSearchModal
        ref={searchModalRef}
        id={order.id}
        dxtrTrusteeName={order.dxtrTrustee.fullName}
        courtId={courtDetails?.courtId ?? order.courtId}
        onConfirm={handleManualMatch}
      />
    </>
  );
}
