import './Banks.scss';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Api2 from '@/lib/models/api2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import {
  CamsTable,
  CamsTableHeader,
  CamsTableHeaderCell,
  CamsTableBody,
  CamsTableRow,
  CamsTableCell,
} from '@/lib/components/cams/CamsTable';
import { getAppInsights } from '@/lib/hooks/UseApplicationInsights';
import { BankProfile } from '@common/cams/banks';
import { AddBankModal, AddBankModalRef } from './AddBankModal';

export function Banks() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [banks, setBanks] = useState<BankProfile[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const addBankModalRef = useRef<AddBankModalRef>(null);

  async function loadBanks() {
    try {
      const response = await Api2.getBanks();
      setBanks(response.data as BankProfile[]);
      setLoadError(null);
    } catch (error) {
      setLoadError((error as Error).message);
    }
  }

  useEffect(() => {
    setIsLoaded(false);
    loadBanks().then(() => setIsLoaded(true));
  }, []);

  function handleBankAdded(bank: BankProfile) {
    setBanks((prev) => [...prev, bank].sort((a, b) => a.name.localeCompare(b.name)));
    getAppInsights().appInsights.trackEvent({
      name: 'Bank Created',
      properties: { bankId: bank.id, bankName: bank.name },
    });
  }

  return (
    <div className="banks-admin-panel" data-testid="banks-panel">
      <h2 className="screen-reader-only">Banks</h2>
      {!isLoaded && <LoadingSpinner caption="Loading..." />}
      {isLoaded && loadError && (
        <Alert
          id="banks-load-error"
          message={`Failed to load banks. ${loadError}`}
          type={UswdsAlertStyle.Error}
          show={true}
        />
      )}
      {isLoaded && !loadError && (
        <>
          <div className="grid-row">
            <div className="grid-col-12">
              <Button
                id="add-bank-button"
                uswdsStyle={UswdsButtonStyle.Default}
                onClick={() => addBankModalRef.current?.show()}
              >
                + Add Bank
              </Button>
            </div>
          </div>
          <div className="banks-table-container">
            <CamsTable aria-label="Banks" data-testid="banks-table">
              <CamsTableHeader>
                <CamsTableHeaderCell>Bank name</CamsTableHeaderCell>
                <CamsTableHeaderCell className="banks-table-status-col">Status</CamsTableHeaderCell>
              </CamsTableHeader>
              <CamsTableBody>
                {banks.map((bank) => (
                  <CamsTableRow key={bank.id}>
                    <CamsTableCell>
                      <Link to={`/admin/banks/${bank.id}`}>{bank.name}</Link>
                    </CamsTableCell>
                    <CamsTableCell>
                      {bank.status === 'active' ? 'Active' : 'Inactive'}
                    </CamsTableCell>
                  </CamsTableRow>
                ))}
              </CamsTableBody>
            </CamsTable>
          </div>
        </>
      )}
      <AddBankModal ref={addBankModalRef} modalId="add-bank-modal" onSuccess={handleBankAdded} />
    </div>
  );
}
