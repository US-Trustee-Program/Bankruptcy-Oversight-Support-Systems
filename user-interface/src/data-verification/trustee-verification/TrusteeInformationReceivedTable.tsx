import { sourceAddress, TrusteeComparison } from './trustee-comparison';

export type TrusteeInformationReceivedTableProps = {
  comparison: TrusteeComparison;
  labelledBy?: string;
};

export default function TrusteeInformationReceivedTable({
  comparison,
  labelledBy,
}: Readonly<TrusteeInformationReceivedTableProps>) {
  const { source, rows } = comparison;
  const showEmail = rows.some((row) => row.key === 'email');
  const lines = sourceAddress(source);
  return (
    <div className="trustee-comparison-table-container">
      <table
        className="usa-table usa-table--borderless trustee-comparison-table trustee-information-received-table"
        data-testid="trustee-information-received-table"
        aria-labelledby={labelledBy}
      >
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
            <th scope="row">{source.name ?? 'Not Provided'}</th>
            <td>
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
            <td>{source.phone ?? 'Not Provided'}</td>
            {showEmail && <td>{source.email ?? 'Not Provided'}</td>}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
