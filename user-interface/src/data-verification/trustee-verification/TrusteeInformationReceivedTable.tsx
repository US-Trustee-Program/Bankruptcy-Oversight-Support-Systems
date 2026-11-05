import { ComparisonColumns } from './TrusteeComparisonTable';
import { sourceAddress, TrusteeComparison } from './trustee-comparison';

export type TrusteeInformationReceivedTableProps = {
  comparison: TrusteeComparison;
  labelledBy?: string;
  /** Reserve the Potential Matches table's Action column so the two tables' columns line up. */
  reserveActionColumn?: boolean;
};

export default function TrusteeInformationReceivedTable({
  comparison,
  labelledBy,
  reserveActionColumn = false,
}: Readonly<TrusteeInformationReceivedTableProps>) {
  const { source, rows } = comparison;
  const showEmail = rows.some((row) => row.key === 'email');
  const lines = sourceAddress(source);
  return (
    <div className="trustee-comparison-table-container">
      <table
        className="usa-table usa-table--borderless trustee-comparison-table"
        data-testid="trustee-information-received-table"
        aria-labelledby={labelledBy}
      >
        <ComparisonColumns showEmail={showEmail} showAction={reserveActionColumn} />
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Address</th>
            <th scope="col">Phone</th>
            {showEmail && <th scope="col">Email</th>}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row" data-label="Name">
              {source.name ?? 'Not Provided'}
            </th>
            <td data-label="Address">
              <span className="address-lines">
                {lines.length > 0
                  ? lines.map((line) => (
                      <span className="address-line" key={line}>
                        {line}
                      </span>
                    ))
                  : 'Not Provided'}
              </span>
            </td>
            <td data-label="Phone">{source.phone ?? 'Not Provided'}</td>
            {showEmail && <td data-label="Email">{source.email ?? 'Not Provided'}</td>}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
