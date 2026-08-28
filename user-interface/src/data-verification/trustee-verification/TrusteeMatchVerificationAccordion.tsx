import './TrusteeMatchVerificationAccordion.scss';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PaginationButton } from '@/lib/components/uswds/PaginationButton';
import { Accordion } from '@/lib/components/uswds/Accordion';
import { NewTabLink } from '@/lib/components/cams/NewTabLink/NewTabLink';
import Icon from '@/lib/components/uswds/Icon';
import {
  EnrichedTrusteeMatchVerification,
  TrusteeMatchVerificationListItem,
} from '@common/cams/trustee-match-verification';
import { CandidateScore } from '@common/cams/dataflow-events';
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
import { ResponseBody } from '@common/api/response';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';

// A field is a mismatch when it has a comparable score (not null) that isn't a full 100 match.
// null means "not comparable" (e.g. missing phone/email on one side) - absent data, not a mismatch.
function isFieldMismatch(score: number | null): boolean {
  return score !== null && score !== 100;
}

type MismatchIconProps = {
  label: string;
};

/**
 * A red "no match" icon for a CAMS Strongest Match column header, shown only when that field's
 * CandidateScore indicates a mismatch. Meaning is also conveyed via a visually-hidden text label
 * so it's never color-only signaling (WCAG 1.4.1).
 */
function MismatchIcon({ label }: MismatchIconProps) {
  return (
    <span className="mismatch-icon">
      <Icon name="cancel" className="mismatch-icon-symbol" decorative />
      <span className="usa-sr-only">{label} does not match</span>
    </span>
  );
}

type ColumnHeaderProps = {
  label: string;
  mismatch: boolean;
};

function ColumnHeader({ label, mismatch }: ColumnHeaderProps) {
  return (
    <span className="column-header-with-mismatch">
      {label}
      {mismatch && <MismatchIcon label={label} />}
    </span>
  );
}

const FIELD_LABELS = {
  name: 'name',
  address: 'address',
  phone: 'phone',
  email: 'email',
  appointment: 'appointment',
} as const;

// Which fields mismatch between the CAMS Strongest Match candidate and the court-sent trustee
// info, in column order - drives both the header icons and the dynamic problem-statement sentence.
function getMismatchedFieldLabels(candidate: CandidateScore): string[] {
  const labels: string[] = [];
  if (isFieldMismatch(candidate.nameScore)) labels.push(FIELD_LABELS.name);
  if (isFieldMismatch(candidate.addressScore)) labels.push(FIELD_LABELS.address);
  if (isFieldMismatch(candidate.phoneScore)) labels.push(FIELD_LABELS.phone);
  if (isFieldMismatch(candidate.emailScore)) labels.push(FIELD_LABELS.email);
  if (isFieldMismatch(candidate.districtDivisionScore) || isFieldMismatch(candidate.chapterScore)) {
    labels.push(FIELD_LABELS.appointment);
  }
  return labels;
}

// Only called with a non-empty array - the caller (mismatchedFieldsPrefix) already guards on
// mismatchedFields.length before invoking this.
function formatFieldList(fields: string[]): string {
  if (fields.length === 1) return fields[0];
  if (fields.length === 2) return `${fields[0]} and ${fields[1]}`;
  return `${fields.slice(0, -1).join(', ')}, and ${fields[fields.length - 1]}`;
}

type TrusteeSearchLinkProps = {
  linkLabel: string;
  linkMessage?: string;
  className?: string;
  onClick: () => void;
};

type OtherMatchesPaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

function OtherMatchesPagination({
  currentPage,
  totalPages,
  onPageChange,
}: OtherMatchesPaginationProps) {
  const pages: (number | '...')[] = [];

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else if (currentPage < 5) {
    pages.push(1, 2, 3, 4, 5, '...', totalPages);
  } else if (currentPage > totalPages - 4) {
    pages.push(
      1,
      '...',
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    );
  } else {
    pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
  }

  return (
    <nav aria-label="Other matches pagination" className="usa-pagination">
      <ul className="usa-pagination__list">
        {currentPage > 1 && (
          <li className="usa-pagination__item usa-pagination__arrow">
            <PaginationButton
              id="other-matches-previous"
              isPrevious
              onClick={() => onPageChange(currentPage - 1)}
            />
          </li>
        )}
        {pages.map((p, i) =>
          p === '...' ? (
            <li
              key={`ellipsis-${i}`}
              className="usa-pagination__item usa-pagination__overflow"
              aria-label="ellipsis indicating non-visible pages"
            >
              <span>…</span>
            </li>
          ) : (
            <li key={p} className="usa-pagination__item usa-pagination__page-no">
              <PaginationButton
                id={`other-matches-page-${p}`}
                isCurrent={currentPage === p}
                onClick={() => onPageChange(p as number)}
              >
                {p}
              </PaginationButton>
            </li>
          ),
        )}
        {currentPage < totalPages && (
          <li className="usa-pagination__item usa-pagination__arrow">
            <PaginationButton
              id="other-matches-next"
              isNext
              onClick={() => onPageChange(currentPage + 1)}
            />
          </li>
        )}
      </ul>
    </nav>
  );
}

