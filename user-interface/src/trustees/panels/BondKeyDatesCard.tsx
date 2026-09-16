import './BondKeyDatesCard.scss';
import { useNavigate } from 'react-router-dom';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import {
  CamsTable,
  CamsTableHeader,
  CamsTableHeaderCell,
  CamsTableBody,
  CamsTableRow,
  CamsTableCell,
} from '@/lib/components/cams/CamsTable';
import { TrusteeUpcomingKeyDates, isoToMMDDYYYY } from '@common/cams/trustee-upcoming-key-dates';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';

export interface BondKeyDatesCardProps {
  trusteeId: string;
  appointmentId: string;
  data: TrusteeUpcomingKeyDates | null;
  isLoading: boolean;
}

const NO_DATE = 'No date added';

function formatDateOrDefault(isoDate: string | undefined): string {
  return isoDate ? isoToMMDDYYYY(isoDate) : NO_DATE;
}

export default function BondKeyDatesCard(props: Readonly<BondKeyDatesCardProps>) {
  const { trusteeId, appointmentId, data, isLoading } = props;
  const navigate = useNavigate();
  const canManage = !!LocalStorage.getSession()?.user?.roles?.includes(CamsRole.TrusteeAdmin);

  function openEdit() {
    navigate(`/trustees/${trusteeId}/appointments/${appointmentId}/bond-key-dates/edit`);
  }

  if (isLoading) {
    return <LoadingSpinner id="bond-key-dates-loading" />;
  }

  return (
    <div className="bond-key-dates-card usa-card" data-testid="bond-key-dates-card">
      <div className="usa-card__container">
        <div className="usa-card__body">
          <div className="bond-key-dates-card-header">
            <h4>Bond</h4>
            {canManage && (
              <Button
                id={`edit-bond-key-dates-${appointmentId}`}
                uswdsStyle={UswdsButtonStyle.Unstyled}
                aria-label="Edit bond key dates"
                title="Edit bond key dates"
                onClick={openEdit}
              >
                <IconLabel icon="edit" label="Edit" />
              </Button>
            )}
          </div>
          <CamsTable
            id={`bond-key-dates-table-${appointmentId}`}
            className="bond-key-dates-table"
            aria-label="Bond key dates"
          >
            <CamsTableHeader>
              <CamsTableHeaderCell>Bond Renewal</CamsTableHeaderCell>
              <CamsTableHeaderCell>Bond Issued</CamsTableHeaderCell>
            </CamsTableHeader>
            <CamsTableBody>
              <CamsTableRow>
                <CamsTableCell data-cell="Bond Renewal" data-testid="bond-renewal-date">
                  {formatDateOrDefault(data?.bondRenewalDate)}
                </CamsTableCell>
                <CamsTableCell data-cell="Bond Issued" data-testid="bond-issued-date">
                  {formatDateOrDefault(data?.bondIssuedDate)}
                </CamsTableCell>
              </CamsTableRow>
            </CamsTableBody>
          </CamsTable>
        </div>
      </div>
    </div>
  );
}
