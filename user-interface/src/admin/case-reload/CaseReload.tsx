import './CaseReload.scss';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import CaseNumberInput from '@/lib/components/CaseNumberInput';
import ComboBox, { ComboOption } from '@/lib/components/combobox/ComboBox';
import Api2 from '@/lib/models/api2';
import { CaseDetail, SyncedCase } from '@common/cams/cases';
import { getDivisionComboOptions, courtSorter } from '@/data-verification/dataVerificationHelper';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ComboBoxRef } from '@/lib/type-declarations/input-fields';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';

export function CaseReload() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [divisionCode, setDivisionCode] = useState('');
  const [divisionName, setDivisionName] = useState('');
  const [caseNumber, setCaseNumber] = useState('');
  const [validatedCase, setValidatedCase] = useState<CaseDetail | null>(null);
  const [cosmosCase, setCosmosCase] = useState<SyncedCase | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [divisionsList, setDivisionsList] = useState<ComboOption[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [reloadError, setReloadError] = useState<string | null>(null);

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
      setDivisionName(selection[0].label);
    } else {
      setDivisionCode('');
      setDivisionName('');
    }
  }

  function handleCaseNumberChange(caseNumber?: string) {
    setCaseNumber(caseNumber || '');
  }

  async function handleValidate() {
    setIsValidating(true);
    setValidationError(null);
    setValidatedCase(null);
    setCosmosCase(null);
    setPollStatus('idle');

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
    } catch (error: unknown) {
      // TODO: Api wrapper discards the fetch Response object and only returns a plain Error
      // with a formatted string message. This forces us to parse the error message string
      // to extract the status code instead of interrogating response.status directly.
      // Consider refactoring Api to preserve response metadata for better error handling.
      const err = error as Error;
      const errorMessage = err.message || '';

      // Api.get rejects with Error containing message like "404 Error - /path - message"
      // Extract status code from the error message
      const statusMatch = errorMessage.match(/^(\d{3})\s+Error/);
      const status = statusMatch ? parseInt(statusMatch[1], 10) : null;

      if (status === 404) {
        setValidationError('Case Not Found');
      } else {
        // Extract the actual error message after the path
        // Format: "STATUS Error - /path - actual message"
        const messageMatch = errorMessage.match(/^(\d{3})\s+Error\s+-\s+[^\s]+\s+-\s+(.+)$/);
        const extractedMessage = messageMatch ? messageMatch[2] : '';

        const displayMessage =
          extractedMessage || 'Error encountered attempting to verify the case ID';
        setValidationError(displayMessage);
      }
    } finally {
      setIsValidating(false);
    }
  }

  async function handleReload() {
    setIsReloading(true);
    setReloadError(null);
    try {
      const caseId = `${divisionCode}-${caseNumber}`;

      // Capture timestamp BEFORE queueing reload
      const startTime = new Date();

      await Api2.postCaseReload(caseId);

      // Start polling after 10-second delay
      setPollStatus('polling');
      startPolling(caseId, startTime);
    } catch (_error: unknown) {
      setReloadError('Failed to queue case reload - please try again');
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

  function handleReset() {
    // Stop any active polling
    stopPolling();

    // Clear all state
    setDivisionCode('');
    setDivisionName('');
    setCaseNumber('');
    setValidatedCase(null);
    setCosmosCase(null);
    setValidationError(null);
    setReloadError(null);
    setPollStatus('idle');

    // Reset the division combo box
    if (divisionSelectionRef.current) {
      divisionSelectionRef.current.clearSelection();
    }
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

  return (
    <div className="case-reload-admin-panel" data-testid="case-reload-panel">
      <h2>Reload Case</h2>

      {!isLoaded && <LoadingSpinner caption="Loading..."></LoadingSpinner>}
      {isLoaded && (
        <div className="case-reload-form">
          {!validatedCase && (
            <>
              <div className="grid-row">
                <div className="grid-col-12">
                  <ComboBox
                    id="division-select"
                    label="Division"
                    aria-live="off"
                    onUpdateSelection={handleDivisionSelection}
                    options={divisionsList}
                    required={false}
                    multiSelect={false}
                    ref={divisionSelectionRef}
                    disabled={isValidating}
                  />
                </div>
              </div>

              <div className="grid-row">
                <div className="grid-col-12">
                  <CaseNumberInput
                    id="case-number-input"
                    label="Case Number"
                    onChange={handleCaseNumberChange}
                    allowEnterKey={false}
                    allowPartialCaseNumber={false}
                    disabled={isValidating}
                  />
                </div>
              </div>

              <div className="grid-row">
                <div className="grid-col-12">
                  <Button
                    id="validate-button"
                    onClick={handleValidate}
                    uswdsStyle={UswdsButtonStyle.Default}
                    disabled={!isValidatable() || isValidating}
                  >
                    {isValidating ? 'Finding...' : 'Find Case'}
                  </Button>
                </div>
              </div>
            </>
          )}

          {validationError && (
            <div className="grid-row" data-testid="validation-error-container">
              <div className="grid-col-12">
                <Alert
                  type={UswdsAlertStyle.Error}
                  title={validationError === 'Case Not Found' ? validationError : 'Error'}
                  message={validationError === 'Case Not Found' ? undefined : validationError}
                  show={true}
                  inline={true}
                  id="validation-error-alert"
                />
              </div>
            </div>
          )}

          {validatedCase && (
            <>
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

              <div className="grid-row">
                <div className="grid-col-12 button-group">
                  <Button
                    id="reload-button"
                    onClick={handleReload}
                    uswdsStyle={UswdsButtonStyle.Default}
                    disabled={!isReloadable() || pollStatus === 'polling'}
                  >
                    {isReloading ? 'Reloading...' : 'Reload Case'}
                  </Button>
                  <Button
                    id="reset-button"
                    onClick={handleReset}
                    uswdsStyle={UswdsButtonStyle.Outline}
                  >
                    Reset
                  </Button>
                </div>
              </div>

              {pollStatus === 'polling' && (
                <div className="grid-row" data-testid="polling-status-container">
                  <div className="grid-col-12">
                    <LoadingSpinner caption="Waiting for the reload to complete..." />
                  </div>
                </div>
              )}

              {pollStatus === 'timeout' && (
                <div className="grid-row" data-testid="polling-timeout-container">
                  <div className="grid-col-12">
                    <Alert
                      type={UswdsAlertStyle.Warning}
                      title="Case reload is taking longer than expected"
                      message="the sync may still complete in the background"
                      show={true}
                      inline={true}
                      id="polling-timeout-alert"
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
                      show={true}
                      inline={true}
                      id="polling-success-alert"
                    />
                  </div>
                </div>
              )}

              {reloadError && (
                <div className="grid-row" data-testid="reload-error-container">
                  <div className="grid-col-12">
                    <Alert
                      type={UswdsAlertStyle.Error}
                      title="Reload Error"
                      message={reloadError}
                      show={true}
                      inline={true}
                      id="reload-error-alert"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
