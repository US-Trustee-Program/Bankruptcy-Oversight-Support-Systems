import './CaseReload.scss';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { ComboOption } from '@/lib/components/combobox/ComboBox';
import Api2 from '@/lib/models/api2';
import { CaseDetail, SyncedCase } from '@common/cams/cases';
import { getDivisionComboOptions, courtSorter } from '@/data-verification/dataVerificationHelper';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ComboBoxRef } from '@/lib/type-declarations/input-fields';
import { CASE_NUMBER_REGEX } from '@common/cams/regex';
import { useCaseReloadPolling } from './useCaseReloadPolling';
import { buildCaseId, parseApiValidationError } from './case-reload-helpers';
import { CaseSearchForm } from './CaseSearchForm';
import { ValidatedCaseDisplay } from './ValidatedCaseDisplay';
import { PollingStatusDisplay } from './PollingStatusDisplay';
import { CaseReloadActions } from './CaseReloadActions';
import { ErrorDisplay } from './ErrorDisplay';

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
            <CaseSearchForm
              divisionsList={divisionsList}
              divisionSelectionRef={divisionSelectionRef}
              isValidating={isValidating}
              isValidatable={isValidatable()}
              onDivisionSelection={handleDivisionSelection}
              onCaseNumberChange={handleCaseNumberChange}
              onValidate={handleValidate}
            />
          )}

          <ErrorDisplay validationError={validationError} reloadError={reloadError} />

          {validatedCase && (
            <>
              <ValidatedCaseDisplay
                divisionName={divisionName}
                caseNumber={caseNumber}
                validatedCase={validatedCase}
                cosmosCase={cosmosCase}
              />

              <PollingStatusDisplay pollStatus={pollStatus} isReloading={isReloading} />

              <CaseReloadActions
                pollStatus={pollStatus}
                isReloadable={isReloadable()}
                isReloading={isReloading}
                onReload={handleReload}
                onReset={handleReset}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
