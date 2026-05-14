import './BankruptcySoftware.scss';
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
import { BankruptcySoftwareProfile } from '@common/cams/bankruptcy-software';
import { AddSoftwareModal, AddSoftwareModalRef } from './AddSoftwareModal';

export function BankruptcySoftware() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [softwareList, setSoftwareList] = useState<BankruptcySoftwareProfile[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const addSoftwareModalRef = useRef<AddSoftwareModalRef>(null);

  async function loadSoftwareList() {
    try {
      const response = await Api2.getSoftwareList();
      setSoftwareList(response.data as BankruptcySoftwareProfile[]);
      setLoadError(null);
    } catch (error) {
      setLoadError((error as Error).message);
    }
  }

  useEffect(() => {
    setIsLoaded(false);
    loadSoftwareList().then(() => setIsLoaded(true));
  }, []);

  function handleSoftwareAdded(software: BankruptcySoftwareProfile) {
    setSoftwareList((prev) => [...prev, software].sort((a, b) => a.name.localeCompare(b.name)));
    getAppInsights().appInsights.trackEvent({
      name: 'Bankruptcy Software Created',
      properties: { softwareId: software.id, softwareName: software.name },
    });
  }

  return (
    <div className="bankruptcy-software-admin-panel" data-testid="bankruptcy-software-panel">
      <h2 className="screen-reader-only">Bankruptcy Software</h2>
      {!isLoaded && <LoadingSpinner caption="Loading..." />}
      {isLoaded && loadError && (
        <Alert
          id="bankruptcy-software-load-error"
          message={`Failed to load bankruptcy software. ${loadError}`}
          type={UswdsAlertStyle.Error}
          show={true}
        />
      )}
      {isLoaded && !loadError && (
        <>
          <div className="grid-row">
            <div className="grid-col-12">
              <Button
                id="add-software-button"
                uswdsStyle={UswdsButtonStyle.Default}
                onClick={() => addSoftwareModalRef.current?.show()}
              >
                + Add Software
              </Button>
            </div>
          </div>
          <div className="bankruptcy-software-table-container">
            <CamsTable aria-label="Bankruptcy Software" data-testid="bankruptcy-software-table">
              <CamsTableHeader>
                <CamsTableHeaderCell>Software Name</CamsTableHeaderCell>
              </CamsTableHeader>
              <CamsTableBody>
                {softwareList.map((software) => (
                  <CamsTableRow key={software.id}>
                    <CamsTableCell>
                      <Link to={`/admin/bankruptcy-software/${software.id}`}>{software.name}</Link>
                    </CamsTableCell>
                  </CamsTableRow>
                ))}
              </CamsTableBody>
            </CamsTable>
          </div>
        </>
      )}
      <AddSoftwareModal
        ref={addSoftwareModalRef}
        modalId="add-software-modal"
        onSuccess={handleSoftwareAdded}
      />
    </div>
  );
}
