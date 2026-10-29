import './TrusteeMatchVerificationAccordion.scss';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Accordion } from '@/lib/components/uswds/Accordion';
import { NewTabLink } from '@/lib/components/cams/NewTabLink/NewTabLink';
import Icon from '@/lib/components/uswds/Icon';
import Tag from '@/lib/components/uswds/Tag';
import {
  EnrichedTrusteeMatchVerification,
  IdentityMismatchReason,
  TrusteeMatchVerificationListItem,
} from '@common/cams/trustee-match-verification';
import { CourtDivisionDetails } from '@common/cams/courts';
import { formatDate } from '@/lib/utils/datetime';
import { AlertDetails, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { getCaseNumber, getCaseIdParts, CaseSummary } from '@common/cams/cases';
import Api2 from '@/lib/models/api2';
import TrusteeMatchConfirmationModal, {
  ConfirmationCandidate,
  TrusteeMatchConfirmationModalImperative,
} from './TrusteeMatchConfirmationModal';
import TrusteeSearchModal, { TrusteeSearchModalImperative } from './TrusteeSearchModal';
import TrusteeComparisonTable from './TrusteeComparisonTable';
import { buildTrusteeComparison, ComparisonCandidate } from './trustee-comparison';
import { buildTrusteeExplanation } from './trustee-explanation';
import { TrusteeSearchResult } from '@common/cams/trustee-search';
import { ResponseBody } from '@common/api/response';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';

const REASON_LABELS: Record<IdentityMismatchReason, string> = {
  ambiguous: 'Multiple matches',
  'no match': 'No match',
};

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

function toConfirmationCandidate(candidate: ComparisonCandidate): ConfirmationCandidate {
  const { camsRaw } = candidate;
  return {
    trusteeId: candidate.trusteeId,
    trusteeName: candidate.trusteeName,
    address: camsRaw.address,
    phone: camsRaw.phone,
    email: camsRaw.email,
  };
}

export interface TrusteeMatchVerificationAccordionProps {
  order: TrusteeMatchVerificationListItem;
  statusType: Map<string, string>;
  taskType: Map<string, string>;
  fieldHeaders: string[];
  courts?: CourtDivisionDetails[];
  hidden?: boolean;
  onOrderUpdate: (alertDetails: AlertDetails, order: TrusteeMatchVerificationListItem) => void;
  onExpand?: (id: string) => void;
  onCollapse?: (id: string) => void;
  expandedId?: string;
}

export function TrusteeMatchVerificationAccordion(props: TrusteeMatchVerificationAccordionProps) {
  const {
    order,
    hidden,
    statusType,
    taskType,
    fieldHeaders,
    courts = [],
    onOrderUpdate,
    onExpand,
    onCollapse,
    expandedId,
  } = props;
  const [isProcessing, setIsProcessing] = useState(false);
  const [detail, setDetail] = useState<EnrichedTrusteeMatchVerification | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailLoadError, setDetailLoadError] = useState(false);
  const [affectedCaseSummaries, setAffectedCaseSummaries] = useState<CaseSummary[]>([]);
  const confirmationModalRef = useRef<TrusteeMatchConfirmationModalImperative>(null);
  const searchModalRef = useRef<TrusteeSearchModalImperative>(null);
  // isProcessing (state) drives the disabled/spinner UI but only takes effect once React commits
  // a re-render - it can't stop a second invocation that reaches a handler before that commit
  // (e.g. a rapid repeat event, or two calls in the same tick). This ref is mutated synchronously
  // so it blocks re-entrancy immediately, regardless of render timing.
  const isSubmittingRef = useRef(false);
  // Approving swaps the pending view for the resolved one, unmounting the button that opened the
  // modal, so focus is moved to the resolved statement instead of falling to <body>. Set only by
  // an approval made here, so a task that loads already approved never takes focus.
  const justApprovedRef = useRef(false);
  const resolvedStatementRef = useRef<HTMLParagraphElement>(null);

  const { source } = order;
  // Facts come from the findings stored at match time (decision 6) - nothing is re-matched here.
  const comparison = useMemo(
    () => (detail ? buildTrusteeComparison(detail.findings, detail.source) : null),
    [detail],
  );
  const explanation = useMemo(
    () => (detail ? buildTrusteeExplanation(detail.findings) : null),
    [detail],
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

  // Resolved (approved) tasks render their case list and trustee name straight from the list
  // response (order.affectedCaseIds/resolvedTrusteeName) - no detail fetch needed, so skip it
  // even on manual expand rather than issuing a network call with no display benefit.
  async function handleExpand(id: string) {
    if (onExpand) onExpand(id);
    if (order.status === 'approved') return;
    await fetchDetail();
  }

  const { divisionCode } = getCaseIdParts(order.caseId);
  const courtDetails = courts.find((c) => c.courtDivisionCode === divisionCode);
  const taskTypeLabel = taskType.get(order.taskType);
  const reasonLabel = REASON_LABELS[order.mismatchReason];
  const isResolved = order.status === 'approved';
  const canApprove = order.status === 'pending';

  useEffect(() => {
    if (isResolved && justApprovedRef.current) {
      justApprovedRef.current = false;
      resolvedStatementRef.current?.focus();
    }
  }, [isResolved]);

  const { legacy } = order.dxtrTrustee;
  const addressLines = [
    legacy?.address1,
    legacy?.address2,
    legacy?.address3,
    legacy?.cityStateZipCountry,
  ].filter(Boolean) as string[];

  async function approveTrustee({
    trusteeId,
    trusteeName,
  }: {
    trusteeId: string;
    trusteeName: string;
  }) {
    await Api2.patchTrusteeVerificationOrderApproval(order.id, trusteeId, trusteeName);
    justApprovedRef.current = true;
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

  async function handleApprove(candidate: ConfirmationCandidate) {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsProcessing(true);
    try {
      await approveTrustee({ trusteeId: candidate.trusteeId, trusteeName: candidate.trusteeName });
    } catch (error) {
      onOrderUpdate(
        {
          message: error instanceof Error ? error.message : 'Failed to confirm trustee match.',
          type: UswdsAlertStyle.Error,
          timeOut: 8,
        },
        order,
      );
    } finally {
      confirmationModalRef.current?.hide();
      setIsProcessing(false);
      isSubmittingRef.current = false;
    }
  }

  function openConfirmation(candidate: ComparisonCandidate) {
    confirmationModalRef.current?.show(toConfirmationCandidate(candidate));
  }

  function openSearch() {
    searchModalRef.current?.show();
  }

  async function handleManualMatch(result: TrusteeSearchResult) {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsProcessing(true);
    try {
      await approveTrustee({ trusteeId: result.trusteeId, trusteeName: result.name });
    } catch (error) {
      onOrderUpdate(
        {
          message: error instanceof Error ? error.message : 'Failed to confirm trustee match.',
          type: UswdsAlertStyle.Error,
          timeOut: 8,
        },
        order,
      );
    } finally {
      searchModalRef.current?.hide();
      setIsProcessing(false);
      isSubmittingRef.current = false;
    }
  }

  function getResolvedTrusteeDisplayName(): string {
    return order.resolvedTrusteeName ?? order.resolvedTrusteeId ?? '';
  }

  // The resolved view sources affectedCaseIds straight from the list response (already the
  // complete, snapshotted/derived array - see getVerifications), so it never needs detail.
  // Pending tasks use the list response until detail loads, then the detail's live list.
  const affectedCaseIds = isResolved
    ? order.affectedCaseIds.length
      ? order.affectedCaseIds
      : [order.caseId]
    : detail?.affectedCaseIds?.length
      ? detail.affectedCaseIds
      : [order.caseId];
  const affectedCaseCount =
    isResolved || !detail ? order.affectedCaseCount : detail.affectedCaseIds.length;
  const hasFullCaseList = isResolved || !!detail;
  // A task always renders at least its originating case link (see affectedCaseIds), so the
  // header never claims fewer cases than it lists.
  const headerCaseCount = Math.max(affectedCaseCount, 1);

  // Fetched for the manual search modal, which narrows its results to trustees whose
  // appointments cover the task's cases. Gated on detail having loaded: affectedCaseIds is only
  // the real bundle once detail has loaded (pre-expand it's just [order.caseId]).
  // DataVerificationScreen mounts every accordion up front (hidden rows included, filtered via a
  // `hidden` prop rather than conditional rendering), so without this gate every pending
  // verification on the screen would fire this fetch on page load whether or not the row is
  // ever expanded. Also skipped for already-approved orders, matching handleExpand's guard.
  const affectedCaseIdsKey = affectedCaseIds.join(',');
  const hasDetail = !!detail;
  useEffect(() => {
    if (order.status === 'approved' || !hasDetail) return;
    let cancelled = false;
    // allSettled rather than all: a single rejected lookup (a closed case, one not yet synced,
    // a moved case) would otherwise reject the whole chain and discard every summary that DID
    // load. The backend's approval check remains the authoritative coverage gate regardless.
    Promise.allSettled(
      affectedCaseIdsKey.split(',').map((caseId) => Api2.getCaseSummary(caseId)),
    ).then((results) => {
      if (cancelled) return;
      const loaded = results
        .filter(
          (result): result is PromiseFulfilledResult<ResponseBody<CaseSummary>> =>
            result.status === 'fulfilled',
        )
        .map((result) => result.value.data);
      setAffectedCaseSummaries(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [affectedCaseIdsKey, order.status, hasDetail]);

  // Scoped to the originating case only (order.caseId) -- used solely to narrow the manual
  // search modal's results list, which stays a heuristic regardless (see TrusteeSearchModal's
  // own doc comment).
  const originatingCaseSummary = affectedCaseSummaries.find((c) => c.caseId === order.caseId);

  const singleCaseLink = (
    <NewTabLink
      to={`/case-detail/${affectedCaseIds[0]}`}
      label={getCaseNumber(affectedCaseIds[0])}
    />
  );

  const sortedAffectedCaseIds = [...affectedCaseIds].sort();

  // Without the full case list (detail failed to load), a multi-case task shows only its count.
  const caseLink =
    affectedCaseCount > 1 ? (
      <span data-testid="affected-cases">
        {affectedCaseCount} cases{hasFullCaseList ? ':' : ''}
        {hasFullCaseList && (
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

  function renderDetailSection() {
    if (isLoadingDetail) {
      return <LoadingSpinner caption="Loading candidate details..." />;
    }
    if (detailLoadError) {
      return (
        <p className="text-error">Failed to load candidate details. Please try again later.</p>
      );
    }
    if (!comparison) return null;

    const hasCandidates = comparison.candidates.length > 0;
    return (
      <div className="trustee-match-candidate-section" data-testid="candidate-info">
        {explanation?.showNameInterpretation && (
          <div data-testid="name-interpretation">
            <h3>How CAMS read this name</h3>
            <p>{detail?.findings.sourceRaw.fullName}</p>
          </div>
        )}
        <h3 id={`potential-matches-heading-${order.id}`}>Potential Matches</h3>
        <p className="other-matches-subtext">
          Results are ordered from strongest to weakest match. A{' '}
          <Icon
            name="warning"
            className="difference-icon-symbol"
            decorative={false}
            tooltip="warning icon"
          />{' '}
          marks information that differs from what was sent.
        </p>
        <TrusteeComparisonTable
          comparison={comparison}
          sourceLabel={`Source record (${source})`}
          onApprove={canApprove ? openConfirmation : undefined}
          isProcessing={isProcessing}
          labelledBy={`potential-matches-heading-${order.id}`}
        />
        <TrusteeSearchLink
          className={hasCandidates ? undefined : 'no-candidates-message'}
          linkMessage={
            hasCandidates
              ? "If you don't find the trustee you're looking for,"
              : 'There are no suggested matches in CAMS.'
          }
          linkLabel="Search for a trustee"
          onClick={openSearch}
        />
      </div>
    );
  }

  return (
    <>
      <Accordion
        key={order.id}
        id={`order-list-${order.id}`}
        hidden={hidden}
        expandedId={expandedId}
        onExpand={handleExpand}
        onCollapse={onCollapse}
      >
        <section
          className="accordion-heading grid-row grid-gap-lg"
          data-testid={`accordion-heading-${order.id}`}
        >
          <div
            className="accordion-header-field grid-col-6 text-no-wrap"
            aria-label={`${fieldHeaders[0]} – ${order.dxtrTrustee.fullName}.`}
            data-cell={fieldHeaders[0]}
          >
            {order.dxtrTrustee.fullName}
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
          {isResolved ? (
            <p
              className="resolved-statement"
              data-testid="resolved-statement"
              ref={resolvedStatementRef}
              tabIndex={-1}
            >
              <span>
                Trustee {getResolvedTrusteeDisplayName()} was appointed to{' '}
                {affectedCaseCount > 1 ? '' : 'case: '}
              </span>
              {caseLink}
            </p>
          ) : (
            <>
              <div className="identity-task-header" data-testid="identity-task-header">
                {reasonLabel && (
                  <span className="identity-task-reason" data-testid="identity-task-reason">
                    {reasonLabel}
                  </span>
                )}
                <Tag id={`identity-task-source-${order.id}`} title={`Source: ${source}`}>
                  {source}
                </Tag>
                <span className="identity-task-case-count" data-testid="identity-task-case-count">
                  {headerCaseCount === 1 ? '1 case' : `${headerCaseCount} cases`}
                </span>
              </div>
              {explanation || detailLoadError ? (
                <p className="problem-statement">
                  <span>
                    {explanation ? `${explanation.sentence} ` : ''}Affects{' '}
                    {affectedCaseCount > 1 ? '' : '1 case: '}
                  </span>
                  {caseLink}
                </p>
              ) : (
                <p className="problem-statement" data-testid="affected-cases-loading">
                  Loading&hellip;
                </p>
              )}
              {renderDetailSection()}
            </>
          )}
        </section>
      </Accordion>
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
        dxtrTrusteeAddressLines={addressLines}
        dxtrTrusteePhone={legacy?.phone}
        dxtrTrusteeEmail={legacy?.email}
        courtId={courtDetails?.courtId ?? order.courtId}
        divisionCode={divisionCode}
        chapter={originatingCaseSummary?.chapter}
        affectedCases={affectedCaseSummaries}
        onConfirm={handleManualMatch}
        isProcessing={isProcessing}
      />
    </>
  );
}
