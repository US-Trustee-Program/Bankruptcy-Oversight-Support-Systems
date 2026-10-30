import { NewTabLink } from '@/lib/components/cams/NewTabLink/NewTabLink';
import Icon from '@/lib/components/uswds/Icon';
import {
  candidateAddress,
  ComparisonCandidate,
  ComparisonCell,
  TrusteeComparison,
} from './trustee-comparison';

type DifferenceIconProps = { label: string };

/**
 * The single marker for a field that differs from the source record. The icon carries its own
 * accessible name so a screen reader announces it on hover/touch exploration as well as in a
 * full read, and the meaning never rests on color alone (WCAG 1.4.1).
 */
export function DifferenceIcon({ label }: DifferenceIconProps) {
  const description = `${label} differs from the source record`;
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

function FieldCell({ cell, label }: { cell: ComparisonCell; label: string }) {
  return (
    <td>
      <span className="comparison-cell-value">
        {cell.value !== undefined && cell.differs && <DifferenceIcon label={label} />}
        {cell.value ?? 'Not Provided'}
      </span>
    </td>
  );
}

function AddressCell({ candidate }: { candidate: ComparisonCandidate }) {
  const { lines, differs } = candidateAddress(candidate.cells);
  return (
    <td>
      <span className="comparison-cell-value">
        {lines.length > 0 && differs && <DifferenceIcon label="Address" />}
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
      <th scope="row">
        <span className="comparison-cell-value">
          {cells.name.differs && <DifferenceIcon label="Name" />}
          <NewTabLink to={`/trustees/${candidate.trusteeId}`} label={candidate.trusteeName} />
        </span>
      </th>
      <AddressCell candidate={candidate} />
      <FieldCell cell={cells.phone} label="Phone" />
      {showEmail && <FieldCell cell={cells.email} label="Email" />}
      {onApprove && (
        <td className="text-no-wrap">
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
  return (
    <div className="trustee-comparison-table-container">
      <table
        className="usa-table usa-table--borderless trustee-comparison-table"
        data-testid="trustee-comparison-table"
        aria-labelledby={labelledBy}
      >
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
          {candidates.map((candidate) => (
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
    </div>
  );
}
