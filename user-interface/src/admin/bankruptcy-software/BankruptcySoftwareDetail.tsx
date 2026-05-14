import '@/styles/left-navigation-pane.scss';
import { useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import Api2 from '@/lib/models/api2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import DocumentTitle from '@/lib/components/cams/DocumentTitle/DocumentTitle';
import { BackLink } from '@/lib/components/cams/BackLink/BackLink';
import { BankruptcySoftwareProfile } from '@common/cams/bankruptcy-software';
import { EditSoftwareModal, EditSoftwareModalRef } from './EditSoftwareModal';
import { BankruptcySoftwareDetailNavigation } from './BankruptcySoftwareDetailNavigation';
import { BankruptcySoftwareDetailOverview } from './BankruptcySoftwareDetailOverview';
import { SoftwareVendorContactInfoForm } from './SoftwareVendorContactInfoForm';

export function BankruptcySoftwareDetail() {
  const { softwareId } = useParams();
  const navigate = useNavigate();
  const [software, setSoftware] = useState<BankruptcySoftwareProfile | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const editModalRef = useRef<EditSoftwareModalRef>(null);

  useEffect(() => {
    if (!softwareId) return;

    let isCancelled = false;

    setIsLoaded(false);
    Api2.getSoftware(softwareId)
      .then((response) => {
        if (isCancelled) return;
        setSoftware(response.data);
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
  }, [softwareId]);

  function handleSoftwareUpdated(updated: BankruptcySoftwareProfile) {
    setSoftware(updated);
  }

  return (
    <div className="bankruptcy-software-detail" data-testid="bankruptcy-software-detail">
      {software && <DocumentTitle name={software.name} />}

      {!isLoaded && <LoadingSpinner caption="Loading..." />}

      {isLoaded && loadError && (
        <Alert
          id="software-detail-load-error"
          message={`Failed to load bankruptcy software. ${loadError}`}
          type={UswdsAlertStyle.Error}
          show={true}
        />
      )}

      {isLoaded && !loadError && software && (
        <Routes>
          <Route
            path="contact-info"
            element={
              <SoftwareVendorContactInfoForm software={software} onSaved={handleSoftwareUpdated} />
            }
          />
          <Route
            path="*"
            element={
              <>
                <BackLink
                  to="/admin/bankruptcy-software"
                  label="Back to Bankruptcy Software"
                  title="Back to Bankruptcy Software list"
                  testId="back-to-software-link"
                />
                <div className="grid-row">
                  <div className="grid-col-12">
                    <h1>{software.name}</h1>
                    <h2>Bankruptcy Software</h2>
                  </div>
                </div>
                <div className="grid-row grid-gap-lg">
                  <div className="grid-col-2">
                    <div className="left-navigation-pane-container">
                      <BankruptcySoftwareDetailNavigation softwareId={softwareId!} />
                    </div>
                  </div>
                  <div className="grid-col-10">
                    <Routes>
                      <Route
                        path="overview"
                        element={
                          <BankruptcySoftwareDetailOverview
                            software={software}
                            onEditGeneral={() => editModalRef.current?.show()}
                            onEditContact={() =>
                              navigate(`/admin/bankruptcy-software/${softwareId}/contact-info`)
                            }
                          />
                        }
                      />
                      <Route path="*" element={<Navigate to="overview" replace />} />
                    </Routes>
                  </div>
                </div>
              </>
            }
          />
        </Routes>
      )}

      {software && (
        <EditSoftwareModal
          ref={editModalRef}
          modalId="edit-software-modal"
          software={software}
          onSuccess={handleSoftwareUpdated}
        />
      )}
    </div>
  );
}
