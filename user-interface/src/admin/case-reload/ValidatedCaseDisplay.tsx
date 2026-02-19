import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { CaseDetail, SyncedCase } from '@common/cams/cases';

interface ValidatedCaseDisplayProps {
  divisionName: string;
  caseNumber: string;
  validatedCase: CaseDetail;
  cosmosCase: SyncedCase | null;
}

export function ValidatedCaseDisplay({
  divisionName,
  caseNumber,
  validatedCase,
  cosmosCase,
}: ValidatedCaseDisplayProps) {
  return (
    <div className="grid-row">
      <div className="grid-col-12">
        <Alert
          type={UswdsAlertStyle.Success}
          title="Case Exists"
          show={true}
          inline={true}
          id="validated-case-alert"
        >
          <div className="validated-case-details">
            <p>
              <strong>Division:</strong> {divisionName}
            </p>
            <p>
              <strong>Case Number:</strong> {caseNumber}
            </p>
            <p>
              <strong>Case Title:</strong> {validatedCase.caseTitle}
            </p>
            <p>
              <strong>Sync Status:</strong>{' '}
              {cosmosCase
                ? `Last synced: ${new Date(cosmosCase.updatedOn).toLocaleString()}`
                : 'Not yet synced'}
            </p>
          </div>
        </Alert>
      </div>
    </div>
  );
}
