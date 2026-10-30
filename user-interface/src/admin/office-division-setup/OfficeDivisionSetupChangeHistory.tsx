import { formatDate, sortByDateReverse } from '@/lib/utils/datetime';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import {
  CamsTable,
  CamsTableBody,
  CamsTableHeader,
  CamsTableHeaderCell,
  CamsTableRow,
  CamsTableCell,
} from '@/lib/components/cams/CamsTable';
import { DivisionMoveHistoryEntry, formatOffice } from './office-division-setup-data';

type OfficeDivisionSetupChangeHistoryProps = {
  history: DivisionMoveHistoryEntry[];
};

export function OfficeDivisionSetupChangeHistory({
  history: unsortedHistory,
}: Readonly<OfficeDivisionSetupChangeHistoryProps>) {
  const history = [...unsortedHistory].sort((a, b) => sortByDateReverse(a.changedOn, b.changedOn));

  return (
    <div
      className="office-division-setup-change-history"
      data-testid="office-division-setup-change-history"
    >
      {history.length === 0 ? (
        <div data-testid="empty-office-division-history">
          <Alert
            message="No changes have been made to office divisions."
            type={UswdsAlertStyle.Info}
            role={'status'}
            timeout={0}
            title=""
            show={true}
            inline={true}
          />
        </div>
      ) : (
        <CamsTable id="office-division-change-history-table" aria-label="Change history">
          <CamsTableHeader>
            <CamsTableHeaderCell>Change</CamsTableHeaderCell>
            <CamsTableHeaderCell>Previous</CamsTableHeaderCell>
            <CamsTableHeaderCell>New</CamsTableHeaderCell>
            <CamsTableHeaderCell>Changed by</CamsTableHeaderCell>
            <CamsTableHeaderCell>Date</CamsTableHeaderCell>
          </CamsTableHeader>
          <CamsTableBody>
            {history.map((entry) => (
              <CamsTableRow key={entry.id}>
                <CamsTableCell data-cell="Change">
                  {entry.divisionName} division, {entry.courtName}
                </CamsTableCell>
                <CamsTableCell data-cell="Previous">
                  {formatOffice(entry.previousOffice)}
                </CamsTableCell>
                <CamsTableCell data-cell="New">{formatOffice(entry.newOffice)}</CamsTableCell>
                <CamsTableCell data-cell="Changed by">{entry.changedBy}</CamsTableCell>
                <CamsTableCell data-cell="Date">{formatDate(entry.changedOn)}</CamsTableCell>
              </CamsTableRow>
            ))}
          </CamsTableBody>
        </CamsTable>
      )}
    </div>
  );
}