type TrusteeCandidateRowProps = {
  candidate: CandidateScore;
  onApprove?: (candidate: CandidateScore) => void;
  isProcessing?: boolean;
};

function TrusteeCandidateRow({ candidate, onApprove, isProcessing }: TrusteeCandidateRowProps) {
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
        <NewTabLink to={`/trustees/${candidate.trusteeId}`} label={candidate.trusteeName} />
      </div>

      <div className="trustee-data-cell grid-col-2" data-cell="Address">
        {rowAddressLines.length > 0
          ? rowAddressLines.map((line, i, arr) => (
              <span key={i}>
                {line}
                {i < arr.length - 1 && <br />}
              </span>
            ))
          : 'Not Provided'}
      </div>
      <div className="trustee-data-cell grid-col-1" data-cell="Phone">
        {candidate.phone
          ? `${candidate.phone.number}${candidate.phone.extension ? ` x${candidate.phone.extension}` : ''}`
          : 'Not Provided'}
      </div>
      <div className="trustee-data-cell grid-col-2" data-cell="Email">
        {candidate.email ?? 'Not Provided'}
      </div>
      <div className="trustee-data-cell grid-col-3" data-cell="Trustee Appt.">
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
  onApprove?: (candidate: CandidateScore) => void;
  isProcessing?: boolean;
  // Set only for the CAMS Strongest Match table (always exactly one candidate) - shows a
  // mismatch icon on each column header reflecting that candidate's own score. Not set for the
  // Other Potential Matches table (multiple candidates, no single score a header could represent).
  scoreCandidate?: CandidateScore;
  // True for inactive-status tasks (a "perfect" score match whose trustee is inactive) - the
  // Trustee Appointment column always shows a mismatch icon regardless of district/chapter
  // scores, since an inactive trustee is itself an appointment-level problem.
  forceAppointmentMismatch?: boolean;
};

function CandidateTable({
  candidates,
  onApprove,
  isProcessing,
  scoreCandidate,
  forceAppointmentMismatch,
}: CandidateTableProps) {
  // Single source of truth for both the header icons and the problem-statement sentence
  // (getMismatchedFieldLabels) - avoids two independent mismatch computations drifting apart.
  const mismatchedFields = new Set(scoreCandidate ? getMismatchedFieldLabels(scoreCandidate) : []);
  const appointmentMismatch =
    mismatchedFields.has(FIELD_LABELS.appointment) || !!forceAppointmentMismatch;

  return (
    <div className="trustee-data-grid trustee-candidates-grid">
      <div className="trustee-data-header grid-row grid-gap-lg">
        <div className="trustee-data-cell grid-col-2">
          {scoreCandidate ? (
            <ColumnHeader label="Name" mismatch={mismatchedFields.has(FIELD_LABELS.name)} />
          ) : (
            'Name'
          )}
        </div>
        <div className="trustee-data-cell grid-col-2">
          {scoreCandidate ? (
            <ColumnHeader label="Address" mismatch={mismatchedFields.has(FIELD_LABELS.address)} />
          ) : (
            'Address'
          )}
        </div>
        <div className="trustee-data-cell grid-col-1">
          {scoreCandidate ? (
            <ColumnHeader label="Phone" mismatch={mismatchedFields.has(FIELD_LABELS.phone)} />
          ) : (
            'Phone'
          )}
        </div>
        <div className="trustee-data-cell grid-col-2">
          {scoreCandidate ? (
            <ColumnHeader label="Email" mismatch={mismatchedFields.has(FIELD_LABELS.email)} />
          ) : (
            'Email'
          )}
        </div>
        <div className="trustee-data-cell grid-col-3">
          {scoreCandidate ? (
            <ColumnHeader label="Trustee Appointment" mismatch={appointmentMismatch} />
          ) : (
            'Trustee Appointment'
          )}
        </div>
        <div className="trustee-data-cell grid-col-2">Action</div>
      </div>
      {candidates.map((candidate) => (
        <TrusteeCandidateRow
          key={candidate.trusteeId}
          candidate={candidate}
          onApprove={onApprove}
          isProcessing={isProcessing}
        />
      ))}
    </div>
  );
}

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
  order: TrusteeMatchVerificationListItem;
  statusType: Map<string, string>;
  taskType: Map<string, string>;
  fieldHeaders: string[];
  courts?: CourtDivisionDetails[];
  hidden?: boolean;
  onOrderUpdate: (alertDetails: AlertDetails, order: TrusteeMatchVerificationListItem) => void;
}

