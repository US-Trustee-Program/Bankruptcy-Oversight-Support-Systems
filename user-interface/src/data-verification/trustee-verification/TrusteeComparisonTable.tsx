import { useMemo, useState } from 'react';
import { NewTabLink } from '@/lib/components/cams/NewTabLink/NewTabLink';
import Icon from '@/lib/components/uswds/Icon';
import { Pagination } from '@/lib/components/uswds/Pagination';
import { Pagination as PaginationModel } from '@common/api/pagination';
import {
  candidateAddress,
  ComparisonCandidate,
  ComparisonCell,
  TrusteeComparison,
} from './trustee-comparison';

const CANDIDATES_PAGE_SIZE = 5;

type DifferenceIconProps = { description: string };

/**
 * The single marker for a value that differs from some reference (the source record here;
 * callers elsewhere supply their own reference description, e.g. CAMS-956's "differs from these
 * cases"). The icon carries its own accessible name so a screen reader announces it on
 * hover/touch exploration as well as in a full read, and the meaning never rests on color alone
 * (WCAG 1.4.1).
 */
export function DifferenceIcon({ description }: DifferenceIconProps) {
  return (
    <span className="difference-icon" title={description}>
      <Icon
        name="warning"
        className="difference-icon-symbol"
        decorative={false}
        tooltip={description}
      />
    </span>
  );
}

type ComparisonColumnsProps = { showEmail: boolean; showAction: boolean };

/**
 * Shared column widths for the Trustee Information Received and Potential Matches tables, so
 * each sent value sits directly above the candidate values it's compared against. The received
 * table renders the Action column with no cells, reserving the same width.
 */
export function ComparisonColumns({ showEmail, showAction }: ComparisonColumnsProps) {
  return (
    <colgroup>
      <col className="comparison-col-name" />
      <col className="comparison-col-address" />
      <col className="comparison-col-phone" />
      {showEmail && <col className="comparison-col-email" />}
      {showAction && <col className="comparison-col-action" />}
    </colgroup>
  );
}

function FieldCell({ cell, label }: { cell: ComparisonCell; label: string }) {
  return (
    <td data-label={label}>
      <span className="comparison-cell-value">
        {cell.value !== undefined && cell.differs && (
          <DifferenceIcon description={`${label} differs from the source record`} />
        )}
        {cell.value ?? 'Not Provided'}
      </span>
    </td>
  );
}

function AddressCell({ candidate }: { candidate: ComparisonCandidate }) {
  const { lines, differs } = candidateAddress(candidate.cells);
  return (
    <td data-label="Address">
      <span className="comparison-cell-value">
        {lines.length > 0 && differs && (
          <DifferenceIcon description="Address differs from the source record" />
        )}
        <span className="address-lines">
          {lines.length > 0
            ? lines.map((line) => (
                <span className="address-line" key={line}>
                  {line}
                </span>
              ))
            : 'Not Provided'}
        </span>
      </span>
    </td>
  );
}

function CandidateRow({
  candidate,
  showEmail,
  onApprove,
  isProcessing,
}: {
  candidate: ComparisonCandidate;
  showEmail: boolean;
  onApprove?: (candidate: ComparisonCandidate) => void;
  isProcessing?: boolean;
}) {
  const { cells } = candidate;
  return (
    <tr>
      <th scope="row" data-label="Name">
        <span className="comparison-cell-value">
          {cells.name.differs && (
            <DifferenceIcon description="Name differs from the source record" />
          )}
          <NewTabLink to={`/trustees/${candidate.trusteeId}`} label={candidate.trusteeName} />
        </span>
      </th>
      <AddressCell candidate={candidate} />
      <FieldCell cell={cells.phone} label="Phone" />
      {showEmail && <FieldCell cell={cells.email} label="Email" />}
      {onApprove && (
        <td className="text-no-wrap" data-label="Action">
          <button
            type="button"
            data-testid={`approve-candidate-${candidate.trusteeId}`}
            onClick={() => onApprove(candidate)}
            disabled={isProcessing}
            className="match-trustee-link"
            aria-label={`Match Trustee ${candidate.trusteeName}`}
          >
            <Icon name="check" />
            Match Trustee
          </button>
        </td>
      )}
    </tr>
  );
}

export type TrusteeComparisonTableProps = {
  comparison: TrusteeComparison;
  onApprove?: (candidate: ComparisonCandidate) => void;
  isProcessing?: boolean;
  labelledBy?: string;
};

export default function TrusteeComparisonTable({
  comparison,
  onApprove,
  isProcessing,
  labelledBy,
}: Readonly<TrusteeComparisonTableProps>) {
  const { rows, candidates } = comparison;
  const showEmail = rows.some((row) => row.key === 'email');
  const [offset, setOffset] = useState(0);
  // Reset to page 1 when a new candidate list arrives.
  const [prevCandidates, setPrevCandidates] = useState(candidates);
  if (candidates !== prevCandidates) {
    setPrevCandidates(candidates);
    setOffset(0);
  }

  const pagedCandidates = useMemo(
    () => candidates.slice(offset, offset + CANDIDATES_PAGE_SIZE),
    [candidates, offset],
  );

  const paginationValues = useMemo((): PaginationModel => {
    return {
      count: pagedCandidates.length,
      limit: CANDIDATES_PAGE_SIZE,
      currentPage: Math.floor(offset / CANDIDATES_PAGE_SIZE) + 1,
      totalPages: Math.ceil(candidates.length / CANDIDATES_PAGE_SIZE),
      totalCount: candidates.length,
    };
  }, [pagedCandidates, candidates, offset]);

  const hasMultiplePages = candidates.length > CANDIDATES_PAGE_SIZE;

  return (
    <div className="trustee-comparison-table-container">
      <table
        className="usa-table usa-table--borderless trustee-comparison-table"
        data-testid="trustee-comparison-table"
        aria-labelledby={labelledBy}
      >
        <ComparisonColumns showEmail={showEmail} showAction={!!onApprove} />
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Address</th>
            <th scope="col">Phone</th>
            {showEmail && <th scope="col">Email</th>}
            {onApprove && <th scope="col">Action</th>}
          </tr>
        </thead>
        <tbody>
          {pagedCandidates.map((candidate) => (
            <CandidateRow
              key={candidate.trusteeId}
              candidate={candidate}
              showEmail={showEmail}
              onApprove={onApprove}
              isProcessing={isProcessing}
            />
          ))}
        </tbody>
      </table>
      {hasMultiplePages && (
        <Pagination<{ limit: number; offset: number }>
          paginationValues={paginationValues}
          searchPredicate={{ limit: CANDIDATES_PAGE_SIZE, offset }}
          retrievePage={(predicate) => setOffset(predicate.offset ?? 0)}
        />
      )}
    </div>
  );
}
