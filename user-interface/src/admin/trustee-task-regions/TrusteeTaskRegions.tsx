import { useEffect, useState } from 'react';
import './TrusteeTaskRegions.scss';
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
import { RegionCaseAppointmentSource } from '@common/cams/trustee-appointments';

/** Displays a zero-padded region id ("02") as a plain number ("2"), matching the admin page design. */
function formatRegionId(regionId: string): string {
  return regionId.replace(/^0+(?=\d)/, '');
}

export function TrusteeTaskRegions() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [sources, setSources] = useState<RegionCaseAppointmentSource[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function loadSources() {
    try {
      const response = await Api2.getCaseAppointmentSources();
      setSources(response.data);
    } catch (error) {
      setLoadError((error as Error).message);
    }
  }

  useEffect(() => {
    loadSources().then(() => setIsLoaded(true));
  }, []);

  return (
    <div className="trustee-task-regions-panel" data-testid="trustee-task-regions-panel">
      <h2>Trustee Task Regions</h2>
      {!isLoaded && <LoadingSpinner caption="Loading..." />}
      {isLoaded && loadError && (
        <Alert
          id="trustee-task-regions-load-error"
          message={`Failed to load region sources. ${loadError}`}
          type={UswdsAlertStyle.Error}
          show={true}
        />
      )}
      {isLoaded && !loadError && (
        <div className="trustee-task-regions-table-container">
          <CamsTable aria-label="Trustee Task Regions" data-testid="trustee-task-regions-table">
            <CamsTableHeader>
              <CamsTableHeaderCell>Region</CamsTableHeaderCell>
              <CamsTableHeaderCell>Source</CamsTableHeaderCell>
            </CamsTableHeader>
            <CamsTableBody>
              {sources.map((source) => (
                <CamsTableRow key={source.regionId}>
                  <CamsTableCell data-cell="Region">
                    {formatRegionId(source.regionId)}
                  </CamsTableCell>
                  <CamsTableCell data-cell="Source">
                    {source.source === 'DXTR' ? (
                      'Using DXTR'
                    ) : (
                      <Button
                        id={`change-to-dxtr-${source.regionId}`}
                        uswdsStyle={UswdsButtonStyle.Default}
                        disabled
                      >
                        Change to DXTR
                      </Button>
                    )}
                  </CamsTableCell>
                </CamsTableRow>
              ))}
            </CamsTableBody>
          </CamsTable>
        </div>
      )}
    </div>
  );
}
