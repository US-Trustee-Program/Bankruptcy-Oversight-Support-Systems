import { useEffect, useRef, useState } from 'react';
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
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { ChangeToDxtrConfirmModal, ChangeToDxtrConfirmModalRef } from './ChangeToDxtrConfirmModal';

const CONFIRM_MODAL_ID = 'change-to-dxtr-confirm-modal';

/** Displays a zero-padded region id ("02") as a plain number ("2"), matching the admin page design. */
function formatRegionId(regionId: string): string {
  return regionId.replace(/^0+(?=\d)/, '');
}

export function TrusteeTaskRegions() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [sources, setSources] = useState<RegionCaseAppointmentSource[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingRegionId, setPendingRegionId] = useState<string | null>(null);
  const [focusRegionId, setFocusRegionId] = useState<string | null>(null);
  const confirmModalRef = useRef<ChangeToDxtrConfirmModalRef>(null);
  const alert = useGlobalAlert();

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

  useEffect(() => {
    if (!focusRegionId) return;
    const region = sources.find((source) => source.regionId === focusRegionId);
    const elementId =
      region?.source === 'DXTR' ? `using-dxtr-${focusRegionId}` : `change-to-dxtr-${focusRegionId}`;
    document.getElementById(elementId)?.focus();
    setFocusRegionId(null);
  }, [focusRegionId, sources]);

  function openConfirmModal(regionId: string) {
    confirmModalRef.current?.show(regionId, formatRegionId(regionId));
  }

  async function handleConfirm(regionId: string) {
    setPendingRegionId(regionId);
    try {
      const response = await Api2.patchCaseAppointmentSource(regionId);
      if (!response?.data) {
        throw new Error('No response data returned.');
      }
      const updatedSource = response.data;
      setSources((previous) =>
        previous.map((source) => (source.regionId === regionId ? updatedSource : source)),
      );
      alert?.success(`Region ${formatRegionId(regionId)} will change to DXTR on the next sync.`);
    } catch {
      alert?.error('Unable to change to DXTR. Please try again.');
    } finally {
      setPendingRegionId(null);
      setFocusRegionId(regionId);
    }
  }

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
                      <span
                        id={`using-dxtr-${source.regionId}`}
                        data-testid={`using-dxtr-${source.regionId}`}
                        tabIndex={-1}
                      >
                        Using DXTR
                      </span>
                    ) : (
                      <Button
                        id={`change-to-dxtr-${source.regionId}`}
                        aria-label={`Change Region ${formatRegionId(source.regionId)} to DXTR`}
                        uswdsStyle={UswdsButtonStyle.Default}
                        disabled={pendingRegionId === source.regionId}
                        onClick={() => openConfirmModal(source.regionId)}
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
      <ChangeToDxtrConfirmModal
        ref={confirmModalRef}
        modalId={CONFIRM_MODAL_ID}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