function enrichWithCourtNames(
  detail: EnrichedTrusteeMatchVerification,
  courts: CourtDivisionDetails[],
): EnrichedTrusteeMatchVerification {
  return {
    ...detail,
    matchCandidates: detail.matchCandidates.map((candidate) => ({
      ...candidate,
      appointments: candidate.appointments?.map((appt) => {
        const court = courts.find(
          (c) => c.courtDivisionCode === appt.divisionCode || c.courtId === appt.courtId,
        );
        return {
          ...appt,
          courtName: appt.courtName ?? court?.courtName,
          courtDivisionName: appt.courtDivisionName ?? court?.courtDivisionName,
        };
      }),
    })),
  };
}

export function TrusteeMatchVerificationAccordion(props: TrusteeMatchVerificationAccordionProps) {
  const { order, hidden, statusType, taskType, fieldHeaders, courts = [], onOrderUpdate } = props;
  const [isProcessing, setIsProcessing] = useState(false);
  const [otherMatchesPage, setOtherMatchesPage] = useState(1);
  const [detail, setDetail] = useState<EnrichedTrusteeMatchVerification | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailLoadError, setDetailLoadError] = useState(false);
  const OTHER_MATCHES_PAGE_SIZE = 5;
  const rejectionModalRef = useRef<TrusteeMatchRejectionModalImperative>(null);
  const confirmationModalRef = useRef<TrusteeMatchConfirmationModalImperative>(null);
  const searchModalRef = useRef<TrusteeSearchModalImperative>(null);

  // Enriched separately from the fetch, keyed off the live `courts` prop, so a courts load
  // that resolves after this detail was fetched still fills in court name/division instead of
  // being permanently baked out.
  const enrichedOrder = useMemo(
    () => (detail ? enrichWithCourtNames(detail, courts) : null),
    [detail, courts],
  );

  async function fetchDetail() {
    if (detail || detailLoadError || isLoadingDetail) return;
    setIsLoadingDetail(true);
    try {
      const response = await Api2.getTrusteeMatchVerificationDetail(order.id);
      setDetail((response as ResponseBody<EnrichedTrusteeMatchVerification>).data);
    } catch {
      setDetailLoadError(true);
    } finally {
      setIsLoadingDetail(false);
    }
  }

  async function handleExpand(_id: string) {
    await fetchDetail();
  }

  // Resolved (approved) tasks show case numbers unconditionally, so their detail must be
  // fetched eagerly rather than waiting on a manual accordion expand — otherwise a page
  // refresh leaves the case list blank until the user re-expands.
  useEffect(() => {
    if (order.status === 'approved') {
      fetchDetail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id, order.status]);

  const { divisionCode } = getCaseIdParts(order.caseId);
  const courtDetails = courts.find((c) => c.courtDivisionCode === divisionCode);
  const courtName = order.courtName ?? courtDetails?.courtName ?? order.courtId;

  // AmbiguousMatchUnresolved no longer guarantees 2+ raw candidates: the first-token-lastName
  // search tier (see matchTrusteeByName in trustee-match.helpers.ts) can surface a single
  // candidate that resolveNameCollisionByScoring then scores below the auto-link threshold,
  // landing here with only one entry in matchCandidates. Labeling that "Multiple Match" is
  // misleading (there are no "other potential matches" to compare against), so this also
  // requires candidateCount >= 2 - a genuine raw-candidate collision, not just a low score.
  const isMultipleMatch =
    order.mismatchReason === TrusteeAppointmentSyncErrorCode.AmbiguousMatchUnresolved &&
    order.candidateCount >= 2;
  const isInactiveStatus =
    order.mismatchReason === TrusteeAppointmentSyncErrorCode.PerfectMatchInactiveStatus;
  const taskTypeLabel = isMultipleMatch
    ? 'Multiple Match'
    : isInactiveStatus
      ? 'Inactive trustee'
      : taskType.get(order.taskType);

  const { legacy } = order.dxtrTrustee;
  const addressLines = [
    legacy?.address1,
    legacy?.address2,
    legacy?.address3,
    legacy?.cityStateZipCountry,
  ].filter(Boolean) as string[];

  // candidatesToShow comes from the enriched detail once loaded; falls back to empty pre-expand
  let candidatesToShow: CandidateScore[] = [];
  if (enrichedOrder) {
    if (isMultipleMatch) {
      candidatesToShow = [...enrichedOrder.matchCandidates].sort(
        (a, b) => b.totalScore - a.totalScore,
      );
    } else if (enrichedOrder.matchCandidates.length > 0) {
      const best = enrichedOrder.matchCandidates.reduce((b, c) =>
        c.totalScore > b.totalScore ? c : b,
      );
      candidatesToShow = [best];
    }
  }

  // preselectedCandidate is pre-computed by the server; use it for pre-expand UI decisions
  const preselected = enrichedOrder
    ? candidatesToShow[0]
    : (order.preselectedCandidate ?? undefined);

  type ViewMode =
    'resolved' | 'pending-with-candidate' | 'readonly-with-candidate' | 'no-candidates';
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

  function getOtherMatchesCount(): number {
    if (!isMultipleMatch) return 0;
    if (enrichedOrder) return Math.max(0, candidatesToShow.length - 1);
    return Math.max(0, order.candidateCount - 1);
  }
  const otherMatchesCount = getOtherMatchesCount();
  useEffect(() => {
    setOtherMatchesPage(1);
  }, [order.id, otherMatchesCount]);

  async function approveTrustee({
    trusteeId,
    trusteeName,
  }: {
    trusteeId: string;
    trusteeName: string;
  }) {
    await Api2.patchTrusteeVerificationOrderApproval(order.id, trusteeId, trusteeName);
    const approvalMessage =
      affectedCaseCount > 1
        ? `Trustee ${trusteeName} appointed to ${affectedCaseCount} cases.`
        : `Trustee ${trusteeName} appointed to case ${getCaseNumber(affectedCaseIds[0])}.`;
    onOrderUpdate(
      {
        message: approvalMessage,
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
    const matchedCandidateName = enrichedOrder?.matchCandidates.find(
      (c) => c.trusteeId === order.resolvedTrusteeId,
    )?.trusteeName;
    return order.resolvedTrusteeName ?? matchedCandidateName ?? order.resolvedTrusteeId ?? '';
  }

  const affectedCaseIds = enrichedOrder?.affectedCaseIds?.length
    ? enrichedOrder.affectedCaseIds
    : [order.caseId];
  const affectedCaseCount = enrichedOrder
    ? enrichedOrder.affectedCaseIds.length
    : order.affectedCaseCount;

  const singleCaseLink = (
    <NewTabLink
      to={`/case-detail/${affectedCaseIds[0]}`}
      label={getCaseNumber(affectedCaseIds[0])}
    />
  );

  const sortedAffectedCaseIds = [...affectedCaseIds].sort();

  const caseLink =
    affectedCaseCount > 1 ? (
      <span data-testid="affected-cases">
        {affectedCaseCount} cases{enrichedOrder ? ':' : ''}
        {enrichedOrder && (
          <span className="affected-cases-list">
            {sortedAffectedCaseIds.map((caseId) => (
              <span key={caseId} className="affected-case-item">
                <NewTabLink to={`/case-detail/${caseId}`} label={getCaseNumber(caseId)} />
              </span>
            ))}
          </span>
        )}
      </span>
    ) : (
      singleCaseLink
    );

  // The problem-statement's leading sentence names the specific mismatching fields once
  // candidate detail has loaded; pre-expand it falls back to today's generic wording.
  const mismatchedFields =
    enrichedOrder && candidatesToShow[0] ? getMismatchedFieldLabels(candidatesToShow[0]) : [];
  const mismatchedFieldsPrefix = mismatchedFields.length
    ? `${formatFieldList(mismatchedFields)} `
    : '';

  // For inactive-status tasks, "appointment" is excluded here - "is inactive in CAMS" already
  // conveys the appointment-level problem, so repeating "appointment" in the field list would
  // be redundant.
  const inactiveOtherMismatchedFields = mismatchedFields.filter(
    (field) => field !== FIELD_LABELS.appointment,
  );
  const inactiveMismatchedFieldsPrefix = inactiveOtherMismatchedFields.length
    ? `${formatFieldList(inactiveOtherMismatchedFields)} `
    : '';

  function renderDetailSection() {
    if (isLoadingDetail) {
      return <LoadingSpinner caption="Loading candidate details..." />;
    }
    if (detailLoadError) {
      return (
        <p className="text-error">Failed to load candidate details. Please try again later.</p>
      );
    }
    if (!enrichedOrder) {
      if (viewMode === 'no-candidates') {
        return (
          <TrusteeSearchLink
            className="no-candidates-message"
            linkMessage="There are no suggested matches in CAMS."
            linkLabel="Search for a trustee"
            onClick={openSearch}
          />
        );
      }
      return null;
    }
    return (
      <>
        {viewMode === 'pending-with-candidate' && preselected && (
          <div className="trustee-match-candidate-section" data-testid="candidate-info">
            {isMultipleMatch ? (
              <>
                <h3>CAMS Strongest Match</h3>
                <CandidateTable
                  candidates={[candidatesToShow[0]]}
                  onApprove={openConfirmation}
                  isProcessing={isProcessing}
                  scoreCandidate={candidatesToShow[0]}
                  forceAppointmentMismatch={isInactiveStatus}
                />
                <h3>Other Potential Matches</h3>
                <p className="other-matches-subtext">
                  Results are ordered from strongest to weakest match. If you don&apos;t find the
                  trustee you&apos;re looking for{' '}
                  <button
                    type="button"
                    onClick={openSearch}
                    className="search-trustee-link search-trustee-inline-link"
                  >
                    search here.
                  </button>
                </p>
                <p className="other-matches-count" data-testid="other-matches-count">
                  {candidatesToShow.slice(1).length} matches
                </p>
                <CandidateTable
                  candidates={candidatesToShow
                    .slice(1)
                    .slice(
                      (otherMatchesPage - 1) * OTHER_MATCHES_PAGE_SIZE,
                      otherMatchesPage * OTHER_MATCHES_PAGE_SIZE,
                    )}
                  onApprove={openConfirmation}
                  isProcessing={isProcessing}
                />
                {candidatesToShow.slice(1).length > OTHER_MATCHES_PAGE_SIZE && (
                  <OtherMatchesPagination
                    currentPage={otherMatchesPage}
                    totalPages={Math.ceil(
                      candidatesToShow.slice(1).length / OTHER_MATCHES_PAGE_SIZE,
                    )}
                    onPageChange={setOtherMatchesPage}
                  />
                )}
              </>
            ) : (
              <>
                <h3>CAMS Strongest Match</h3>
                <CandidateTable
                  candidates={candidatesToShow}
                  onApprove={openConfirmation}
                  isProcessing={isProcessing}
                  scoreCandidate={candidatesToShow[0]}
                  forceAppointmentMismatch={isInactiveStatus}
                />
                <TrusteeSearchLink
                  linkMessage="There are no other suggested matches in CAMS."
                  linkLabel="Search for a different trustee"
                  onClick={openSearch}
                />
              </>
            )}
          </div>
        )}
        {viewMode === 'readonly-with-candidate' && preselected && (
          <>
            {isMultipleMatch ? (
              <>
                <h3>CAMS Strongest Match</h3>
                <CandidateTable
                  candidates={[candidatesToShow[0]]}
                  scoreCandidate={candidatesToShow[0]}
                  forceAppointmentMismatch={isInactiveStatus}
                />
                <h3>Other Potential Matches</h3>
                <p className="other-matches-subtext">
                  Results are ordered from strongest to weakest match. If you don&apos;t find the
                  trustee you&apos;re looking for{' '}
                  <button
                    type="button"
                    onClick={openSearch}
                    className="search-trustee-link search-trustee-inline-link"
                  >
                    search here.
                  </button>
                </p>
                <p className="other-matches-count" data-testid="other-matches-count">
                  {candidatesToShow.slice(1).length} matches
                </p>
                <CandidateTable
                  candidates={candidatesToShow
                    .slice(1)
                    .slice(
                      (otherMatchesPage - 1) * OTHER_MATCHES_PAGE_SIZE,
                      otherMatchesPage * OTHER_MATCHES_PAGE_SIZE,
                    )}
                />
                {candidatesToShow.slice(1).length > OTHER_MATCHES_PAGE_SIZE && (
                  <OtherMatchesPagination
                    currentPage={otherMatchesPage}
                    totalPages={Math.ceil(
                      candidatesToShow.slice(1).length / OTHER_MATCHES_PAGE_SIZE,
                    )}
                    onPageChange={setOtherMatchesPage}
                  />
                )}
              </>
            ) : (
              <>
                <h3>CAMS Strongest Match</h3>
                <CandidateTable
                  candidates={candidatesToShow}
                  scoreCandidate={candidatesToShow[0]}
                  forceAppointmentMismatch={isInactiveStatus}
                />
                <TrusteeSearchLink
                  linkMessage="There are no other suggested matches in CAMS."
                  linkLabel="Search for a different trustee."
                  onClick={openSearch}
                />
              </>
            )}
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
    );
  }

  return (
    <>
      <Accordion
        key={order.id}
        id={`order-list-${order.id}`}
        hidden={hidden}
        onExpand={handleExpand}
      >
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
            aria-label={`${fieldHeaders[1]} on ${formatDate(order.taskDate)}.`}
            data-cell={fieldHeaders[1]}
          >
            {formatDate(order.taskDate)}
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
          {viewMode === 'resolved' && (
            <p className="resolved-statement" data-testid="resolved-statement">
              <span>
                Trustee {getResolvedTrusteeDisplayName()} was appointed to{' '}
                {affectedCaseCount > 1 ? '' : 'case: '}
              </span>
              {caseLink}
            </p>
          )}
          {viewMode !== 'resolved' && (
            <>
              {isInactiveStatus ? (
                inactiveOtherMismatchedFields.length ? (
                  <p className="problem-statement">
                    <span>
                      Trustee is inactive in CAMS and {inactiveMismatchedFieldsPrefix}sent from the
                      court does not match a CAMS Trustee for{' '}
                      {affectedCaseCount > 1 ? '' : 'case: '}
                    </span>
                    {caseLink}
                  </p>
                ) : (
                  <p className="problem-statement">
                    <span>
                      Trustee is inactive in CAMS but was appointed to{' '}
                      {affectedCaseCount > 1 ? '' : 'case: '}
                    </span>
                    {caseLink}
                  </p>
                )
              ) : (
                <p className="problem-statement">
                  <span>
                    Trustee {mismatchedFieldsPrefix}sent from the court does not match a CAMS
                    Trustee for {affectedCaseCount > 1 ? '' : 'case: '}
                  </span>
                  {caseLink}
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
                    {addressLines.length > 0
                      ? addressLines.map((line, i) => (
                          <span key={i}>
                            {line}
                            {i < addressLines.length - 1 && <br />}
                          </span>
                        ))
                      : 'Not Provided'}
                  </div>
                  <div className="trustee-data-cell grid-col-1" data-cell="Phone">
                    {legacy?.phone ?? 'Not Provided'}
                  </div>
                  <div className="trustee-data-cell grid-col-2" data-cell="Email">
                    {legacy?.email ?? 'Not Provided'}
                  </div>
                  <div className="trustee-data-cell grid-col-3 no-border"></div>
                  <div className="trustee-data-cell grid-col-2 no-border"></div>
                </div>
              </div>

              {renderDetailSection()}
            </>
          )}
        </section>
      </Accordion>
      <TrusteeMatchRejectionModal ref={rejectionModalRef} id={order.id} onConfirm={handleReject} />
      <TrusteeMatchConfirmationModal
        ref={confirmationModalRef}
        id={order.id}
        onConfirm={handleApprove}
        isProcessing={isProcessing}
      />
      <TrusteeSearchModal
        ref={searchModalRef}
        id={order.id}
        dxtrTrusteeName={order.dxtrTrustee.fullName}
        courtId={courtDetails?.courtId ?? order.courtId}
        onConfirm={handleManualMatch}
        isProcessing={isProcessing}
      />
    </>
  );
}
