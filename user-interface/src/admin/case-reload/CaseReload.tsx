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
import { CASE_NUMBER_REGEX } from '@common/cams/regex';
import { useCaseReloadPolling } from './useCaseReloadPolling';
import { buildCaseId, parseApiValidationError } from './case-reload-helpers';

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

  const divisionSelectionRef = useRef<ComboBoxRef>(null);

  const { pollStatus, latestCase, startPolling, stopPolling } = useCaseReloadPolling(cosmosCase);

  const getCourts = useCallback(() => {
    Api2.getCourts()
      .then((response) => {
        const sortedOffices = response.data.toSorted(courtSorter);
        const divisionOptions = getDivisionComboOptions(sortedOffices);
        setDivisionsList(divisionOptions);
      })
      .finally(() => {
        setIsLoaded(true);
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

  // Sync latestCase from hook to cosmosCase state
  useEffect(() => {
    if (latestCase) {
      setCosmosCase(latestCase);
    }
  }, [latestCase]);

  async function handleValidate() {
    setIsValidating(true);
    setValidationError(null);
    setValidatedCase(null);
    setCosmosCase(null);

    try {
      const caseId = buildCaseId(divisionCode, caseNumber);
      const caseDetailResponse = await Api2.getCaseDetail(caseId);
      setValidatedCase(caseDetailResponse.data);

      const searchResponse = await Api2.searchCases({
        caseIds: [caseId],
        limit: 1,
        offset: 0,
      });
      setCosmosCase(searchResponse?.data?.[0] ?? null);
    } catch (error: unknown) {
      setValidationError(parseApiValidationError(error));
    } finally {
      setIsValidating(false);
    }
  }

  async function handleReload() {
    setIsReloading(true);
    setReloadError(null);
    try {
      const caseId = buildCaseId(divisionCode, caseNumber);

      // Capture timestamp BEFORE queueing reload
      const startTime = new Date();

      await Api2.postCaseReload(caseId);

      // Start polling
      startPolling(caseId, startTime);
    } catch (error: unknown) {
      const message = (error as Error)?.message ?? 'Reason unknown.';
      setReloadError(`Failed to queue case reload. ${message}`);
    } finally {
      setIsReloading(false);
    }
  }

  function isValidatable() {
    // Validate division code is selected
    if (!divisionCode.trim()) {
      return false;
    }

    // Validate case number matches expected format (XX-XXXXX)
    if (!caseNumber || !CASE_NUMBER_REGEX.test(caseNumber)) {
      return false;
    }

    // Not validatable while validation is in progress
    return !isValidating;
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

    // Reset the division combo box
    if (divisionSelectionRef.current) {
      divisionSelectionRef.current.clearSelections();
    }
  }

  useEffect(() => {
    getCourts();
  }, [getCourts]);

  return (
    <div className="case-reload-admin-panel" data-testid="case-reload-panel">
      <h2>Reload Case from DXTR</h2>

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
                    autoComplete="off"
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
                    Find Case
                  </Button>
                </div>
              </div>
              {isValidating && (
                <div className="grid-row">
                  <div className="grid-col-12">
                    <LoadingSpinner caption="Finding case..." />
                  </div>
                </div>
              )}
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

              <div className="grid-row">
                <div className="grid-col-12 button-group">
                  {pollStatus !== 'success' && (
                    <Button
                      id="reload-button"
                      onClick={handleReload}
                      uswdsStyle={UswdsButtonStyle.Default}
                      disabled={!isReloadable() || pollStatus === 'polling' || isReloading}
                    >
                      Reload Case
                    </Button>
                  )}
                  <Button
                    id="reset-button"
                    onClick={handleReset}
                    uswdsStyle={UswdsButtonStyle.Outline}
                  >
                    Reset
                  </Button>
                </div>
              </div>

              {isReloading && (
                <div className="grid-row">
                  <div className="grid-col-12">
                    <LoadingSpinner caption="Queueing reload..." />
                  </div>
                </div>
              )}

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
                      message="The sync may still complete in the background"
                      show={true}
                      inline={true}
                      id="polling-timeout-alert"
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
