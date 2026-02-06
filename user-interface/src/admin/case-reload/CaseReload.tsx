import './CaseReload.scss';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import CaseNumberInput from '@/lib/components/CaseNumberInput';
import ComboBox, { ComboOption } from '@/lib/components/combobox/ComboBox';
import Api2 from '@/lib/models/api2';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { CaseDetail, SyncedCase } from '@common/cams/cases';
import { getDivisionComboOptions, courtSorter } from '@/data-verification/dataVerificationHelper';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ComboBoxRef } from '@/lib/type-declarations/input-fields';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';

export function CaseReload() {
  const globalAlert = useGlobalAlert();

  const [isLoaded, setIsLoaded] = useState(false);
  const [divisionCode, setDivisionCode] = useState('');
  const [caseNumber, setCaseNumber] = useState('');
  const [validatedCase, setValidatedCase] = useState<CaseDetail | null>(null);
  const [cosmosCase, setCosmosCase] = useState<SyncedCase | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [divisionsList, setDivisionsList] = useState<ComboOption[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Polling state for Slice 3
  const [pollStatus, setPollStatus] = useState<'idle' | 'polling' | 'success' | 'timeout'>('idle');

  const divisionSelectionRef = useRef<ComboBoxRef>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const initialPollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getCourts = useCallback(() => {
    Api2.getCourts()
      .then((response) => {
        const sortedOffices = response.data.sort(courtSorter);
        const divisionOptions = getDivisionComboOptions(sortedOffices);
        setDivisionsList(divisionOptions);
      })
      .catch((error) => {
        console.error('Error loading courts:', error);
      });
  }, []);

  function handleDivisionSelection(selection: ComboOption[]) {
    if (selection.length > 0) {
      setDivisionCode(selection[0].value);
    } else {
      setDivisionCode('');
    }
  }

  function handleCaseNumberChange(caseNumber?: string) {
    setCaseNumber(caseNumber || '');
  }

  async function handleValidate() {
    setIsValidating(true);
    setValidationError(null); // Clear previous inline errors
    setValidatedCase(null); // Clear previous validation
    setCosmosCase(null);
    setPollStatus('idle'); // Reset polling status on new validation

    try {
      const caseId = `${divisionCode}-${caseNumber}`;
      const caseDetailResponse = await Api2.getCaseDetail(caseId);
      setValidatedCase(caseDetailResponse.data);

      const searchResponse = await Api2.searchCases({
        caseIds: [caseId],
        limit: 1,
        offset: 0,
      });
      setCosmosCase(searchResponse?.data?.[0] || null);

      globalAlert?.success('Case validated successfully');
    } catch (error: unknown) {
      // Handle 404 - case not found (inline error)
      const err = error as { status?: number; response?: { status?: number } };
      if (err?.status === 404 || err?.response?.status === 404) {
        setValidationError('Case not found in DXTR system');
      } else {
        // Handle all other errors (global alert)
        globalAlert?.error('Temporary error validating case - please try again');
      }
    } finally {
      setIsValidating(false);
    }
  }

  async function handleReload() {
    setIsReloading(true);
    try {
      const caseId = `${divisionCode}-${caseNumber}`;

      // Capture timestamp BEFORE queueing reload
      const startTime = new Date();

      await Api2.postCaseReload(caseId);
      globalAlert?.success('Case reload queued successfully');

      // Start polling after 10-second delay
      setPollStatus('polling');
      startPolling(caseId, startTime);
    } catch (_error: unknown) {
      globalAlert?.error('Failed to queue case reload - please try again');
      // Clear validated state so user must re-validate
      setValidatedCase(null);
      setCosmosCase(null);
    } finally {
      setIsReloading(false);
    }
  }

  function isValidatable() {
    // CaseNumberInput only passes complete case numbers when allowPartialCaseNumber=false
    // Format is XX-XXXXX (8 chars including hyphen)
    return divisionCode.trim().length > 0 && caseNumber && caseNumber.length === 8 && !isValidating;
  }

  function isReloadable() {
    return validatedCase !== null && !isReloading;
  }

  function startPolling(caseId: string, startTime: Date) {
    let pollCount = 0;
    const maxPolls = 12; // 2 minutes (10s initial delay + 11 polls * 10s)

    // Clear any existing polling (safety)
    stopPolling();

    // Initial 10-second delay before first poll
    initialPollTimeoutRef.current = setTimeout(() => {
      // Poll every 10 seconds
      pollIntervalRef.current = setInterval(async () => {
        pollCount++;

        try {
          const searchResponse = await Api2.searchCases({
            caseIds: [caseId],
            limit: 1,
            offset: 0,
          });

          const newCosmosCase = searchResponse?.data?.[0];

          // Check for success (unified approach)
          const syncCompleted = checkSyncCompleted(newCosmosCase, startTime);

          if (syncCompleted) {
            // Success!
            stopPolling();
            setPollStatus('success');
            setCosmosCase(newCosmosCase || null);
            return;
          }

          // Check timeout
          if (pollCount >= maxPolls) {
            stopPolling();
            setPollStatus('timeout');
            return;
          }
        } catch (error) {
          // Polling API error - log but continue polling
          console.error('Polling error:', error);
          // Don't stop polling on transient errors
        }
      }, 10000); // 10 seconds
    }, 10000); // Initial 10-second delay
  }

  function checkSyncCompleted(newCosmosCase: SyncedCase | undefined, startTime: Date): boolean {
    if (!cosmosCase) {
      // Was "Not yet synced" - any result is success
      return !!newCosmosCase;
    } else {
      // Was previously synced - check if timestamp updated
      return !!(newCosmosCase && new Date(newCosmosCase.updatedOn) > startTime);
    }
  }

  function stopPolling() {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (initialPollTimeoutRef.current) {
      clearTimeout(initialPollTimeoutRef.current);
      initialPollTimeoutRef.current = null;
    }
  }

  useEffect(() => {
    getCourts();
    setIsLoaded(true);
  }, [getCourts]);

  useEffect(() => {
    // Cleanup polling on unmount
    return () => {
      stopPolling();
    };
  }, []);

  const formLocked = isValidating || isReloading || pollStatus === 'polling';

  return (
    <div className="case-reload-admin-panel" data-testid="case-reload-panel">
      <h2>Reload Case</h2>
      <p>Manually trigger a case reload from DXTR.</p>

      {!isLoaded && <LoadingSpinner caption="Loading..."></LoadingSpinner>}
      {isLoaded && (
        <div className="case-reload-form">
          <div className="grid-row">
            <div className="grid-col-12">
              <ComboBox
                id="division-select"
                data-testid="division-select"
                label="Division"
                aria-live="off"
                onUpdateSelection={handleDivisionSelection}
                options={divisionsList}
                required={false}
                multiSelect={false}
                ref={divisionSelectionRef}
                disabled={formLocked}
              />
            </div>
          </div>

          <div className="grid-row">
            <div className="grid-col-12">
              <CaseNumberInput
                id="case-number-input"
                data-testid="case-number-input"
                label="Case Number"
                onChange={handleCaseNumberChange}
                allowEnterKey={false}
                allowPartialCaseNumber={false}
                disabled={formLocked}
              />
            </div>
          </div>

          <div className="grid-row">
            <div className="grid-col-12">
              <Button
                id="validate-button"
                data-testid="validate-button"
                onClick={handleValidate}
                uswdsStyle={UswdsButtonStyle.Default}
                disabled={!isValidatable() || formLocked}
              >
                {isValidating ? 'Validating...' : 'Validate Case'}
              </Button>
            </div>
          </div>

          {validationError && (
            <div className="grid-row" data-testid="validation-error-container">
              <div className="grid-col-12">
                <Alert
                  type={UswdsAlertStyle.Error}
                  title="Validation Error"
                  message={validationError}
                  data-testid="validation-error-alert"
                />
              </div>
            </div>
          )}

          {pollStatus === 'polling' && (
            <div className="grid-row" data-testid="polling-status-container">
              <div className="grid-col-12">
                <p className="polling-status-message" data-testid="polling-status-message">
                  Waiting for sync to complete...
                </p>
              </div>
            </div>
          )}

          {pollStatus === 'timeout' && (
            <div className="grid-row" data-testid="polling-timeout-container">
              <div className="grid-col-12">
                <Alert
                  type={UswdsAlertStyle.Warning}
                  title="Sync Taking Longer Than Expected"
                  message="Case reload is taking longer than expected - the sync may still complete in the background"
                  data-testid="polling-timeout-alert"
                />
              </div>
            </div>
          )}

          {pollStatus === 'success' && (
            <div className="grid-row" data-testid="polling-success-container">
              <div className="grid-col-12">
                <Alert
                  type={UswdsAlertStyle.Success}
                  title="Sync Completed"
                  message="Sync completed successfully"
                  data-testid="polling-success-alert"
                />
              </div>
            </div>
          )}

          {validatedCase && (
            <div className="validation-results" data-testid="validation-results">
              <div className="grid-row">
                <div className="grid-col-12">
                  <h3>Validated Case</h3>
                  <p>
                    <strong>Case Name:</strong> {validatedCase.caseTitle}
                  </p>
                  <p>
                    <strong>Sync Status:</strong>{' '}
                    {cosmosCase
                      ? `Last synced: ${new Date(cosmosCase.updatedOn).toLocaleString()}`
                      : 'Not yet synced'}
                  </p>
                </div>
              </div>

              <div className="grid-row">
                <div className="grid-col-12">
                  <Button
                    id="reload-button"
                    data-testid="reload-button"
                    onClick={handleReload}
                    uswdsStyle={UswdsButtonStyle.Default}
                    disabled={!isReloadable() || formLocked}
                  >
                    {isReloading ? 'Queueing...' : 'Queue Case Reload'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
