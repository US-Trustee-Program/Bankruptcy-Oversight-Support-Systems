import '@/styles/left-navigation-pane.scss';
import './BankDetail.scss';
import { useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import Api2 from '@/lib/models/api2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { BankProfile } from '@common/cams/banks';
import { EditBankModal, EditBankModalRef } from './EditBankModal';
import { BankDetailNavigation } from './BankDetailNavigation';
import { BankDetailOverview } from './BankDetailOverview';
import { BankDetailAuditHistory } from './BankDetailAuditHistory';
import { BackLink } from '@/lib/components/cams/BackLink/BackLink';

export function BankDetail() {
  const { bankId } = useParams();
  const [bank, setBank] = useState<BankProfile | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const editModalRef = useRef<EditBankModalRef>(null);

  useEffect(() => {
    if (!bankId) return;

    let isCancelled = false;

    setIsLoaded(false);
    Api2.getBank(bankId)
      .then((response) => {
        if (isCancelled) return;
        setBank(response.data);
        setLoadError(null);
      })
      .catch((error: Error) => {
        if (isCancelled) return;
        setLoadError(error.message);
      })
      .finally(() => {
        if (isCancelled) return;
        setIsLoaded(true);
      });

    return () => {
      isCancelled = true;
    };
  }, [bankId]);

  function handleBankUpdated(updated: BankProfile) {
    setBank(updated);
  }

  function handleEditBank() {
    editModalRef.current?.show();
  }

  return (
    <div className="bank-detail" data-testid="bank-detail">
      <BackLink to="/admin/banks" label="Back to Banks" title="Back to Banks list" />

      {!isLoaded && <LoadingSpinner caption="Loading..." />}

      {isLoaded && loadError && (
        <Alert
          id="bank-detail-load-error"
          message={`Failed to load bank. ${loadError}`}
          type={UswdsAlertStyle.Error}
          show={true}
        />
      )}

      {isLoaded && !loadError && bank && (
        <>
          <div className="grid-row">
            <div className="grid-col-12">
              <h1>{bank.name}</h1>
              <h2>Bank</h2>
            </div>
          </div>
          <div className="grid-row grid-gap-lg">
            <div className="grid-col-2">
              <div className="left-navigation-pane-container">
                <BankDetailNavigation bankId={bankId!} />
              </div>
            </div>
            <div className="grid-col-10">
              <Routes>
                <Route
                  path="overview"
                  element={<BankDetailOverview bank={bank} onEdit={handleEditBank} />}
                />
                <Route path="audit-history" element={<BankDetailAuditHistory bankId={bankId!} />} />
                <Route path="*" element={<Navigate to="overview" replace />} />
              </Routes>
            </div>
          </div>
        </>
      )}

      {bank && (
        <EditBankModal
          ref={editModalRef}
          modalId="edit-bank-modal"
          bank={bank}
          onSuccess={handleBankUpdated}
        />
      )}
    </div>
  );
}
