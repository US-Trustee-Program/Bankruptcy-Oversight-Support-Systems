import { NewTabLink } from '@/lib/components/cams/NewTabLink/NewTabLink';
import Icon from '@/lib/components/uswds/Icon';
import { ComparisonCandidate, ComparisonCell, TrusteeComparison } from './trustee-comparison';

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

function CandidateCell({ cell, label }: { cell: ComparisonCell; label: string }) {
  return (
    <td>
      <span className="comparison-cell-value">
        {cell.value ?? 'Not Provided'}
        {cell.value !== undefined && cell.differs && <DifferenceIcon label={label} />}
      </span>
    </td>
  );
}

export type TrusteeComparisonTableProps = {
  comparison: TrusteeComparison;
  sourceLabel: string;
  onApprove?: (candidate: ComparisonCandidate) => void;
  isProcessing?: boolean;
  labelledBy?: string;
};

export default function TrusteeComparisonTable({
  comparison,
  sourceLabel,
  onApprove,
  isProcessing,
  labelledBy,
}: Readonly<TrusteeComparisonTableProps>) {
  const { rows, source, candidates } = comparison;
  return (
    <div className="trustee-comparison-table-container">
      <table
        className="usa-table usa-table--borderless trustee-comparison-table"
        data-testid="trustee-comparison-table"
        aria-labelledby={labelledBy}
      >
        <thead>
          <tr>
            <th scope="col">
              <span className="usa-sr-only">Field</span>
            </th>
            <th scope="col">{sourceLabel}</th>
            {candidates.map((candidate) => (
              <th scope="col" key={candidate.trusteeId}>
                <NewTabLink to={`/trustees/${candidate.trusteeId}`} label={candidate.trusteeName} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, label }) => (
            <tr key={key}>
              <th scope="row">{label}</th>
              <td>{key === 'foundBy' ? '' : (source[key] ?? 'Not Provided')}</td>
              {candidates.map((candidate) => (
                <CandidateCell
                  key={candidate.trusteeId}
                  cell={candidate.cells[key]}
                  label={label}
                />
              ))}
            </tr>
          ))}
        </tbody>
        {onApprove && (
          <tfoot>
            <tr>
              <th scope="row">
                <span className="usa-sr-only">Action</span>
              </th>
              <td></td>
              {candidates.map((candidate) => (
                <td key={candidate.trusteeId} className="text-no-wrap">
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
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
