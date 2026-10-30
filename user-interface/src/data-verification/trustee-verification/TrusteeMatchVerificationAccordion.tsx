import './TrusteeMatchVerificationAccordion.scss';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Accordion } from '@/lib/components/uswds/Accordion';
import { NewTabLink } from '@/lib/components/cams/NewTabLink/NewTabLink';
import Icon from '@/lib/components/uswds/Icon';
import {
  EnrichedTrusteeMatchVerification,
  TrusteeMatchVerificationListItem,
} from '@common/cams/trustee-match-verification';
import { CourtDivisionDetails } from '@common/cams/courts';
import { formatDate } from '@/lib/utils/datetime';
import { AlertDetails, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { getCaseNumber, getCaseIdParts } from '@common/cams/cases';
import Api2 from '@/lib/models/api2';
import TrusteeMatchConfirmationModal, {
  TrusteeMatchConfirmationModalImperative,
} from './TrusteeMatchConfirmationModal';
import TrusteeSearchModal, { TrusteeSearchModalImperative } from './TrusteeSearchModal';
import { ModalShowOptions } from '@/lib/components/uswds/modal/Modal';
import TrusteeComparisonTable from './TrusteeComparisonTable';
import TrusteeInformationReceivedTable from './TrusteeInformationReceivedTable';
import {
  buildTrusteeComparison,
  SelectedTrustee,
  selectedTrusteeFromSearch,
} from './trustee-comparison';
import { buildTrusteeExplanation } from './trustee-explanation';
import { TrusteeSearchResult } from '@common/cams/trustee-search';
import { ResponseBody } from '@common/api/response';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';

type TrusteeSearchLinkProps = {
  linkLabel: string;
  linkMessage?: string;
  className?: string;
  buttonRef?: React.RefObject<HTMLButtonElement | null>;
  onClick: () => void;
};

function TrusteeSearchLink({
  linkLabel,
  linkMessage,
  className,
  buttonRef,
  onClick,
}: Readonly<TrusteeSearchLinkProps>) {
  const classes = ['search-link-container', className].filter(Boolean).join(' ');
  return (
    <div className={classes}>
      {linkMessage && <span className="link-message">{linkMessage}</span>}
      <button type="button" ref={buttonRef} onClick={onClick} className="search-trustee-link">
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
  const [originatingCaseChapter, setOriginatingCaseChapter] = useState<string | undefined>();
  const confirmationModalRef = useRef<TrusteeMatchConfirmationModalImperative>(null);
  const searchModalRef = useRef<TrusteeSearchModalImperative>(null);
  // The Search for a trustee button. Named explicitly as the return target of both the search
  // modal and any preview opened from its results, so focus comes back here on Cancel.
  const searchButtonRef = useRef<HTMLButtonElement>(null);
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

  async function handleApprove(selected: SelectedTrustee) {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsProcessing(true);
    try {
      await approveTrustee({ trusteeId: selected.trusteeId, trusteeName: selected.trusteeName });
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

  function openConfirmation(selected: SelectedTrustee, options?: ModalShowOptions) {
    confirmationModalRef.current?.show(selected, options);
  }

  function openSearch() {
    searchModalRef.current?.show({ openModalButtonRef: searchButtonRef });
  }

  function handleSearchSelection(result: TrusteeSearchResult) {
    searchModalRef.current?.hide();
    if (comparison) {
      openConfirmation(selectedTrusteeFromSearch(result, comparison.candidates), {
        openModalButtonRef: searchButtonRef,
      });
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

  // The originating case's chapter narrows the manual search modal's results. Fetched only once
  // detail has loaded: DataVerificationScreen mounts every accordion up front (hidden rows
  // included), so an ungated fetch would fire for every pending task on page load whether or
  // not its row is ever expanded. Also skipped for approved tasks, matching handleExpand's guard.
  const hasDetail = !!detail;
  useEffect(() => {
    if (order.status === 'approved' || !hasDetail) return;
    let cancelled = false;
    Api2.getCaseSummary(order.caseId)
      .then((response) => {
        if (!cancelled) setOriginatingCaseChapter(response.data.chapter);
      })
      .catch(() => {
        // Search falls back to district-only filtering without the chapter.
      });
    return () => {
      cancelled = true;
    };
  }, [order.caseId, order.status, hasDetail]);

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
        <h3 id={`information-received-heading-${order.id}`}>Trustee Information Received</h3>
        <TrusteeInformationReceivedTable comparison={comparison} />
        {hasCandidates && (
          <>
            <h3 id={`potential-matches-heading-${order.id}`}>Potential Matches</h3>
            <p className="other-matches-subtext">
              A{' '}
              <Icon
                name="warning"
                className="difference-icon-symbol subtext-icon"
                decorative={false}
                tooltip="warning icon"
              />{' '}
              icon marks information that differs from what was sent.
            </p>
            <p className="match-count">
              {comparison.candidates.length}{' '}
              {comparison.candidates.length === 1 ? 'match' : 'matches'}
            </p>
            <TrusteeComparisonTable
              comparison={comparison}
              onApprove={canApprove ? openConfirmation : undefined}
              isProcessing={isProcessing}
              labelledBy={`potential-matches-heading-${order.id}`}
            />
          </>
        )}
        <TrusteeSearchLink
          className={hasCandidates ? undefined : 'no-candidates-message'}
          linkMessage={
            hasCandidates
              ? 'There are no other suggested matches in CAMS.'
              : 'There are no suggested matches in CAMS.'
          }
          linkLabel="Search for a trustee"
          buttonRef={searchButtonRef}
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
            className="accordion-header-field grid-col-2 order-type text-no-wrap"
            data-cell={fieldHeaders[0]}
          >
            <span
              className="event-type-label"
              aria-label={`${fieldHeaders[0]} - ${taskTypeLabel}.`}
            >
              {taskTypeLabel}
            </span>
          </div>
          <div
            className="accordion-header-field grid-col-6 text-no-wrap"
            aria-label={`${fieldHeaders[1]} – ${order.dxtrTrustee.fullName}.`}
            data-cell={fieldHeaders[1]}
          >
            {order.dxtrTrustee.fullName}
          </div>
          <div
            className="accordion-header-field grid-col-2 text-no-wrap"
            title="Event date"
            aria-label={`${fieldHeaders[2]} on ${formatDate(order.taskDate)}.`}
            data-cell={fieldHeaders[2]}
          >
            {formatDate(order.taskDate)}
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
      {comparison && (
        <TrusteeMatchConfirmationModal
          ref={confirmationModalRef}
          id={order.id}
          rows={comparison.rows}
          source={comparison.source}
          caseCount={headerCaseCount}
          onConfirm={handleApprove}
          isProcessing={isProcessing}
        />
      )}
      <TrusteeSearchModal
        ref={searchModalRef}
        id={order.id}
        dxtrTrusteeName={order.dxtrTrustee.fullName}
        dxtrTrusteeAddressLines={addressLines}
        dxtrTrusteePhone={legacy?.phone}
        dxtrTrusteeEmail={legacy?.email}
        courtId={courtDetails?.courtId ?? order.courtId}
        divisionCode={divisionCode}
        chapter={originatingCaseChapter}
        onConfirm={handleSearchSelection}
      />
    </>
  );
}
